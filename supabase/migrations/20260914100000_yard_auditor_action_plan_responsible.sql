-- ============================================================
-- MIGRATION: yard_auditor_action_plan_responsible
-- Data: 2026-09-14
-- O Yard Auditor vê e trabalha SOMENTE os planos de ação da própria empresa
-- em que é o responsável (responsible_id = auth.uid()).
--   - Pode: pending → in_progress (assumir, claimed_by = ele)
--           in_progress → awaiting_conclusion (notas + evidência)
--   - Não pode: criar, excluir, reatribuir, aprovar, rejeitar, editar
--     qualquer outra coluna, mexer em plano concluído/cancelado.
-- As 4 policies existentes NÃO são alteradas: o acesso novo é aditivo.
-- Em 2026-09-14: 0 planos com Auditor responsável em DEV e em PROD.
-- ============================================================

-- 1) Leitura: só os planos em que o Auditor é o responsável, no próprio tenant
DROP POLICY IF EXISTS "action_plans_select_yard_auditor_responsible" ON public.action_plans;
CREATE POLICY "action_plans_select_yard_auditor_responsible" ON public.action_plans
  FOR SELECT TO authenticated
  USING (
    responsible_id = auth.uid()
    AND client_id = public.get_my_client_id()
    AND public.get_my_role() = 'Yard Auditor'
  );

-- 2) Alteração: mesmo recorte na linha antiga e na nova
DROP POLICY IF EXISTS "action_plans_update_yard_auditor_responsible" ON public.action_plans;
CREATE POLICY "action_plans_update_yard_auditor_responsible" ON public.action_plans
  FOR UPDATE TO authenticated
  USING (
    responsible_id = auth.uid()
    AND client_id = public.get_my_client_id()
    AND public.get_my_role() = 'Yard Auditor'
  )
  WITH CHECK (
    responsible_id = auth.uid()
    AND client_id = public.get_my_client_id()
    AND public.get_my_role() = 'Yard Auditor'
  );

-- 3) Gatilho: o que o Auditor pode mudar, e em qual transição.
--    Só age quando quem altera é Yard Auditor. auth.uid() NULL (service_role /
--    SQL Editor) passa — escape hatch padrão do projeto para reparo manual.
CREATE OR REPLACE FUNCTION public.fn_enforce_yard_auditor_action_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed_keys CONSTANT TEXT[] := ARRAY[
    'status', 'claimed_by', 'claimed_at',
    'conclusion_evidence_url', 'completion_notes', 'updated_at'
  ];
  v_evidence_prefix TEXT;
BEGIN
  IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'Yard Auditor' THEN
    RETURN NEW;
  END IF;

  IF OLD.responsible_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'YARD_AUDITOR_NOT_RESPONSIBLE' USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - v_allowed_keys) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed_keys) THEN
    RAISE EXCEPTION 'YARD_AUDITOR_FIELD_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;

  v_evidence_prefix := OLD.client_id::text || '/action-plans/' || OLD.id::text || '/evidence.';

  IF OLD.status = 'pending' AND NEW.status = 'in_progress' THEN
    IF NEW.claimed_by IS DISTINCT FROM auth.uid()
       OR NEW.claimed_at IS NULL
       OR NEW.conclusion_evidence_url IS DISTINCT FROM OLD.conclusion_evidence_url
       OR NEW.completion_notes IS DISTINCT FROM OLD.completion_notes THEN
      RAISE EXCEPTION 'YARD_AUDITOR_INVALID_CLAIM' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'in_progress' AND NEW.status = 'awaiting_conclusion' THEN
    IF NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
       OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
      RAISE EXCEPTION 'YARD_AUDITOR_INVALID_CONCLUSION' USING ERRCODE = '42501';
    END IF;
    IF NOT (
      NEW.conclusion_evidence_url IS NOT DISTINCT FROM OLD.conclusion_evidence_url
      OR COALESCE(starts_with(NEW.conclusion_evidence_url, v_evidence_prefix), false)
    ) THEN
      RAISE EXCEPTION 'YARD_AUDITOR_INVALID_EVIDENCE_PATH' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'YARD_AUDITOR_TRANSITION_NOT_ALLOWED' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_yard_auditor_action_plan_update ON public.action_plans;
CREATE TRIGGER trg_enforce_yard_auditor_action_plan_update
  BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_yard_auditor_action_plan_update();

-- 4) Nomes para exibição: o Auditor não lê profiles/checklists de terceiros.
--    Projeção mínima (só nomes/títulos), autorização reimposta aqui dentro.
CREATE OR REPLACE FUNCTION public.get_yard_auditor_action_plan_labels(p_action_plan_ids UUID[])
RETURNS TABLE (
  action_plan_id    UUID,
  reported_by_name  TEXT,
  assigned_by_name  TEXT,
  claimed_by_name   TEXT,
  completed_by_name TEXT,
  responsible_name  TEXT,
  template_name     TEXT,
  item_title        TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ap.id,
    reporter.name,
    assigner.name,
    claimer.name,
    completer.name,
    responsible.name,
    template.name,
    item.title
  FROM public.action_plans ap
  LEFT JOIN public.profiles reporter    ON reporter.id    = ap.reported_by
  LEFT JOIN public.profiles assigner    ON assigner.id    = ap.assigned_by
  LEFT JOIN public.profiles claimer     ON claimer.id     = ap.claimed_by
  LEFT JOIN public.profiles completer   ON completer.id   = ap.completed_by
  LEFT JOIN public.profiles responsible ON responsible.id = ap.responsible_id
  LEFT JOIN public.checklists checklist ON checklist.id   = ap.checklist_id
  LEFT JOIN public.checklist_templates template ON template.id = checklist.template_id
  LEFT JOIN public.checklist_responses response ON response.id = ap.checklist_response_id
  LEFT JOIN public.checklist_items item ON item.id = response.item_id
  WHERE ap.id = ANY (p_action_plan_ids)
    AND ap.responsible_id = auth.uid()
    AND ap.client_id = public.get_my_client_id()
    AND public.get_my_role() = 'Yard Auditor';
$$;

REVOKE ALL ON FUNCTION public.get_yard_auditor_action_plan_labels(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_yard_auditor_action_plan_labels(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_yard_auditor_action_plan_labels(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
