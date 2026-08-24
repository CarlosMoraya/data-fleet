-- ============================================================
-- MIGRATION: audit_events_phase3
-- Data: 2026-08-26
-- Descrição: Fase 3 da infraestrutura genérica de auditoria do βetaFleet.
--            Cria quatro tabelas de eventos append-only, alimentadas
--            exclusivamente por gatilhos no banco:
--
--              • public.tire_events
--              • public.shipper_events
--              • public.operational_unit_events
--              • public.client_events
--
--            Objetos criados (32 no total): 4 tabelas, 7 índices,
--            4 policies de SELECT, 5 funções (a auxiliar compartilhada
--            fn_audit_jsonb_diff e as quatro de captura fn_audit_tire,
--            fn_audit_shipper, fn_audit_operational_unit e fn_audit_client)
--            e 12 gatilhos — 8 de captura (INSERT e UPDATE por entidade) e
--            4 de imutabilidade.
--
--            São 7 índices, e não 8, porque client_events tem UM só: nessa
--            tabela client_id acumula os dois papéis do contrato (isolamento
--            de tenant e identificação da linha auditada), então os dois
--            índices padrão colapsariam na mesma definição. Ver SEÇÃO 5.
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
--            tires, shippers, operational_units e clients não são tocadas —
--            e NÃO há backfill: o histórico começa vazio na data da
--            aplicação.
--
--            Módulos que já possuem auditoria estruturada
--            (fleet_ticket_events, tire_position_history,
--            workshop_partnership_audit, vehicle_odometer_corrections,
--            driver_password_reset_log, maintenance_budget_reviews) NÃO são
--            tocados, duplicados nem migrados para este contrato.
--
--            Minimização de dados (LGPD art. 6º III): cada entidade declara
--            uma ALLOWLIST explícita de colunas auditadas (default-deny).
--            Coluna fora da lista nunca é lida nem gravada. O texto livre
--            `notes` (de shippers e operational_units) é PROIBIDO em
--            qualquer payload, e os metadados de linha (id, client_id,
--            created_at, updated_at, created_by, updated_by) ficam fora,
--            por já existirem em colunas próprias do evento.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================


-- ============================================================
-- SEÇÃO 1 — Função auxiliar de diff (única função nova compartilhada)
-- ============================================================

-- Responsabilidade única: dizer quais campos de uma allowlist mudaram entre
-- dois snapshots JSONB, e com quais valores.
--
-- POR QUE EXISTE (DRY): as quatro entidades desta fase somam 27 colunas
-- auditadas. Sem esta função, o mesmo bloco IF ... IS DISTINCT FROM apareceria
-- 27 vezes espalhado pelas funções de captura. Concentrando a comparação aqui,
-- as quatro funções de captura ficam finas e sem lógica duplicada.
--
-- p_fields É O MECANISMO DE MINIMIZAÇÃO DE DADOS: é uma allowlist
-- default-deny. Coluna que não está no array nunca é lida do snapshot e nunca
-- chega ao payload gravado — a LGPD é atendida por construção, e não por
-- revisão manual de cada função.
--
-- NÃO é SECURITY DEFINER: a função não lê nenhuma tabela, portanto não há RLS
-- a contornar. Conceder o privilégio seria violar o menor privilégio à toa.
--
-- Detalhe de semântica que o desenho depende: o operador -> devolve NULL para
-- chave ausente. É isso que faz o padrão de criação funcionar (ver nota de uso
-- logo abaixo da função).

CREATE OR REPLACE FUNCTION public.fn_audit_jsonb_diff(
  p_old JSONB,
  p_new JSONB,
  p_fields TEXT[],
  OUT old_diff JSONB,
  OUT new_diff JSONB
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_field TEXT;
BEGIN
  old_diff := '{}'::jsonb;
  new_diff := '{}'::jsonb;

  FOREACH v_field IN ARRAY p_fields LOOP
    IF (p_old -> v_field) IS DISTINCT FROM (p_new -> v_field) THEN
      old_diff := old_diff || jsonb_build_object(v_field, p_old -> v_field);
      new_diff := new_diff || jsonb_build_object(v_field, p_new -> v_field);
    END IF;
  END LOOP;
END;
$$;

-- NOTA DE USO NA CRIAÇÃO: no evento 'created', a função é chamada com
-- p_old = '{}'::jsonb. Como '{}'::jsonb -> 'campo' é NULL, todo campo com
-- valor não nulo em NEW aparece em new_diff, e campos nulos ficam de fora —
-- exatamente o snapshot desejado. O old_diff devolvido é descartado nesse
-- caso: a coluna old_value recebe NULL literal, conforme o contrato comum de
-- colunas (requisito 3 de prompts/padronizacao-auditoria-sistema.md).


-- ============================================================
-- SEÇÃO 2 — tire_events
-- ============================================================
--
-- CONFLITO DE DUPLICAÇÃO — POR QUE current_position E last_position ESTÃO
-- FORA DA ALLOWLIST: public.tire_position_history (migration
-- 20260324000000_create_tire_management.sql) JÁ audita movimentação de posição
-- de pneu desde a criação do módulo, e saveTireIndividual
-- (src/services/tireService.ts) insere nela sempre que a posição muda.
-- Incluir essas duas colunas aqui faria toda troca de pneu gravar o mesmo fato
-- em duas tabelas, violando o requisito 7 do prompt-base (módulos com
-- auditoria estruturada não são duplicados). Posição de pneu vive em
-- tire_position_history; tire_events cobre o resto do cadastro.
--
-- Minimização: created_by, updated_by, created_at, updated_at, id e client_id
-- ficam fora do payload — são metadados já presentes em colunas próprias do
-- evento ou ruído sem valor forense.

CREATE TABLE IF NOT EXISTS public.tire_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tire_id UUID NOT NULL REFERENCES public.tires(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tire_events_tire
  ON public.tire_events(tire_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tire_events_client
  ON public.tire_events(client_id, occurred_at DESC);

-- RLS: somente SELECT. Sem policy de INSERT/UPDATE/DELETE — com RLS
-- habilitada, a ausência de policy já é negação. Consequência confirmada: o
-- papel Workshop (rank 2 em role_ranks) não enxerga o histórico; Fleet
-- Assistant (rank 3) e acima, do mesmo tenant, enxergam; Admin Master vê tudo.

ALTER TABLE public.tire_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tire_events_select" ON public.tire_events;
CREATE POLICY "tire_events_select" ON public.tire_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

-- SECURITY DEFINER é obrigatório: a função insere numa tabela que não tem
-- policy de INSERT. Sem ele, a escrita de auditoria seria negada pela RLS e
-- derrubaria junto a operação de negócio que a disparou.
--
-- O corpo é uma sequência linear obrigatória (resolver autor → declarar a
-- allowlist → calcular o diff → decidir criação ou edição → inserir). A
-- allowlist de 13 colunas ocupa sozinha 5 linhas. Quebrar em subfunções
-- exigiria passar NEW/OLD entre elas, o que em PL/pgSQL só é possível
-- serializando para JSONB — trocaria 4 linhas por indireção e um custo real.
-- Mantida unida deliberadamente.

CREATE OR REPLACE FUNCTION public.fn_audit_tire()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  RECORD;
  v_diff   RECORD;
  v_fields TEXT[] := ARRAY[
    'vehicle_id', 'tire_code', 'specification', 'dot', 'fire_marking',
    'manufacturer', 'brand', 'rotation_interval_km', 'useful_life_km',
    'retread_interval_km', 'visual_classification', 'position_type', 'active'
  ];
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_diff
      FROM public.fn_audit_jsonb_diff('{}'::jsonb, to_jsonb(NEW), v_fields);

    INSERT INTO public.tire_events (
      client_id, tire_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
    );

    RETURN NULL;
  END IF;

  SELECT * INTO v_diff
    FROM public.fn_audit_jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), v_fields);

  IF v_diff.new_diff = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.tire_events (
    client_id, tire_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    NEW.client_id, NEW.id, 'updated',
    v_diff.old_diff, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

-- AUSÊNCIA DE CLÁUSULA WHEN — DESVIO DELIBERADO DAS FASES 1 E 2:
-- As Fases 1 e 2 auditavam uma ou duas colunas e usavam
-- WHEN (OLD.x IS DISTINCT FROM NEW.x) para evitar eventos falsos, porque
-- AFTER UPDATE OF <coluna> dispara sempre que a coluna é MENCIONADA no UPDATE,
-- mesmo com valor idêntico — e os serviços do projeto gravam a linha inteira
-- em toda edição (saveTireIndividual faz exatamente isso). Aqui a allowlist
-- tem 13 colunas: um WHEN com 13 termos seria ilegível e teria de ser mantido
-- em sincronia manual com o array v_fields, criando duas fontes de verdade. A
-- defesa foi movida para DENTRO da função
-- (IF v_diff.new_diff = '{}' THEN RETURN NULL), que produz o mesmo resultado
-- com um único ponto de manutenção.
-- ISTO É INTENCIONAL — nenhum agente futuro deve "corrigir" acrescentando WHEN.
--
-- INSERÇÃO EM LOTE: TireBatchForm (src/components/TireBatchForm.tsx) insere
-- pneus em lotes de até 100 linhas. Cada linha gera um evento 'created'
-- próprio, porque o gatilho é FOR EACH ROW. É o comportamento desejado: sem
-- uma linha por pneu, não haveria rastro individual.

DROP TRIGGER IF EXISTS trg_audit_tire_insert ON public.tires;
CREATE TRIGGER trg_audit_tire_insert
  AFTER INSERT ON public.tires
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_tire();

DROP TRIGGER IF EXISTS trg_audit_tire_update ON public.tires;
CREATE TRIGGER trg_audit_tire_update
  AFTER UPDATE OF
    vehicle_id, tire_code, specification, dot, fire_marking,
    manufacturer, brand, rotation_interval_km, useful_life_km,
    retread_interval_km, visual_classification, position_type, active
  ON public.tires
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_tire();

DROP TRIGGER IF EXISTS trg_tire_events_immutable ON public.tire_events;
CREATE TRIGGER trg_tire_events_immutable
  BEFORE UPDATE ON public.tire_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 3 — shipper_events
-- ============================================================
--
-- Minimização: notes (texto livre) está FORA da allowlist, pelo requisito 8 do
-- prompt-base. id, client_id e created_at também ficam fora.
--
-- RISCO ACEITO (2026-08-23) — DADOS DE CONTATO NO PAYLOAD: phone, email e
-- contact_person são dados de contato, e contact_person é nome de pessoa
-- física. Entram no payload seguindo o precedente já vigente no projeto para a
-- validade de CNH em driver_events (docs/MEMORY.md, "Decisões Vigentes",
-- 2026-08-22): são dados já visíveis na tela de Embarcadores para exatamente
-- as mesmas funções, e a policy da tabela de eventos é idêntica à da tabela de
-- origem — a superfície de exposição não aumenta.

CREATE TABLE IF NOT EXISTS public.shipper_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shipper_id UUID NOT NULL REFERENCES public.shippers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipper_events_shipper
  ON public.shipper_events(shipper_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipper_events_client
  ON public.shipper_events(client_id, occurred_at DESC);

ALTER TABLE public.shipper_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipper_events_select" ON public.shipper_events;
CREATE POLICY "shipper_events_select" ON public.shipper_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_shipper()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  RECORD;
  v_diff   RECORD;
  v_fields TEXT[] := ARRAY['name', 'cnpj', 'phone', 'email', 'contact_person', 'active'];
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_diff
      FROM public.fn_audit_jsonb_diff('{}'::jsonb, to_jsonb(NEW), v_fields);

    INSERT INTO public.shipper_events (
      client_id, shipper_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
    );

    RETURN NULL;
  END IF;

  SELECT * INTO v_diff
    FROM public.fn_audit_jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), v_fields);

  IF v_diff.new_diff = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.shipper_events (
    client_id, shipper_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    NEW.client_id, NEW.id, 'updated',
    v_diff.old_diff, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

-- Sem cláusula WHEN, pela mesma justificativa da SEÇÃO 2: a guarda de diff
-- vazio dentro da função é o único ponto de manutenção.

DROP TRIGGER IF EXISTS trg_audit_shipper_insert ON public.shippers;
CREATE TRIGGER trg_audit_shipper_insert
  AFTER INSERT ON public.shippers
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_shipper();

DROP TRIGGER IF EXISTS trg_audit_shipper_update ON public.shippers;
CREATE TRIGGER trg_audit_shipper_update
  AFTER UPDATE OF name, cnpj, phone, email, contact_person, active
  ON public.shippers
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_shipper();

DROP TRIGGER IF EXISTS trg_shipper_events_immutable ON public.shipper_events;
CREATE TRIGGER trg_shipper_events_immutable
  BEFORE UPDATE ON public.shipper_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 4 — operational_unit_events
-- ============================================================
--
-- Minimização: notes fora da allowlist (texto livre, requisito 8); id,
-- client_id e created_at também.
--
-- shipper_id ESTÁ na allowlist. Mover uma unidade operacional de um embarcador
-- para outro é uma mudança de vínculo com consequência operacional direta — os
-- veículos ligados a ela passam a responder por outro embarcador — e é
-- exatamente o tipo de alteração silenciosa que esta fase existe para
-- registrar.

CREATE TABLE IF NOT EXISTS public.operational_unit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  operational_unit_id UUID NOT NULL REFERENCES public.operational_units(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_unit_events_unit
  ON public.operational_unit_events(operational_unit_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_unit_events_client
  ON public.operational_unit_events(client_id, occurred_at DESC);

ALTER TABLE public.operational_unit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_unit_events_select" ON public.operational_unit_events;
CREATE POLICY "operational_unit_events_select" ON public.operational_unit_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

CREATE OR REPLACE FUNCTION public.fn_audit_operational_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  RECORD;
  v_diff   RECORD;
  v_fields TEXT[] := ARRAY['shipper_id', 'name', 'code', 'city', 'state', 'active'];
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_diff
      FROM public.fn_audit_jsonb_diff('{}'::jsonb, to_jsonb(NEW), v_fields);

    INSERT INTO public.operational_unit_events (
      client_id, operational_unit_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
    );

    RETURN NULL;
  END IF;

  SELECT * INTO v_diff
    FROM public.fn_audit_jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), v_fields);

  IF v_diff.new_diff = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.operational_unit_events (
    client_id, operational_unit_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    NEW.client_id, NEW.id, 'updated',
    v_diff.old_diff, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

-- Sem cláusula WHEN, pela mesma justificativa da SEÇÃO 2.

DROP TRIGGER IF EXISTS trg_audit_operational_unit_insert ON public.operational_units;
CREATE TRIGGER trg_audit_operational_unit_insert
  AFTER INSERT ON public.operational_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_operational_unit();

DROP TRIGGER IF EXISTS trg_audit_operational_unit_update ON public.operational_units;
CREATE TRIGGER trg_audit_operational_unit_update
  AFTER UPDATE OF shipper_id, name, code, city, state, active
  ON public.operational_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_operational_unit();

DROP TRIGGER IF EXISTS trg_operational_unit_events_immutable ON public.operational_unit_events;
CREATE TRIGGER trg_operational_unit_events_immutable
  BEFORE UPDATE ON public.operational_unit_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- SEÇÃO 5 — client_events
-- ============================================================
--
-- A ÚNICA VARIAÇÃO DE CONTRATO DESTA FASE: clients É o tenant. As duas colunas
-- exigidas pelo requisito 3 (client_id, para isolamento de RLS, e
-- <entidade>_id, apontando para a linha auditada) referenciariam a mesma
-- tabela e conteriam sempre o mesmo UUID. A tabela usa portanto UMA COLUNA SÓ,
-- client_id, cumprindo os dois papéis — o contrato é honrado por identidade,
-- não por duplicação. Pela mesma razão existe UM ÚNICO ÍNDICE: os dois índices
-- padrão do requisito 6 colapsariam na mesma definição.
-- Esta variação vale EXCLUSIVAMENTE para client_events e não abre precedente
-- para as outras entidades.
--
-- Minimização: a allowlist é name e logo_url. created_at e id ficam fora.
--
-- ALCANCE DA POLICY: só o papel Admin Master cria, edita e exclui clientes
-- (src/pages/AdminClients.tsx redireciona qualquer outro papel). A policy
-- padrão do requisito 5 é mantida sem alteração: na prática, Admin Master
-- enxerga tudo pelo primeiro ramo, e Fleet Assistant+ de um tenant enxerga o
-- histórico do próprio tenant pelo segundo. Isso é desejado — o cliente vê
-- quando seu próprio cadastro foi renomeado.

CREATE TABLE IF NOT EXISTS public.client_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name_snapshot TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_events_client
  ON public.client_events(client_id, occurred_at DESC);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_events_select" ON public.client_events;
CREATE POLICY "client_events_select" ON public.client_events
  FOR SELECT USING (
    public.is_admin_master()
    OR (
      client_id = public.get_my_client_id()
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
  );

-- ⚠️ PONTO MAIS FÁCIL DE ERRAR DE TODA A MIGRATION: client_id recebe NEW.id,
-- e NÃO NEW.client_id — a tabela clients não tem coluna client_id. Referenciar
-- NEW.client_id faria a função falhar em tempo de execução e IMPEDIRIA a
-- criação de qualquer tenant novo.

CREATE OR REPLACE FUNCTION public.fn_audit_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  RECORD;
  v_diff   RECORD;
  v_fields TEXT[] := ARRAY['name', 'logo_url'];
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_diff
      FROM public.fn_audit_jsonb_diff('{}'::jsonb, to_jsonb(NEW), v_fields);

    INSERT INTO public.client_events (
      client_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.id, 'created',
      NULL, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
    );

    RETURN NULL;
  END IF;

  SELECT * INTO v_diff
    FROM public.fn_audit_jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), v_fields);

  IF v_diff.new_diff = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.client_events (
    client_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    NEW.id, 'updated',
    v_diff.old_diff, v_diff.new_diff, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

-- Sem cláusula WHEN, pela mesma justificativa da SEÇÃO 2.

DROP TRIGGER IF EXISTS trg_audit_client_insert ON public.clients;
CREATE TRIGGER trg_audit_client_insert
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_client();

DROP TRIGGER IF EXISTS trg_audit_client_update ON public.clients;
CREATE TRIGGER trg_audit_client_update
  AFTER UPDATE OF name, logo_url
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_client();

DROP TRIGGER IF EXISTS trg_client_events_immutable ON public.client_events;
CREATE TRIGGER trg_client_events_immutable
  BEFORE UPDATE ON public.client_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_events_immutable();


-- ============================================================
-- Reload do schema PostgREST
-- ============================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- Conferência pós-aplicação (comentada — rodar no SQL Editor)
-- ============================================================
-- Conferência estrutural completa: supabase/diagnostics/check-audit-events-phase3.sql
--
-- -- 12 gatilhos (8 de captura + 4 de imutabilidade):
-- SELECT c.relname AS tabela, t.tgname AS gatilho, pg_get_triggerdef(t.oid) AS definicao
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND NOT t.tgisinternal
--   AND t.tgname IN (
--     'trg_audit_tire_insert',             'trg_audit_tire_update',
--     'trg_audit_shipper_insert',          'trg_audit_shipper_update',
--     'trg_audit_operational_unit_insert', 'trg_audit_operational_unit_update',
--     'trg_audit_client_insert',           'trg_audit_client_update',
--     'trg_tire_events_immutable',         'trg_shipper_events_immutable',
--     'trg_operational_unit_events_immutable', 'trg_client_events_immutable'
--   )
-- ORDER BY c.relname, t.tgname;
-- -- Esperado: 12 linhas. Os 4 gatilhos de UPDATE NÃO têm cláusula WHEN — a
-- -- guarda de diff vazio vive dentro da função (ver nota da SEÇÃO 2).
--
-- -- 4 policies, todas de SELECT:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'tire_events', 'shipper_events',
--     'operational_unit_events', 'client_events'
--   )
-- ORDER BY tablename, policyname;
-- -- Esperado: 4 linhas, cmd = 'SELECT' em todas.
--
-- -- 7 índices (client_events tem só um, por identidade de papéis):
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'tire_events', 'shipper_events',
--     'operational_unit_events', 'client_events'
--   )
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
-- -- Esperado: 7 linhas.
--
-- -- Pré-requisito da Fase 1 (escape hatch da resolução de autoria):
-- SELECT * FROM public.fn_audit_actor();
-- -- Esperado: actor_id = NULL, actor_name = 'service_role'.


-- ============================================================
-- ROLLBACK EXATO — comentado, NUNCA executável automaticamente
-- ============================================================
-- Seccionado por entidade, na ordem inversa da criação (Seção 5 → 4 → 3 → 2 →
-- 1); dentro de cada seção: gatilhos → função → policy → tabela.
-- Desfaz a migration por completo. Como não houve backfill, nenhum dado de
-- negócio é perdido: apenas o histórico de eventos acumulado desde a
-- aplicação. Rodar as seções na ordem em que aparecem abaixo.
--
-- ⚠️ ATENÇÃO: este rollback NÃO derruba public.fn_audit_actor() nem
-- public.fn_audit_events_immutable(). As duas pertencem à Fase 1, que
-- permanece em produção — dropá-las aqui derrubaria junto a auditoria das sete
-- tabelas das Fases 1 e 2.

-- ─── Rollback SEÇÃO 5 — client_events ─────────────────────────
-- DROP TRIGGER IF EXISTS trg_client_events_immutable ON public.client_events;
-- DROP TRIGGER IF EXISTS trg_audit_client_update ON public.clients;
-- DROP TRIGGER IF EXISTS trg_audit_client_insert ON public.clients;
-- DROP FUNCTION IF EXISTS public.fn_audit_client();
-- DROP POLICY IF EXISTS "client_events_select" ON public.client_events;
-- DROP TABLE IF EXISTS public.client_events;

-- ─── Rollback SEÇÃO 4 — operational_unit_events ───────────────
-- DROP TRIGGER IF EXISTS trg_operational_unit_events_immutable ON public.operational_unit_events;
-- DROP TRIGGER IF EXISTS trg_audit_operational_unit_update ON public.operational_units;
-- DROP TRIGGER IF EXISTS trg_audit_operational_unit_insert ON public.operational_units;
-- DROP FUNCTION IF EXISTS public.fn_audit_operational_unit();
-- DROP POLICY IF EXISTS "operational_unit_events_select" ON public.operational_unit_events;
-- DROP TABLE IF EXISTS public.operational_unit_events;

-- ─── Rollback SEÇÃO 3 — shipper_events ────────────────────────
-- DROP TRIGGER IF EXISTS trg_shipper_events_immutable ON public.shipper_events;
-- DROP TRIGGER IF EXISTS trg_audit_shipper_update ON public.shippers;
-- DROP TRIGGER IF EXISTS trg_audit_shipper_insert ON public.shippers;
-- DROP FUNCTION IF EXISTS public.fn_audit_shipper();
-- DROP POLICY IF EXISTS "shipper_events_select" ON public.shipper_events;
-- DROP TABLE IF EXISTS public.shipper_events;

-- ─── Rollback SEÇÃO 2 — tire_events ───────────────────────────
-- DROP TRIGGER IF EXISTS trg_tire_events_immutable ON public.tire_events;
-- DROP TRIGGER IF EXISTS trg_audit_tire_update ON public.tires;
-- DROP TRIGGER IF EXISTS trg_audit_tire_insert ON public.tires;
-- DROP FUNCTION IF EXISTS public.fn_audit_tire();
-- DROP POLICY IF EXISTS "tire_events_select" ON public.tire_events;
-- DROP TABLE IF EXISTS public.tire_events;

-- ─── Rollback SEÇÃO 1 — função auxiliar de diff ───────────────
-- Só depois de derrubar as quatro seções acima: as funções de captura
-- dependem dela. Nasce nesta fase, então pode ser derrubada com segurança.
-- DROP FUNCTION IF EXISTS public.fn_audit_jsonb_diff(JSONB, JSONB, TEXT[]);

-- NOTIFY pgrst, 'reload schema';
