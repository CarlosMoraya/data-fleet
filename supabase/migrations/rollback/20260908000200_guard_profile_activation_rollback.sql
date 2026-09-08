-- Rollback de 20260908000200_guard_profile_activation.sql

DROP TRIGGER IF EXISTS trg_guard_profile_activation ON public.profiles;
DROP FUNCTION IF EXISTS public.profile_activation_denial_reason(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.fn_guard_profile_activation();
DROP FUNCTION IF EXISTS public.fn_profile_activation_denial_reason(UUID, UUID, BOOLEAN);

NOTIFY pgrst, 'reload schema';
