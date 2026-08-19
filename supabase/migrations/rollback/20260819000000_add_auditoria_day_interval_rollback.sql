ALTER TABLE public.checklist_day_intervals
  DROP COLUMN IF EXISTS auditoria_day_interval;

NOTIFY pgrst, 'reload schema';
