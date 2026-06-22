CREATE OR REPLACE VIEW public.vehicle_odometer_effective_readings
WITH (security_invoker = true) AS
  SELECT
    c.id                                       AS checklist_id,
    c.vehicle_id                               AS vehicle_id,
    c.client_id                                AS client_id,
    c.completed_at                             AS reading_at,
    c.odometer_km                              AS original_km,
    COALESCE(corr.corrected_km, c.odometer_km) AS effective_km,
    (corr.id IS NOT NULL)                      AS is_corrected,
    corr.reason                                AS correction_reason,
    corr.corrected_by                          AS corrected_by,
    corr.corrected_at                          AS corrected_at,
    t.context                                  AS source_context,
    (c.odometer_photo_url IS NOT NULL)         AS has_evidence
  FROM public.checklists c
  LEFT JOIN public.checklist_templates t ON t.id = c.template_id
  LEFT JOIN LATERAL (
    SELECT oc.id, oc.corrected_km, oc.reason, oc.corrected_by, oc.corrected_at
    FROM public.vehicle_odometer_corrections oc
    WHERE oc.checklist_id = c.id
    ORDER BY oc.corrected_at DESC
    LIMIT 1
  ) corr ON true
  WHERE c.status = 'completed'
    AND c.vehicle_id IS NOT NULL
    AND c.odometer_km IS NOT NULL;

GRANT SELECT ON public.vehicle_odometer_effective_readings TO authenticated;
NOTIFY pgrst, 'reload schema';
