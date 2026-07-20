DROP TRIGGER IF EXISTS trg_stamp_vehicle_link_divergence ON public.checklists;
DROP TRIGGER IF EXISTS trg_stamp_vehicle_link_divergence ON public.tire_inspections;

DROP FUNCTION IF EXISTS public.stamp_vehicle_link_divergence();
DROP FUNCTION IF EXISTS public.evaluate_vehicle_link_divergence(uuid, uuid);
DROP FUNCTION IF EXISTS public.list_vehicles_for_checklist_selection();
DROP FUNCTION IF EXISTS public.get_vehicle_tire_inspection_config(uuid);

DROP INDEX IF EXISTS public.idx_checklists_vehicle_link_divergence;
DROP INDEX IF EXISTS public.idx_tire_inspections_vehicle_link_divergence;

ALTER TABLE public.checklists
  DROP COLUMN IF EXISTS vehicle_link_divergence_reasons,
  DROP COLUMN IF EXISTS vehicle_link_assigned_driver_id,
  DROP COLUMN IF EXISTS vehicle_link_executor_vehicle_id;

ALTER TABLE public.tire_inspections
  DROP COLUMN IF EXISTS vehicle_link_divergence_reasons,
  DROP COLUMN IF EXISTS vehicle_link_assigned_driver_id,
  DROP COLUMN IF EXISTS vehicle_link_executor_vehicle_id;

ALTER TABLE public.checklist_day_intervals
  DROP COLUMN IF EXISTS enforce_driver_vehicle_link;

NOTIFY pgrst, 'reload schema';
