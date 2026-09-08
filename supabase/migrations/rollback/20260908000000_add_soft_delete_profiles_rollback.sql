-- Rollback de 20260908000000_add_soft_delete_profiles.sql

DROP INDEX IF EXISTS public.idx_profiles_active;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS inactivated_by,
  DROP COLUMN IF EXISTS inactivated_at,
  DROP COLUMN IF EXISTS active;

NOTIFY pgrst, 'reload schema';
