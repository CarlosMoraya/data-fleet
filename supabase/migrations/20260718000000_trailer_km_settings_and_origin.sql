-- FASE 3 (Etapa 3.1): Km da carreta — setting por cliente + origem das leituras
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV primeiro)

-- 1) Setting por cliente: hubodômetro × acumulado por engate
CREATE TABLE IF NOT EXISTS public.vehicle_km_source_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL UNIQUE REFERENCES public.clients(id),
  trailer_km_mode  text NOT NULL DEFAULT 'coupling_accumulated'
                     CHECK (trailer_km_mode IN ('hubodometer', 'coupling_accumulated')),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.vehicle_km_source_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: rank >= 3 (Fleet Assistant+) do tenant OU Admin Master
DROP POLICY IF EXISTS vehicle_km_source_settings_select ON public.vehicle_km_source_settings;
CREATE POLICY vehicle_km_source_settings_select ON public.vehicle_km_source_settings
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- INSERT/UPDATE: rank >= 6 (Coordinator+) do tenant OU Admin Master
DROP POLICY IF EXISTS vehicle_km_source_settings_insert ON public.vehicle_km_source_settings;
CREATE POLICY vehicle_km_source_settings_insert ON public.vehicle_km_source_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 6
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

DROP POLICY IF EXISTS vehicle_km_source_settings_update ON public.vehicle_km_source_settings;
CREATE POLICY vehicle_km_source_settings_update ON public.vehicle_km_source_settings
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 6
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  )
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 6
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- 2) Origem das leituras: recria a view acrescentando a coluna computada `origin`.
--    Precedente: `source_context` (20260622010002_odometer_effective_readings_origin.sql).
--    origin = 'hubodometer' quando a leitura vem do contexto Atualização de Hodômetro
--    em um veículo do tipo implemento — caso contrário 'vehicle'.
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
    (c.odometer_photo_url IS NOT NULL)         AS has_evidence,
    CASE
      WHEN t.context = 'Atualização de Hodômetro'
       AND v.type IN ('Semirreboque', 'Reboque', 'Dolly')
      THEN 'hubodometer'
      ELSE 'vehicle'
    END                                        AS origin
  FROM public.checklists c
  LEFT JOIN public.checklist_templates t ON t.id = c.template_id
  LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
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

-- ROLLBACK
-- CREATE OR REPLACE VIEW public.vehicle_odometer_effective_readings
-- WITH (security_invoker = true) AS
--   SELECT
--     c.id                                       AS checklist_id,
--     c.vehicle_id                               AS vehicle_id,
--     c.client_id                                AS client_id,
--     c.completed_at                             AS reading_at,
--     c.odometer_km                              AS original_km,
--     COALESCE(corr.corrected_km, c.odometer_km) AS effective_km,
--     (corr.id IS NOT NULL)                      AS is_corrected,
--     corr.reason                                AS correction_reason,
--     corr.corrected_by                          AS corrected_by,
--     corr.corrected_at                          AS corrected_at,
--     t.context                                  AS source_context,
--     (c.odometer_photo_url IS NOT NULL)         AS has_evidence
--   FROM public.checklists c
--   LEFT JOIN public.checklist_templates t ON t.id = c.template_id
--   LEFT JOIN LATERAL (
--     SELECT oc.id, oc.corrected_km, oc.reason, oc.corrected_by, oc.corrected_at
--     FROM public.vehicle_odometer_corrections oc
--     WHERE oc.checklist_id = c.id
--     ORDER BY oc.corrected_at DESC
--     LIMIT 1
--   ) corr ON true
--   WHERE c.status = 'completed'
--     AND c.vehicle_id IS NOT NULL
--     AND c.odometer_km IS NOT NULL;
-- GRANT SELECT ON public.vehicle_odometer_effective_readings TO authenticated;
-- DROP TABLE IF EXISTS public.vehicle_km_source_settings CASCADE;
-- NOTIFY pgrst, 'reload schema';
