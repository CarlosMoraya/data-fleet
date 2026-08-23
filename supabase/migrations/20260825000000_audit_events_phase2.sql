-- ============================================================
-- MIGRATION: audit_events_phase2
-- Data: 2026-08-25
-- Descrição: Fase 2 da infraestrutura genérica de auditoria do βetaFleet.
--            Cria três tabelas de eventos append-only, alimentadas
--            exclusivamente por gatilhos no banco:
--
--              • public.vehicle_events
--              • public.driver_events
--              • public.workshop_schedule_events
--
--            Objetos criados (21 no total): 3 tabelas, 6 índices,
--            3 policies de SELECT, 3 funções de captura
--            (fn_audit_vehicle, fn_audit_driver,
--            fn_audit_workshop_schedule) e 6 gatilhos — 3 de captura
--            (trg_audit_vehicle_update, trg_audit_driver_update,
--            trg_audit_workshop_schedule_update) e 3 de imutabilidade
--            (trg_vehicle_events_immutable, trg_driver_events_immutable,
--            trg_workshop_schedule_events_immutable).
--
--            POR QUE A CAPTURA É NO BANCO, E NÃO NA APLICAÇÃO: o frontend
--            fala direto com o PostgREST. Auditoria feita na camada React
--            seria burlável por requisição forjada via DevTools ou curl. O
--            gatilho é o único ponto por onde toda escrita passa
--            obrigatoriamente.
--
--            REUTILIZA AS FUNÇÕES COMPARTILHADAS DA FASE 1 e NÃO as recria:
--            public.fn_audit_actor() (resolução de autoria, com escape hatch
--            'service_role' quando auth.uid() IS NULL) e
--            public.fn_audit_events_immutable() (recusa qualquer UPDATE numa
--            tabela de eventos). Ambas já existem em DEV e em PROD desde
--            20260824000000_audit_events_phase1.sql. Um CREATE OR REPLACE
--            aqui criaria uma segunda fonte de verdade, que desatualiza.
--
--            Esta migration é 100% ADITIVA. Nenhuma tabela, coluna, policy,
--            função ou gatilho pré-existente é alterado — em particular,
--            vehicles, drivers e workshop_schedules não são tocadas — e NÃO
--            há backfill: o histórico começa vazio na data da aplicação.
--
--            Módulos que já possuem auditoria estruturada
--            (fleet_ticket_events, tire_position_history,
--            workshop_partnership_audit, vehicle_odometer_corrections,
--            driver_password_reset_log, maintenance_budget_reviews) NÃO são
--            tocados, duplicados nem migrados para este contrato.
--
--            Minimização de dados (LGPD art. 6º III): o payload guarda apenas
--            os campos de situação auditados. Placa, chassi, Renavam, modelo,
--            marca, nome, CPF, telefone, RENACH, categoria, uploads de
--            documentos e o texto livre `notes` de agendamento são proibidos.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================


-- ============================================================
-- SEÇÃO 1 — vehicle_events
-- ============================================================
--
-- A tabela vehicles tem DOIS campos de situação: status
-- (Available / In Use / Maintenance, garantido por vehicles_status_check) e
-- active (o inativar/reativar de Cadastros → Veículos). Ambos são auditados
-- sob o mesmo event_type 'status_changed', distinguidos pelas chaves do
-- JSONB. Auditar só o primeiro deixaria a ação mais destrutiva do módulo
-- Cadastros sem rastro.
--
-- client_id é NOT NULL aqui: a exceção nullable da Fase 1 valia APENAS para
-- profile_security_events (Admin Master tem client_id = NULL). vehicles tem
-- client_id NOT NULL na própria tabela, então não há caso a cobrir.

CREATE TABLE IF NOT EXISTS public.vehicle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('status_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_events_vehicle
  ON public.vehicle_events(vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_events_client
  ON public.vehicle_events(client_id, occurred_at DESC);

-- RLS: somente SELECT. Sem policy de INSERT/UPDATE/DELETE — com RLS
-- habilitada, a ausência de policy já é negação. Consequência confirmada: o
-- papel Workshop (rank 2 em role_ranks) não enxerga o histórico; Fleet
-- Assistant (rank 3) e acima, do mesmo tenant, enxergam; Admin Master vê tudo.

ALTER TABLE public.vehicle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_events_select" ON public.vehicle_events;
CREATE POLICY "vehicle_events_select" ON public.vehicle_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

-- A função monta old_value/new_value a partir dos DOIS campos de situação,
-- gravando no JSONB somente os que efetivamente mudaram, e insere UMA ÚNICA
-- linha por transação — mesma decisão de desenho de fn_audit_profile_security()
-- na Fase 1. Se status e active mudarem no mesmo UPDATE, sai uma linha com as
-- duas diferenças; quebrar em duas destruiria a leitura cronológica de uma
-- única ação do usuário.

CREATE OR REPLACE FUNCTION public.fn_audit_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
  v_old JSONB := '{}'::jsonb;
  v_new JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_old := v_old || jsonb_build_object('status', OLD.status);
    v_new := v_new || jsonb_build_object('status', NEW.status);
  END IF;

  IF OLD.active IS DISTINCT FROM NEW.active THEN
    v_old := v_old || jsonb_build_object('active', OLD.active);
    v_new := v_new || jsonb_build_object('active', NEW.active);
  END IF;

  INSERT INTO public.vehicle_events (
    client_id, vehicle_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    NEW.client_id, NEW.id, 'status_changed',
    v_old, v_new, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

-- A cláusula WHEN é obrigatória e não pode ser omitida. AFTER UPDATE OF status
-- dispara sempre que a coluna é MENCIONADA no UPDATE, mesmo com valor idêntico.
-- Como saveVehicle (src/services/vehicleService.ts) grava a linha inteira do
-- veículo em toda edição, sem o WHEN cada edição de cadastro produziria um
-- evento falso de "mudou situação" para a mesma situação, poluindo a auditoria.
-- É a mesma armadilha já documentada na Fase 1.
--
-- Não existe gatilho de INSERT nesta fase: a matriz de fases é vinculante e
-- pede apenas status_changed.

DROP TRIGGER IF EXISTS trg_audit_vehicle_update ON public.vehicles;
CREATE TRIGGER trg_audit_vehicle_update
  AFTER UPDATE OF status, active ON public.vehicles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.active IS DISTINCT FROM NEW.active)
  EXECUTE FUNCTION public.fn_audit_vehicle();

DROP TRIGGER IF EXISTS trg_vehicle_events_immutable ON public.vehicle_events;
CREATE TRIGGER trg_vehicle_events_immutable
  BEFORE UPDATE ON public.vehicle_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 2 — driver_events
-- ============================================================
--
-- NOTA DE DESENHO: a tabela drivers NÃO possui coluna status. O evento
-- 'status_changed' de motorista corresponde, por definição desta fase, à
-- mudança de active (o inativar/reativar de Cadastros → Motoristas). Nenhuma
-- coluna nova é criada para "resolver" isso — a fase é aditiva e não altera
-- tabelas de negócio.
--
-- Motorista é a única entidade da fase que pode gerar DUAS linhas na mesma
-- transação, e isso é intencional: status_changed e cnh_validity_changed são
-- fatos de natureza diferente pela matriz vinculante, e não devem ser fundidos.
--
-- Minimização: name, cpf, phone, registration_number, renach, category,
-- cnh_upload, gr_upload, certificate1_upload, certificate2_upload,
-- certificate3_upload, service_contract_upload, employment_regime, profile_id,
-- inactivated_by e inactivated_at NÃO entram no payload.

CREATE TABLE IF NOT EXISTS public.driver_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('status_changed', 'cnh_validity_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_events_driver
  ON public.driver_events(driver_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_events_client
  ON public.driver_events(client_id, occurred_at DESC);

ALTER TABLE public.driver_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_events_select" ON public.driver_events;
CREATE POLICY "driver_events_select" ON public.driver_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_driver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF OLD.active IS DISTINCT FROM NEW.active THEN
    INSERT INTO public.driver_events (
      client_id, driver_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'status_changed',
      jsonb_build_object('active', OLD.active),
      jsonb_build_object('active', NEW.active),
      v_actor.actor_id, v_actor.actor_name
    );
  END IF;

  IF OLD.expiration_date IS DISTINCT FROM NEW.expiration_date THEN
    INSERT INTO public.driver_events (
      client_id, driver_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'cnh_validity_changed',
      jsonb_build_object('expiration_date', OLD.expiration_date),
      jsonb_build_object('expiration_date', NEW.expiration_date),
      v_actor.actor_id, v_actor.actor_name
    );
  END IF;

  RETURN NULL;
END;
$$;

-- Mesma justificativa da cláusula WHEN da Seção 1: saveDriver
-- (src/services/driverService.ts) grava a linha inteira do motorista em toda
-- edição. Não existe gatilho de INSERT nesta fase.

DROP TRIGGER IF EXISTS trg_audit_driver_update ON public.drivers;
CREATE TRIGGER trg_audit_driver_update
  AFTER UPDATE OF active, expiration_date ON public.drivers
  FOR EACH ROW
  WHEN (OLD.active IS DISTINCT FROM NEW.active OR OLD.expiration_date IS DISTINCT FROM NEW.expiration_date)
  EXECUTE FUNCTION public.fn_audit_driver();

DROP TRIGGER IF EXISTS trg_driver_events_immutable ON public.driver_events;
CREATE TRIGGER trg_driver_events_immutable
  BEFORE UPDATE ON public.driver_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 3 — workshop_schedule_events
-- ============================================================
--
-- Campo auditado: workshop_schedules.status ('scheduled', 'completed',
-- 'cancelled', garantido pela constraint da tabela).
--
-- Minimização: notes (texto livre — proibido), checklist_id, created_by,
-- completed_at, vehicle_id e workshop_id NÃO entram no payload.

CREATE TABLE IF NOT EXISTS public.workshop_schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workshop_schedule_id UUID NOT NULL REFERENCES public.workshop_schedules(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('status_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workshop_schedule_events_schedule
  ON public.workshop_schedule_events(workshop_schedule_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_workshop_schedule_events_client
  ON public.workshop_schedule_events(client_id, occurred_at DESC);

ALTER TABLE public.workshop_schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workshop_schedule_events_select" ON public.workshop_schedule_events;
CREATE POLICY "workshop_schedule_events_select" ON public.workshop_schedule_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_workshop_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  INSERT INTO public.workshop_schedule_events (
    client_id, workshop_schedule_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    NEW.client_id, NEW.id, 'status_changed',
    jsonb_build_object('status', OLD.status),
    jsonb_build_object('status', NEW.status),
    v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

-- Mesma justificativa da cláusula WHEN das seções anteriores. Não existe
-- gatilho de INSERT nesta fase.

DROP TRIGGER IF EXISTS trg_audit_workshop_schedule_update ON public.workshop_schedules;
CREATE TRIGGER trg_audit_workshop_schedule_update
  AFTER UPDATE OF status ON public.workshop_schedules
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_workshop_schedule();

DROP TRIGGER IF EXISTS trg_workshop_schedule_events_immutable ON public.workshop_schedule_events;
CREATE TRIGGER trg_workshop_schedule_events_immutable
  BEFORE UPDATE ON public.workshop_schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- Reload do schema PostgREST
-- ============================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- Conferência pós-aplicação (comentada — rodar no SQL Editor)
-- ============================================================
-- Conferência estrutural completa: supabase/diagnostics/check-audit-events-phase2.sql
--
-- -- 6 gatilhos (3 de captura + 3 de imutabilidade):
-- SELECT c.relname AS tabela, t.tgname AS gatilho, pg_get_triggerdef(t.oid) AS definicao
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND NOT t.tgisinternal
--   AND t.tgname IN (
--     'trg_audit_vehicle_update',      'trg_audit_driver_update',
--     'trg_audit_workshop_schedule_update',
--     'trg_vehicle_events_immutable',  'trg_driver_events_immutable',
--     'trg_workshop_schedule_events_immutable'
--   )
-- ORDER BY c.relname, t.tgname;
-- -- Esperado: 6 linhas. Os 3 gatilhos de captura têm de trazer a cláusula
-- -- WHEN com IS DISTINCT FROM.
--
-- -- 3 policies, todas de SELECT:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('vehicle_events', 'driver_events', 'workshop_schedule_events')
-- ORDER BY tablename, policyname;
-- -- Esperado: 3 linhas, cmd = 'SELECT' em todas.
--
-- -- 6 índices:
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('vehicle_events', 'driver_events', 'workshop_schedule_events')
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
-- -- Esperado: 6 linhas.
--
-- -- Pré-requisito da Fase 1 (escape hatch da resolução de autoria):
-- SELECT * FROM public.fn_audit_actor();
-- -- Esperado: actor_id = NULL, actor_name = 'service_role'.


-- ============================================================
-- ROLLBACK EXATO — comentado, NUNCA executável automaticamente
-- ============================================================
-- Seccionado por entidade, na ordem inversa da criação (Seção 3 → 2 → 1);
-- dentro de cada seção: gatilhos → função → policy → tabela.
-- Desfaz a migration por completo. Como não houve backfill, nenhum dado de
-- negócio é perdido: apenas o histórico de eventos acumulado desde a
-- aplicação. Rodar as seções na ordem em que aparecem abaixo.
--
-- ⚠️ ATENÇÃO: este rollback NÃO derruba public.fn_audit_actor() nem
-- public.fn_audit_events_immutable(). As duas pertencem à Fase 1, que
-- permanece em produção — dropá-las aqui derrubaria junto a auditoria das
-- quatro tabelas da Fase 1.

-- ─── Rollback SEÇÃO 3 — workshop_schedule_events ──────────────
-- DROP TRIGGER IF EXISTS trg_workshop_schedule_events_immutable ON public.workshop_schedule_events;
-- DROP TRIGGER IF EXISTS trg_audit_workshop_schedule_update ON public.workshop_schedules;
-- DROP FUNCTION IF EXISTS public.fn_audit_workshop_schedule();
-- DROP POLICY IF EXISTS "workshop_schedule_events_select" ON public.workshop_schedule_events;
-- DROP TABLE IF EXISTS public.workshop_schedule_events;

-- ─── Rollback SEÇÃO 2 — driver_events ─────────────────────────
-- DROP TRIGGER IF EXISTS trg_driver_events_immutable ON public.driver_events;
-- DROP TRIGGER IF EXISTS trg_audit_driver_update ON public.drivers;
-- DROP FUNCTION IF EXISTS public.fn_audit_driver();
-- DROP POLICY IF EXISTS "driver_events_select" ON public.driver_events;
-- DROP TABLE IF EXISTS public.driver_events;

-- ─── Rollback SEÇÃO 1 — vehicle_events ────────────────────────
-- DROP TRIGGER IF EXISTS trg_vehicle_events_immutable ON public.vehicle_events;
-- DROP TRIGGER IF EXISTS trg_audit_vehicle_update ON public.vehicles;
-- DROP FUNCTION IF EXISTS public.fn_audit_vehicle();
-- DROP POLICY IF EXISTS "vehicle_events_select" ON public.vehicle_events;
-- DROP TABLE IF EXISTS public.vehicle_events;

-- NOTIFY pgrst, 'reload schema';
