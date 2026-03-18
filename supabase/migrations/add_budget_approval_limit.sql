-- Adiciona coluna de limite de aprovação de orçamentos para usuários
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS budget_approval_limit NUMERIC NOT NULL DEFAULT 0;
