-- Adiciona a parametrização de intervalo de dias do contexto Auditoria.
-- NULL = contexto não parametrizado (estado inicial de todos os tenants).
-- Aditiva: nenhuma policy, índice ou consumidor existente é alterado.
ALTER TABLE public.checklist_day_intervals
  ADD COLUMN IF NOT EXISTS auditoria_day_interval INTEGER NULL;

NOTIFY pgrst, 'reload schema';
