ALTER TABLE public.checklist_day_intervals
  ADD COLUMN IF NOT EXISTS odometer_update_day_interval INTEGER NULL,
  ADD COLUMN IF NOT EXISTS odometer_km_tolerance_per_day INTEGER NULL;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS odometer_photo_url TEXT NULL;

NOTIFY pgrst, 'reload schema';
