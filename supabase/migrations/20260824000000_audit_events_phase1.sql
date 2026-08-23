-- ============================================================
-- MIGRATION: audit_events_phase1
-- Data: 2026-08-24
-- Descrição: Fase 1 da infraestrutura genérica de auditoria do βetaFleet.
--            Cria quatro tabelas de eventos append-only, alimentadas
--            exclusivamente por gatilhos no banco:
--
--              • public.maintenance_order_events
--              • public.payment_installment_events
--              • public.extra_payment_request_events
--              • public.profile_security_events
--
--            Mais duas funções compartilhadas (DRY): public.fn_audit_actor(),
--            que resolve a autoria da escrita corrente, e
--            public.fn_audit_events_immutable(), que recusa qualquer UPDATE
--            nas quatro tabelas.
--
--            POR QUE EXISTE: no caso Deluna Transportes (21/08/2026), quatro
--            OSs foram criadas e marcadas como "Veículo retirado" pelo mesmo
--            usuário em segundos, e o diagnóstico só foi possível por
--            inferência forense (created_at vs actual_exit_date), porque
--            maintenance_orders não guarda histórico de transições nem
--            autoria de mudança de status.
--
--            A captura acontece no banco, e não na camada React, porque o
--            frontend fala direto com o PostgREST: auditoria feita na
--            aplicação seria burlável por requisição forjada via DevTools ou
--            curl. O gatilho é o único ponto por onde toda escrita passa.
--
--            Esta migration é 100% ADITIVA. Nenhuma tabela, coluna, policy,
--            função ou gatilho pré-existente é alterado, e NÃO há backfill:
--            o histórico começa vazio na data da aplicação. O caso Deluna
--            não aparecerá no log — a auditoria vale a partir daqui.
--
--            Módulos que já possuem auditoria estruturada
--            (fleet_ticket_events, tire_position_history,
--            workshop_partnership_audit, vehicle_odometer_corrections,
--            driver_password_reset_log, maintenance_budget_reviews) NÃO são
--            tocados, duplicados nem migrados para este contrato.
--
--            Minimização de dados (LGPD art. 6º III): o payload guarda apenas
--            identificadores e campos de negócio auditados. Texto livre,
--            documentos, chaves PIX e URLs de anexo são proibidos.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================


-- ============================================================
-- SEÇÃO 1 — Funções compartilhadas pelas quatro entidades
-- ============================================================

-- ─── 1.1 Resolução de autoria ─────────────────────────────────
-- Responsabilidade única: dizer quem é o autor da escrita corrente, de forma
-- que NUNCA possa derrubar a transação de negócio.
--
-- SECURITY DEFINER é obrigatório: sem ele, a leitura de profiles dentro do
-- gatilho fica sujeita à RLS da própria profiles e pode devolver vazio,
-- estourando o NOT NULL de actor_name_snapshot e derrubando a escrita.
--
-- O caso "uid sem perfil" zera o actor_id em vez de gravar o uid porque
-- actor_id tem FK para profiles(id): gravar um uid órfão causaria violação de
-- chave estrangeira — exatamente o que este desenho existe para evitar.

CREATE OR REPLACE FUNCTION public.fn_audit_actor(
  OUT actor_id UUID,
  OUT actor_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- Sem usuário autenticado (SQL Editor / service_role): escape hatch
  -- deliberado de reparo manual, mesmo padrão de 20260822000000. Não é
  -- alcançável pela aplicação, que sempre atua com JWT de usuário.
  IF v_uid IS NULL THEN
    actor_id   := NULL;
    actor_name := 'service_role';
    RETURN;
  END IF;

  SELECT p.id, p.name INTO actor_id, actor_name
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF NOT FOUND THEN
    actor_id   := NULL;
    actor_name := 'unknown_actor';
  END IF;
END;
$$;

-- ─── 1.2 Imutabilidade dos eventos ────────────────────────────
-- Função única compartilhada pelas quatro tabelas (DRY).
--
-- DECISÃO CRÍTICA — cobre BEFORE UPDATE e NUNCA DELETE. As tabelas têm
-- ON DELETE CASCADE do pai. Se o gatilho recusasse DELETE, apagar o
-- registro-pai passaria a falhar: a cascata tentaria remover os eventos, o
-- gatilho recusaria, e a transação inteira morreria. Existem caminhos reais
-- de exclusão em produção (src/services/paymentInstallmentService.ts:340;
-- 3 policies de DELETE em maintenance_orders). Cobrindo só UPDATE: nenhum
-- evento pode ser adulterado, a cascata continua funcionando, e a API não
-- apaga nada porque a RLS não concede DELETE.

CREATE OR REPLACE FUNCTION public.fn_audit_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_EVENT_IS_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$$;


-- ============================================================
-- SEÇÃO 2 — maintenance_order_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  maintenance_order_id UUID NOT NULL REFERENCES public.maintenance_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_order_events_order
  ON public.maintenance_order_events(maintenance_order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_order_events_client
  ON public.maintenance_order_events(client_id, occurred_at DESC);

-- RLS: somente SELECT. Sem policy de INSERT/UPDATE/DELETE — com RLS
-- habilitada, a ausência de policy já é negação. Consequência confirmada: o
-- papel Workshop (rank 2 em role_ranks) não enxerga o histórico; Fleet
-- Assistant (rank 3) e acima, do mesmo tenant, enxergam; Admin Master vê tudo.

ALTER TABLE public.maintenance_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_order_events_select" ON public.maintenance_order_events;
CREATE POLICY "maintenance_order_events_select" ON public.maintenance_order_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_maintenance_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.maintenance_order_events (
      client_id, maintenance_order_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL,
      jsonb_build_object(
        'status',      NEW.status,
        'os_number',   NEW.os_number,
        'vehicle_id',  NEW.vehicle_id,
        'workshop_id', NEW.workshop_id,
        'type',        NEW.type
      ),
      v_actor.actor_id, v_actor.actor_name
    );
  ELSE
    INSERT INTO public.maintenance_order_events (
      client_id, maintenance_order_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      v_actor.actor_id, v_actor.actor_name
    );
  END IF;

  RETURN NULL;
END;
$$;

-- Os dois gatilhos precisam ser separados: uma cláusula WHEN que referencia
-- OLD é inválida em gatilho de INSERT.
--
-- A cláusula WHEN do gatilho de UPDATE é obrigatória e não pode ser omitida.
-- AFTER UPDATE OF status dispara sempre que a coluna é MENCIONADA no UPDATE,
-- mesmo com valor idêntico. Como saveMaintenanceOrder grava a linha inteira,
-- sem o WHEN cada edição de OS produziria um evento falso de "mudou status"
-- para o mesmo status, poluindo a auditoria.

DROP TRIGGER IF EXISTS trg_audit_maintenance_order_insert ON public.maintenance_orders;
CREATE TRIGGER trg_audit_maintenance_order_insert
  AFTER INSERT ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_maintenance_order();

DROP TRIGGER IF EXISTS trg_audit_maintenance_order_status ON public.maintenance_orders;
CREATE TRIGGER trg_audit_maintenance_order_status
  AFTER UPDATE OF status ON public.maintenance_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_maintenance_order();

DROP TRIGGER IF EXISTS trg_maintenance_order_events_immutable ON public.maintenance_order_events;
CREATE TRIGGER trg_maintenance_order_events_immutable
  BEFORE UPDATE ON public.maintenance_order_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 3 — payment_installment_events
-- ============================================================
--
-- Interação conhecida e ACEITA (não é bug): o gatilho já existente
-- trg_sync_extra_payment_request_paid_status (20260804000000) atualiza
-- extra_payment_requests.status quando a última parcela extra é paga, e
-- trg_sync_extra_payment_request_installments faz o caminho inverso. Com a
-- auditoria ligada, uma ação do usuário gera vários eventos encadeados, todos
-- atribuídos a quem disparou a ação original. É o comportamento desejado.
--
-- Minimização: notes, descricao, pix_key, pix_beneficiary_name, boleto_url e
-- nota_fiscal_url NÃO entram no payload.

CREATE TABLE IF NOT EXISTS public.payment_installment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_installment_id UUID NOT NULL REFERENCES public.payment_installments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_installment_events_installment
  ON public.payment_installment_events(payment_installment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_installment_events_client
  ON public.payment_installment_events(client_id, occurred_at DESC);

ALTER TABLE public.payment_installment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_installment_events_select" ON public.payment_installment_events;
CREATE POLICY "payment_installment_events_select" ON public.payment_installment_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_payment_installment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_installment_events (
      client_id, payment_installment_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL,
      jsonb_build_object(
        'status',             NEW.status,
        'installment_number', NEW.installment_number,
        'installments_total', NEW.installments_total,
        'value',              NEW.value,
        'due_date',           NEW.due_date,
        'source_type',        NEW.source_type
      ),
      v_actor.actor_id, v_actor.actor_name
    );
  ELSE
    INSERT INTO public.payment_installment_events (
      client_id, payment_installment_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      v_actor.actor_id, v_actor.actor_name
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payment_installment_insert ON public.payment_installments;
CREATE TRIGGER trg_audit_payment_installment_insert
  AFTER INSERT ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_payment_installment();

DROP TRIGGER IF EXISTS trg_audit_payment_installment_status ON public.payment_installments;
CREATE TRIGGER trg_audit_payment_installment_status
  AFTER UPDATE OF status ON public.payment_installments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_payment_installment();

DROP TRIGGER IF EXISTS trg_payment_installment_events_immutable ON public.payment_installment_events;
CREATE TRIGGER trg_payment_installment_events_immutable
  BEFORE UPDATE ON public.payment_installment_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 4 — extra_payment_request_events
-- ============================================================
--
-- Minimização: supplier_document, supplier_name, description, justification,
-- notes, receipt_url e invoice_url NÃO entram no payload.

CREATE TABLE IF NOT EXISTS public.extra_payment_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  extra_payment_request_id UUID NOT NULL REFERENCES public.extra_payment_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extra_payment_request_events_request
  ON public.extra_payment_request_events(extra_payment_request_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_extra_payment_request_events_client
  ON public.extra_payment_request_events(client_id, occurred_at DESC);

ALTER TABLE public.extra_payment_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extra_payment_request_events_select" ON public.extra_payment_request_events;
CREATE POLICY "extra_payment_request_events_select" ON public.extra_payment_request_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_extra_payment_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.extra_payment_request_events (
      client_id, extra_payment_request_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL,
      jsonb_build_object(
        'status',         NEW.status,
        'request_number', NEW.request_number,
        'category',       NEW.category,
        'amount',         NEW.amount,
        'service_date',   NEW.service_date,
        'vehicle_id',     NEW.vehicle_id,
        'driver_id',      NEW.driver_id
      ),
      v_actor.actor_id, v_actor.actor_name
    );
  ELSE
    INSERT INTO public.extra_payment_request_events (
      client_id, extra_payment_request_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      v_actor.actor_id, v_actor.actor_name
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_extra_payment_request_insert ON public.extra_payment_requests;
CREATE TRIGGER trg_audit_extra_payment_request_insert
  AFTER INSERT ON public.extra_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_extra_payment_request();

DROP TRIGGER IF EXISTS trg_audit_extra_payment_request_status ON public.extra_payment_requests;
CREATE TRIGGER trg_audit_extra_payment_request_status
  AFTER UPDATE OF status ON public.extra_payment_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_extra_payment_request();

DROP TRIGGER IF EXISTS trg_extra_payment_request_events_immutable ON public.extra_payment_request_events;
CREATE TRIGGER trg_extra_payment_request_events_immutable
  BEFORE UPDATE ON public.extra_payment_request_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 5 — profile_security_events
-- ============================================================
-- Audit trail aplicado ao vetor de escalação de privilégio. A fase audita
-- exatamente três campos: role, client_id e budget_approval_limit.
-- profiles.name, e-mail e permissões granulares (can_delete_vehicles,
-- can_delete_workshops) NÃO entram no payload.

-- DIFERENÇA 1 — client_id é NULLABLE aqui, e só aqui. O agent/AGENT.md
-- estabelece que o Admin Master tem client_id = NULL. Com NOT NULL, editar o
-- papel ou o limite de aprovação de um Admin Master faria o gatilho tentar
-- gravar um evento sem tenant, o banco recusaria e a edição do perfil ficaria
-- BLOQUEADA em produção. Deixar de auditar justamente o papel mais poderoso
-- do sistema seria o oposto do objetivo desta frente.

CREATE TABLE IF NOT EXISTS public.profile_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'security_field_changed')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_security_events_profile
  ON public.profile_security_events(profile_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_security_events_client
  ON public.profile_security_events(client_id, occurred_at DESC);

-- DIFERENÇA 2 — a policy exige client_id IS NOT NULL no ramo do tenant. Sem
-- isso, linhas sem tenant (eventos de Admin Master) poderiam vazar para
-- qualquer cliente cujo get_my_client_id() também retornasse NULL. Eventos
-- sem tenant são visíveis APENAS para Admin Master.

ALTER TABLE public.profile_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_security_events_select" ON public.profile_security_events;
CREATE POLICY "profile_security_events_select" ON public.profile_security_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id IS NOT NULL
      AND client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

-- A função monta old_value/new_value a partir de TRÊS campos independentes,
-- gravando no JSONB somente os que efetivamente mudaram. Dividir em
-- subfunções por campo geraria três linhas de evento para uma única edição de
-- perfil, quebrando a leitura cronológica do que aconteceu na transação.
--
-- DIFERENÇA 3 — no UPDATE grava-se o tenant de ORIGEM,
-- COALESCE(OLD.client_id, NEW.client_id). Quando o próprio client_id do perfil
-- muda (usuário movido de tenant), o evento pertence ao tenant de onde o
-- usuário SAIU — é ele quem precisa auditar a saída. O tenant de destino
-- aparece no new_value, e o Admin Master enxerga o evento de qualquer forma.
-- O COALESCE cobre o caso do Admin Master ganhando tenant (origem NULL).

CREATE OR REPLACE FUNCTION public.fn_audit_profile_security()
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

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_security_events (
      client_id, profile_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL,
      jsonb_build_object(
        'role',                  NEW.role,
        'client_id',             NEW.client_id,
        'budget_approval_limit', NEW.budget_approval_limit
      ),
      v_actor.actor_id, v_actor.actor_name
    );
    RETURN NULL;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    v_old := v_old || jsonb_build_object('role', OLD.role);
    v_new := v_new || jsonb_build_object('role', NEW.role);
  END IF;

  IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    v_old := v_old || jsonb_build_object('client_id', OLD.client_id);
    v_new := v_new || jsonb_build_object('client_id', NEW.client_id);
  END IF;

  IF OLD.budget_approval_limit IS DISTINCT FROM NEW.budget_approval_limit THEN
    v_old := v_old || jsonb_build_object('budget_approval_limit', OLD.budget_approval_limit);
    v_new := v_new || jsonb_build_object('budget_approval_limit', NEW.budget_approval_limit);
  END IF;

  INSERT INTO public.profile_security_events (
    client_id, profile_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    COALESCE(OLD.client_id, NEW.client_id), NEW.id, 'security_field_changed',
    v_old, v_new, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_security_insert ON public.profiles;
CREATE TRIGGER trg_audit_profile_security_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_profile_security();

DROP TRIGGER IF EXISTS trg_audit_profile_security_update ON public.profiles;
CREATE TRIGGER trg_audit_profile_security_update
  AFTER UPDATE OF role, client_id, budget_approval_limit ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.role IS DISTINCT FROM NEW.role
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.budget_approval_limit IS DISTINCT FROM NEW.budget_approval_limit
  )
  EXECUTE FUNCTION public.fn_audit_profile_security();

DROP TRIGGER IF EXISTS trg_profile_security_events_immutable ON public.profile_security_events;
CREATE TRIGGER trg_profile_security_events_immutable
  BEFORE UPDATE ON public.profile_security_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- Reload do schema PostgREST
-- ============================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- Conferência pós-aplicação (comentada — rodar no SQL Editor)
-- ============================================================
-- Conferência estrutural completa: supabase/diagnostics/check-audit-events-phase1.sql
--
-- -- 12 gatilhos (8 de captura + 4 de imutabilidade):
-- SELECT c.relname AS tabela, t.tgname AS gatilho, pg_get_triggerdef(t.oid) AS definicao
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND NOT t.tgisinternal
--   AND t.tgname IN (
--     'trg_audit_maintenance_order_insert',      'trg_audit_maintenance_order_status',
--     'trg_audit_payment_installment_insert',    'trg_audit_payment_installment_status',
--     'trg_audit_extra_payment_request_insert',  'trg_audit_extra_payment_request_status',
--     'trg_audit_profile_security_insert',       'trg_audit_profile_security_update',
--     'trg_maintenance_order_events_immutable',  'trg_payment_installment_events_immutable',
--     'trg_extra_payment_request_events_immutable', 'trg_profile_security_events_immutable'
--   )
-- ORDER BY c.relname, t.tgname;
-- -- Esperado: 12 linhas.
--
-- -- 4 policies, todas de SELECT:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'maintenance_order_events', 'payment_installment_events',
--     'extra_payment_request_events', 'profile_security_events'
--   )
-- ORDER BY tablename, policyname;
-- -- Esperado: 4 linhas, cmd = 'SELECT' em todas.
--
-- -- 8 índices:
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'maintenance_order_events', 'payment_installment_events',
--     'extra_payment_request_events', 'profile_security_events'
--   )
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
-- -- Esperado: 8 linhas.
--
-- -- Escape hatch da resolução de autoria (sem JWT de usuário):
-- SELECT * FROM public.fn_audit_actor();
-- -- Esperado: actor_id = NULL, actor_name = 'service_role'.


-- ============================================================
-- ROLLBACK EXATO — comentado, NUNCA executável automaticamente
-- ============================================================
-- Seccionado por entidade, na ordem inversa da criação:
-- gatilhos → policies → tabelas → funções compartilhadas.
-- Desfaz a migration por completo. Como não houve backfill, nenhum dado de
-- negócio é perdido: apenas o histórico de eventos acumulado desde a
-- aplicação. Rodar as seções na ordem em que aparecem abaixo.

-- ─── Rollback SEÇÃO 5 — profile_security_events ───────────────
-- DROP TRIGGER IF EXISTS trg_profile_security_events_immutable ON public.profile_security_events;
-- DROP TRIGGER IF EXISTS trg_audit_profile_security_update ON public.profiles;
-- DROP TRIGGER IF EXISTS trg_audit_profile_security_insert ON public.profiles;
-- DROP FUNCTION IF EXISTS public.fn_audit_profile_security();
-- DROP POLICY IF EXISTS "profile_security_events_select" ON public.profile_security_events;
-- DROP TABLE IF EXISTS public.profile_security_events;

-- ─── Rollback SEÇÃO 4 — extra_payment_request_events ──────────
-- DROP TRIGGER IF EXISTS trg_extra_payment_request_events_immutable ON public.extra_payment_request_events;
-- DROP TRIGGER IF EXISTS trg_audit_extra_payment_request_status ON public.extra_payment_requests;
-- DROP TRIGGER IF EXISTS trg_audit_extra_payment_request_insert ON public.extra_payment_requests;
-- DROP FUNCTION IF EXISTS public.fn_audit_extra_payment_request();
-- DROP POLICY IF EXISTS "extra_payment_request_events_select" ON public.extra_payment_request_events;
-- DROP TABLE IF EXISTS public.extra_payment_request_events;

-- ─── Rollback SEÇÃO 3 — payment_installment_events ────────────
-- DROP TRIGGER IF EXISTS trg_payment_installment_events_immutable ON public.payment_installment_events;
-- DROP TRIGGER IF EXISTS trg_audit_payment_installment_status ON public.payment_installments;
-- DROP TRIGGER IF EXISTS trg_audit_payment_installment_insert ON public.payment_installments;
-- DROP FUNCTION IF EXISTS public.fn_audit_payment_installment();
-- DROP POLICY IF EXISTS "payment_installment_events_select" ON public.payment_installment_events;
-- DROP TABLE IF EXISTS public.payment_installment_events;

-- ─── Rollback SEÇÃO 2 — maintenance_order_events ──────────────
-- DROP TRIGGER IF EXISTS trg_maintenance_order_events_immutable ON public.maintenance_order_events;
-- DROP TRIGGER IF EXISTS trg_audit_maintenance_order_status ON public.maintenance_orders;
-- DROP TRIGGER IF EXISTS trg_audit_maintenance_order_insert ON public.maintenance_orders;
-- DROP FUNCTION IF EXISTS public.fn_audit_maintenance_order();
-- DROP POLICY IF EXISTS "maintenance_order_events_select" ON public.maintenance_order_events;
-- DROP TABLE IF EXISTS public.maintenance_order_events;

-- ─── Rollback SEÇÃO 1 — funções compartilhadas ────────────────
-- Só depois de derrubar as quatro seções acima: os gatilhos dependem delas.
-- DROP FUNCTION IF EXISTS public.fn_audit_events_immutable();
-- DROP FUNCTION IF EXISTS public.fn_audit_actor();

-- NOTIFY pgrst, 'reload schema';
