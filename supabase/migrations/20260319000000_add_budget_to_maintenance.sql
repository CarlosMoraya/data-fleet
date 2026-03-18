-- ============================================================
-- Migration: Add budget/quote flow to maintenance_orders
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- 0. Ampliar CHECK constraint de status para incluir novo valor
--    (PostgreSQL não suporta ALTER CHECK, é necessário drop + recreate)
ALTER TABLE public.maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_status_check;
ALTER TABLE public.maintenance_orders
  ADD CONSTRAINT maintenance_orders_status_check
  CHECK (status IN (
    'Aguardando orçamento',
    'Aguardando aprovação',
    'Orçamento aprovado',
    'Serviço em execução',
    'Concluído'
  ));

-- 1. Colunas novas em maintenance_orders
ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS current_km         NUMERIC(10,0) NULL,
  ADD COLUMN IF NOT EXISTS budget_pdf_url     TEXT          NULL,
  ADD COLUMN IF NOT EXISTS budget_status      VARCHAR(20)  NOT NULL DEFAULT 'sem_orcamento'
    CHECK (budget_status IN ('sem_orcamento','pendente','aprovado','reprovado')),
  ADD COLUMN IF NOT EXISTS budget_reviewed_by UUID         NULL REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS budget_reviewed_at TIMESTAMPTZ  NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_budget_status
  ON public.maintenance_orders(client_id, budget_status)
  WHERE budget_status = 'pendente';

-- 2. Nova tabela de itens de orçamento
CREATE TABLE IF NOT EXISTS public.maintenance_budget_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_order_id UUID NOT NULL REFERENCES public.maintenance_orders(id) ON DELETE CASCADE,
  client_id            UUID NOT NULL REFERENCES public.clients(id)            ON DELETE CASCADE,
  item_name            TEXT NOT NULL,
  system               TEXT,
  quantity             NUMERIC(10,2) NOT NULL DEFAULT 1,
  value                NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maintenance_budget_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_budget_items_order
  ON public.maintenance_budget_items(maintenance_order_id);

-- 3. RLS — Fleet Assistant+ (rank 3+) do próprio tenant OU Admin Master
CREATE POLICY "budget_items_select" ON public.maintenance_budget_items FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "budget_items_insert" ON public.maintenance_budget_items FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "budget_items_update" ON public.maintenance_budget_items FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "budget_items_delete" ON public.maintenance_budget_items FOR DELETE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );
