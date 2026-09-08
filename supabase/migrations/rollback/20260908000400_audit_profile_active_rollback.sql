-- Rollback de 20260908000400_audit_profile_active.sql
-- Restaura fn_audit_profile_security() e o gatilho de UPDATE exatamente como
-- estavam em 20260824000000_audit_events_phase1.sql, sem o campo active.

CREATE OR REPLACE FUNCTION public.fn_audit_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor RECORD;
  v_old JSONB := '{}'::jsonb;
  v_new JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.fn_audit_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_security_events (
      client_id, profile_id, event_type,
      old_value, new_value, actor_id, actor_name_snapshot
    ) VALUES (
      NEW.client_id, NEW.id, 'created',
      NULL,
      jsonb_build_object(
        'role',                  NEW.role,
        'client_id',             NEW.client_id,
        'budget_approval_limit', NEW.budget_approval_limit
      ),
      v_actor.actor_id, v_actor.actor_name
    );
    RETURN NULL;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    v_old := v_old || jsonb_build_object('role', OLD.role);
    v_new := v_new || jsonb_build_object('role', NEW.role);
  END IF;

  IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    v_old := v_old || jsonb_build_object('client_id', OLD.client_id);
    v_new := v_new || jsonb_build_object('client_id', NEW.client_id);
  END IF;

  IF OLD.budget_approval_limit IS DISTINCT FROM NEW.budget_approval_limit THEN
    v_old := v_old || jsonb_build_object('budget_approval_limit', OLD.budget_approval_limit);
    v_new := v_new || jsonb_build_object('budget_approval_limit', NEW.budget_approval_limit);
  END IF;

  INSERT INTO public.profile_security_events (
    client_id, profile_id, event_type,
    old_value, new_value, actor_id, actor_name_snapshot
  ) VALUES (
    COALESCE(OLD.client_id, NEW.client_id), NEW.id, 'security_field_changed',
    v_old, v_new, v_actor.actor_id, v_actor.actor_name
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_security_update ON public.profiles;
CREATE TRIGGER trg_audit_profile_security_update
  AFTER UPDATE OF role, client_id, budget_approval_limit ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.role IS DISTINCT FROM NEW.role
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.budget_approval_limit IS DISTINCT FROM NEW.budget_approval_limit
  )
  EXECUTE FUNCTION public.fn_audit_profile_security();

NOTIFY pgrst, 'reload schema';
