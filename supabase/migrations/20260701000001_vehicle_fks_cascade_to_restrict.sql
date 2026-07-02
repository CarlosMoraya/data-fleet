-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (dev primeiro)

-- 0. Sanidade: nenhuma tabela deve ter vehicle_id órfão (esperado: 0 em todas)
--    Se retornar linhas, PARAR e reportar ao usuário antes de prosseguir.
SELECT 'tires' AS t, count(*) FROM public.tires x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL
UNION ALL SELECT 'tire_position_history', count(*) FROM public.tire_position_history x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL
UNION ALL SELECT 'tire_inspections', count(*) FROM public.tire_inspections x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL
UNION ALL SELECT 'vehicle_odometer_corrections', count(*) FROM public.vehicle_odometer_corrections x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL
UNION ALL SELECT 'vehicle_km_intervals', count(*) FROM public.vehicle_km_intervals x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL
UNION ALL SELECT 'vehicle_warranty_revision_assignments', count(*) FROM public.vehicle_warranty_revision_assignments x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL
UNION ALL SELECT 'vehicle_warranty_revision_events', count(*) FROM public.vehicle_warranty_revision_events x LEFT JOIN public.vehicles v ON v.id = x.vehicle_id WHERE v.id IS NULL;

-- 1. Recriar cada FK de vehicle_id como RESTRICT
DO $$
DECLARE
  tbl text;
  cname text;
  tables text[] := ARRAY[
    'tires','tire_position_history','tire_inspections',
    'vehicle_odometer_corrections','vehicle_km_intervals',
    'vehicle_warranty_revision_assignments','vehicle_warranty_revision_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = format('public.%I', tbl)::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%REFERENCES%vehicles%'
      AND pg_get_constraintdef(oid) ILIKE '%(vehicle_id)%';
    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, cname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT',
        tbl, tbl || '_vehicle_id_fkey'
      );
    END IF;
  END LOOP;
END $$;
