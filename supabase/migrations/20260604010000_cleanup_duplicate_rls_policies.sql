-- ============================================================
-- Cleanup de policies RLS duplicadas/legadas
-- ============================================================
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Objetivo:
-- - remover policies antigas que convivem com famílias atuais;
-- - não alterar regras de acesso;
-- - falhar cedo se as policies atuais esperadas não existirem.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_field_settings'
      AND policyname IN ('vfs_select', 'vfs_insert', 'vfs_update')
    GROUP BY schemaname, tablename
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'Abortando cleanup: policies atuais vfs_* não estão completas em public.vehicle_field_settings.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vehicles'
      AND policyname = 'vehicles_select'
  ) THEN
    RAISE EXCEPTION 'Abortando cleanup: policy atual vehicles_select não existe em public.vehicles.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'checklist_templates'
      AND policyname IN (
        'checklist_templates_select',
        'checklist_templates_insert',
        'checklist_templates_update',
        'checklist_templates_delete',
        'templates_select_driver'
      )
    GROUP BY schemaname, tablename
    HAVING count(*) = 5
  ) THEN
    RAISE EXCEPTION 'Abortando cleanup: policies atuais checklist_templates_* ou templates_select_driver não estão completas.';
  END IF;
END $$;

-- vehicle_field_settings: remover família antiga, preservar vfs_*.
DROP POLICY IF EXISTS "field_settings_select" ON public.vehicle_field_settings;
DROP POLICY IF EXISTS "field_settings_insert" ON public.vehicle_field_settings;
DROP POLICY IF EXISTS "field_settings_update" ON public.vehicle_field_settings;

-- vehicles: remover SELECTs legados, preservar vehicles_select e policies específicas por papel.
DROP POLICY IF EXISTS "vehicles_select_admin" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_select_tenant" ON public.vehicles;

-- checklist_templates: remover família antiga, preservar checklist_templates_* e templates_select_driver.
DROP POLICY IF EXISTS "templates_select" ON public.checklist_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "templates_update" ON public.checklist_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.checklist_templates;