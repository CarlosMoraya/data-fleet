-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (dev primeiro)
-- Soft delete em profiles, espelhando 20260701000000_add_soft_delete_vehicles_drivers.sql.
-- 100% aditiva: sem backfill, sem UPDATE, sem alteração de policy.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);

NOTIFY pgrst, 'reload schema';
