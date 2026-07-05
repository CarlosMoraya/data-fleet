-- Reatribuição do responsável de um plano de ação por Coordinator+
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS responsible_updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_updated_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.reassign_action_plan_responsible(
  p_action_plan_id UUID,
  p_responsible_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  caller_client_id UUID;
  plan_client_id UUID;
  plan_status TEXT;
  responsible_client_id UUID;
BEGIN
  SELECT role, client_id INTO caller_role, caller_client_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  SELECT client_id, status INTO plan_client_id, plan_status
  FROM public.action_plans
  WHERE id = p_action_plan_id;

  IF plan_client_id IS NULL THEN
    RAISE EXCEPTION 'action_plan_not_found';
  END IF;

  IF caller_role <> 'Admin Master'
     AND (
       public.role_rank(caller_role) < public.role_rank('Coordinator')
       OR caller_client_id IS DISTINCT FROM plan_client_id
     ) THEN
    RAISE EXCEPTION 'insufficient_privileges';
  END IF;

  IF plan_status NOT IN ('pending', 'in_progress', 'awaiting_conclusion') THEN
    RAISE EXCEPTION 'action_plan_not_reassignable';
  END IF;

  SELECT client_id INTO responsible_client_id
  FROM public.profiles
  WHERE id = p_responsible_id;

  IF responsible_client_id IS DISTINCT FROM plan_client_id THEN
    RAISE EXCEPTION 'responsible_not_in_tenant';
  END IF;

  UPDATE public.action_plans
  SET
    responsible_id = p_responsible_id,
    responsible_updated_by = auth.uid(),
    responsible_updated_at = now(),
    updated_at = now()
  WHERE id = p_action_plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_action_plan_responsible(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
