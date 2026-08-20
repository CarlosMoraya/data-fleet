-- Records that a checklist issue is being handled by a fleet ticket.
-- Apply this migration manually in the SQL Editor, starting with DEV.

CREATE TABLE IF NOT EXISTS public.checklist_ticket_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL UNIQUE REFERENCES public.checklists(id) ON DELETE CASCADE,
  fleet_ticket_id UUID NOT NULL REFERENCES public.fleet_tickets(id) ON DELETE CASCADE,
  marked_by UUID NOT NULL REFERENCES public.profiles(id),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_ticket_treatments_client
  ON public.checklist_ticket_treatments(client_id);
CREATE INDEX IF NOT EXISTS idx_checklist_ticket_treatments_ticket
  ON public.checklist_ticket_treatments(fleet_ticket_id);

CREATE OR REPLACE FUNCTION public.fn_block_treatment_when_checklist_has_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.action_plans ap
    WHERE ap.checklist_id = NEW.checklist_id
      AND ap.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'CHECKLIST_ALREADY_HAS_ACTION_PLAN' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_treatment_when_checklist_has_plan
  ON public.checklist_ticket_treatments;
CREATE TRIGGER trg_block_treatment_when_checklist_has_plan
  BEFORE INSERT ON public.checklist_ticket_treatments
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_treatment_when_checklist_has_plan();

-- Authorized inverse guard: an existing treatment also prevents a
-- non-cancelled plan from being created or reactivated for the same checklist.
CREATE OR REPLACE FUNCTION public.fn_block_checklist_plan_when_treated_by_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checklist_id IS NOT NULL
    AND NEW.status <> 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.checklist_ticket_treatments ctt
      WHERE ctt.checklist_id = NEW.checklist_id
    )
  THEN
    RAISE EXCEPTION 'CHECKLIST_TREATED_BY_TICKET' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_checklist_plan_when_treated_by_ticket
  ON public.action_plans;
CREATE TRIGGER trg_block_checklist_plan_when_treated_by_ticket
  BEFORE INSERT OR UPDATE OF checklist_id, status ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_checklist_plan_when_treated_by_ticket();

ALTER TABLE public.checklist_ticket_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_ticket_treatments_select"
  ON public.checklist_ticket_treatments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_ticket_treatments.client_id
            AND p.role IN ('Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

CREATE POLICY "checklist_ticket_treatments_insert"
  ON public.checklist_ticket_treatments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_ticket_treatments.client_id
            AND p.role IN ('Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

CREATE POLICY "checklist_ticket_treatments_delete"
  ON public.checklist_ticket_treatments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'Admin Master'
          OR (
            p.client_id = checklist_ticket_treatments.client_id
            AND p.role IN ('Fleet Analyst','Supervisor','Manager','Coordinator','Director')
          )
        )
    )
  );

NOTIFY pgrst, 'reload schema';
