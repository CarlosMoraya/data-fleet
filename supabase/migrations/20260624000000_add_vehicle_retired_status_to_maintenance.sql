-- Migration: Adiciona status 'Veículo retirado' às ordens de serviço de manutenção
-- e converte actual_exit_date de DATE para TIMESTAMPTZ
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD (Dev: vvbnbzzhpiksacqudmfu)

-- Remove CHECK existente
ALTER TABLE public.maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_status_check;

-- Recria com novo status
ALTER TABLE public.maintenance_orders
  ADD CONSTRAINT maintenance_orders_status_check
  CHECK (status IN (
    'Aguardando orçamento',
    'Aguardando aprovação',
    'Orçamento aprovado',
    'Serviço em execução',
    'Concluído',
    'Veículo retirado',
    'Cancelado'
  ));

-- Converte coluna de DATE para TIMESTAMPTZ
ALTER TABLE public.maintenance_orders
  ALTER COLUMN actual_exit_date TYPE TIMESTAMPTZ
  USING CASE
    WHEN actual_exit_date IS NULL THEN NULL
    ELSE actual_exit_date::DATE::TIMESTAMPTZ
  END;