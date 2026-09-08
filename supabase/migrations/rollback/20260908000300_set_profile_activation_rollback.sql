-- Rollback de 20260908000300_set_profile_activation.sql

DROP FUNCTION IF EXISTS public.set_profile_activation(UUID, BOOLEAN);

NOTIFY pgrst, 'reload schema';
