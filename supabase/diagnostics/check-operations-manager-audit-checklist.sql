-- RESULTADO ESPERADO: exatamente 9 linhas.
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('checklist_templates', 'checklist_items', 'checklists', 'checklist_responses')
  AND policyname LIKE '%operations_manager%'
ORDER BY tablename, policyname;

-- RESULTADO ESPERADO: veiculos_alcancaveis menor ou igual a veiculos_do_tenant e igual a veiculos_nos_escopos.
SELECT
  p.id AS profile_id,
  p.name AS profile_name,
  p.client_id,
  COUNT(v.id) AS veiculos_do_tenant,
  COUNT(v.id) FILTER (
    WHERE public.operations_manager_can_access_vehicle_id(p.id, v.id)
  ) AS veiculos_alcancaveis,
  COUNT(v.id) FILTER (
    WHERE v.shipper_id IS NOT NULL
      AND v.operational_unit_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profile_shipper_scopes pss
        WHERE pss.profile_id = p.id
          AND pss.shipper_id = v.shipper_id
      )
      AND EXISTS (
        SELECT 1
        FROM public.profile_operational_unit_scopes pous
        WHERE pous.profile_id = p.id
          AND pous.operational_unit_id = v.operational_unit_id
      )
  ) AS veiculos_nos_escopos,
  COUNT(v.id) FILTER (
    WHERE public.operations_manager_can_access_vehicle_id(p.id, v.id)
  ) <= COUNT(v.id) AS alcance_dentro_do_tenant,
  COUNT(v.id) FILTER (
    WHERE public.operations_manager_can_access_vehicle_id(p.id, v.id)
  ) = COUNT(v.id) FILTER (
    WHERE v.shipper_id IS NOT NULL
      AND v.operational_unit_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profile_shipper_scopes pss
        WHERE pss.profile_id = p.id
          AND pss.shipper_id = v.shipper_id
      )
      AND EXISTS (
        SELECT 1
        FROM public.profile_operational_unit_scopes pous
        WHERE pous.profile_id = p.id
          AND pous.operational_unit_id = v.operational_unit_id
      )
  ) AS alcance_confere_com_escopos
FROM public.profiles p
LEFT JOIN public.vehicles v ON v.client_id = p.client_id
WHERE p.role = 'Operations Manager'
GROUP BY p.id, p.name, p.client_id
ORDER BY p.name, p.id;

-- RESULTADO ESPERADO: auditorias_visiveis contabiliza apenas Auditoria e contextos_fora_de_auditoria e zero para todos os perfis.
SELECT
  p.id AS profile_id,
  p.name AS profile_name,
  COUNT(visible_checklists.checklist_id) AS auditorias_visiveis,
  COUNT(visible_checklists.checklist_id) FILTER (
    WHERE visible_checklists.context IS DISTINCT FROM 'Auditoria'
  ) AS contextos_fora_de_auditoria
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT c.id AS checklist_id, t.context
  FROM public.checklists c
  JOIN public.checklist_templates t ON t.id = c.template_id
  WHERE c.client_id = p.client_id
    AND t.context = 'Auditoria'
    AND public.operations_manager_can_access_vehicle_id(p.id, c.vehicle_id)
) AS visible_checklists ON TRUE
WHERE p.role = 'Operations Manager'
GROUP BY p.id, p.name
ORDER BY p.name, p.id;
