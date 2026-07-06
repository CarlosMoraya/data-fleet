-- Adiciona status do motivo de ausência/presença de GPS na confirmação do KM do checklist.
-- Aditiva e não-destrutiva: registros antigos permanecem NULL (tratados como "sem informação").
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS location_status TEXT;

ALTER TABLE public.checklists
  DROP CONSTRAINT IF EXISTS checklists_location_status_check;

ALTER TABLE public.checklists
  ADD CONSTRAINT checklists_location_status_check
  CHECK (location_status IN ('captured', 'denied', 'unavailable'));
