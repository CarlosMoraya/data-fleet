-- Migration: Adiciona status 'Cancelado' às ordens de serviço de manutenção
-- e colunas de auditoria cancelled_at / cancelled_by_id
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD

-- 1. Recria CHECK de status com 'Cancelado' adicionado
ALTER TABLE public.maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_status_check;

ALTER TABLE public.maintenance_orders
  ADD CONSTRAINT maintenance_orders_status_check
  CHECK (status IN (
    'Aguardando orçamento',
    'Aguardando aprovação',
    'Orçamento aprovado',
    'Serviço em execução',
    'Concluído',
    'Cancelado'
  ));

-- 2. Colunas de auditoria (nullable, não afetam registros existentes)
ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS cancelled_by_id UUID REFERENCES public.profiles(id) DEFAULT NULL;
