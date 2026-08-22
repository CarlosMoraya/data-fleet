-- ============================================================
-- MIGRATION: budget_reopen_and_review_ledger
-- Data: 2026-08-23
-- Descrição: acrescenta o estado `reaberto` a maintenance_orders.budget_status
--            e cria o livro-razão append-only de decisões de orçamento
--            (public.maintenance_budget_reviews).
--
--            Um orçamento REPROVADO passa a poder ser reaberto por papéis do
--            cliente, mediante justificativa obrigatória. A reabertura devolve
--            a OS ao estado editável ('Aguardando orçamento'); o salvamento
--            seguinte a reenvia para a fila de aprovação.
--
--            Orçamento APROVADO continua absolutamente imutável: os gatilhos
--            trg_lock_approved_budget_items e
--            trg_lock_approved_budget_order_columns (migrations 20260821000000
--            e 20260822000000) NÃO são tocados por esta migration, e o gatilho
--            novo trg_guard_budget_reopen adiciona uma defesa redundante que
--            recusa qualquer transição para 'reaberto' vinda de um estado
--            diferente de 'reprovado'.
--
--            O papel Workshop não aparece em nenhuma policy deste ledger e
--            continua reenviando orçamento pelo caminho de hoje (upload de PDF
--            → budget_status = 'pendente'), guardado por
--            trg_enforce_workshop_maintenance_columns.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ─── 1.1 Ampliar o CHECK de budget_status ─────────────────────
-- O constraint veio inline na migration 20260319000000, com nome gerado pelo
-- PostgreSQL. Descobrimos o nome real antes de recriá-lo.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.maintenance_orders'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%budget_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.maintenance_orders DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.maintenance_orders
  ADD CONSTRAINT maintenance_orders_budget_status_check
  CHECK (budget_status IN ('sem_orcamento','pendente','aprovado','reprovado','reaberto'));

-- ─── 1.2 Livro-razão de decisões de orçamento ─────────────────

CREATE TABLE IF NOT EXISTS public.maintenance_budget_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  maintenance_order_id UUID NOT NULL REFERENCES public.maintenance_orders(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('aprovado','reprovado','reaberto')),
  reason TEXT,
  budget_total NUMERIC(12,2),
  decided_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_budget_reviews_order
  ON public.maintenance_budget_reviews(maintenance_order_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_budget_reviews_client
  ON public.maintenance_budget_reviews(client_id);

-- Justificativa obrigatória para reprovação e reabertura; NULL para aprovação.
ALTER TABLE public.maintenance_budget_reviews
  DROP CONSTRAINT IF EXISTS maintenance_budget_reviews_reason_required;
ALTER TABLE public.maintenance_budget_reviews
  ADD CONSTRAINT maintenance_budget_reviews_reason_required
  CHECK (decision = 'aprovado' OR (reason IS NOT NULL AND btrim(reason) <> ''));

-- ─── 1.3 Gatilho de imutabilidade (append-only de verdade) ────

CREATE OR REPLACE FUNCTION public.fn_budget_reviews_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'BUDGET_REVIEW_LEDGER_IS_APPEND_ONLY' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_reviews_append_only ON public.maintenance_budget_reviews;
CREATE TRIGGER trg_budget_reviews_append_only
  BEFORE UPDATE OR DELETE ON public.maintenance_budget_reviews
  FOR EACH ROW EXECUTE FUNCTION public.fn_budget_reviews_append_only();

-- ─── 1.4 Gatilho que barra a reabertura indevida ──────────────
-- Redundância deliberada (defesa em profundidade):
-- trg_lock_approved_budget_order_columns já recusa qualquer mudança de
-- budget_status quando OLD.budget_status = 'aprovado'. Este gatilho cobre
-- também 'pendente' → 'reaberto' e 'sem_orcamento' → 'reaberto'.
-- Sem escape hatch: reparo por SQL Editor deve passar por 'reprovado' antes de
-- 'reaberto', ou ajustar budget_status direto para o valor final desejado.

CREATE OR REPLACE FUNCTION public.fn_guard_budget_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.budget_status = 'reaberto' AND OLD.budget_status IS DISTINCT FROM 'reprovado' THEN
    RAISE EXCEPTION 'ONLY_REJECTED_BUDGET_CAN_BE_REOPENED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_budget_reopen ON public.maintenance_orders;
CREATE TRIGGER trg_guard_budget_reopen
  BEFORE UPDATE OF budget_status ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_budget_reopen();

-- ─── 1.5 RLS ──────────────────────────────────────────────────
-- Allowlist literal de papéis, sem rank. O papel 'Workshop' não aparece em
-- nenhuma policy. Não há policy de UPDATE nem de DELETE: a ausência delas,
-- somada ao gatilho 1.3, torna o ledger imutável.

ALTER TABLE public.maintenance_budget_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_budget_reviews_select" ON public.maintenance_budget_reviews;
CREATE POLICY "maintenance_budget_reviews_select"
  ON public.maintenance_budget_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = maintenance_budget_reviews.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director','Financeiro')
          )
        )
    )
  );

DROP POLICY IF EXISTS "maintenance_budget_reviews_insert" ON public.maintenance_budget_reviews;
CREATE POLICY "maintenance_budget_reviews_insert"
  ON public.maintenance_budget_reviews
  FOR INSERT WITH CHECK (
    decided_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = maintenance_budget_reviews.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

-- ─── 1.6 Backfill das decisões já existentes ──────────────────
-- Aditivo e idempotente: o NOT EXISTS impede duplicação em reexecução.
-- Não altera nenhuma coluna de maintenance_orders — approved_cost intocado.

INSERT INTO public.maintenance_budget_reviews
  (client_id, maintenance_order_id, decision, reason, budget_total, decided_by, decided_at)
SELECT
  mo.client_id,
  mo.id,
  mo.budget_status,
  CASE WHEN mo.budget_status = 'reprovado'
       THEN COALESCE(NULLIF(btrim(mo.budget_rejection_reason), ''), 'Motivo não registrado (migrado)')
       ELSE NULL END,
  mo.approved_cost,
  mo.budget_reviewed_by,
  COALESCE(mo.budget_reviewed_at, mo.created_at)
FROM public.maintenance_orders mo
WHERE mo.budget_status IN ('aprovado','reprovado')
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_budget_reviews r
    WHERE r.maintenance_order_id = mo.id
  );

-- ─── 1.7 Reload do schema PostgREST ───────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── Conferência pós-aplicação (Etapa 8.1) ────────────────────
-- SELECT 'tabela' AS objeto, to_regclass('public.maintenance_budget_reviews')::text AS resultado
-- UNION ALL
-- SELECT 'rls_habilitado', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.maintenance_budget_reviews'::regclass)
-- UNION ALL
-- SELECT 'policies', (SELECT count(*)::text FROM pg_policy WHERE polrelid = 'public.maintenance_budget_reviews'::regclass)
-- UNION ALL
-- SELECT 'gatilho_append_only', (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'trg_budget_reviews_append_only')
-- UNION ALL
-- SELECT 'gatilho_guard_reopen', (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'trg_guard_budget_reopen')
-- UNION ALL
-- SELECT 'check_budget_status', (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'maintenance_orders_budget_status_check')
-- UNION ALL
-- SELECT 'eventos_backfill', (SELECT count(*)::text FROM public.maintenance_budget_reviews);
--
-- Esperado: tabela existente, rls_habilitado = true, 2 policies, 1 gatilho de
-- cada, o CHECK contendo 'reaberto', e eventos_backfill igual ao total de OS
-- com budget_status em ('aprovado','reprovado') no ambiente.

-- ─── Rollback exato ───────────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_guard_budget_reopen ON public.maintenance_orders;
-- DROP FUNCTION IF EXISTS public.fn_guard_budget_reopen();
-- DROP TRIGGER IF EXISTS trg_budget_reviews_append_only ON public.maintenance_budget_reviews;
-- DROP FUNCTION IF EXISTS public.fn_budget_reviews_append_only();
-- DROP TABLE IF EXISTS public.maintenance_budget_reviews;
-- UPDATE public.maintenance_orders SET budget_status = 'reprovado' WHERE budget_status = 'reaberto';
-- ALTER TABLE public.maintenance_orders DROP CONSTRAINT IF EXISTS maintenance_orders_budget_status_check;
-- ALTER TABLE public.maintenance_orders
--   ADD CONSTRAINT maintenance_orders_budget_status_check
--   CHECK (budget_status IN ('sem_orcamento','pendente','aprovado','reprovado'));
-- NOTIFY pgrst, 'reload schema';
