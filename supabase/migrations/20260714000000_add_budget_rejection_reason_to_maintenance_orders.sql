-- Motivo da reprovação de orçamento (exibido na Manutenção).
-- Coluna aditiva e anulável; sem backfill. Não altera RLS existente.
ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS budget_rejection_reason text;
