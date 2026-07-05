ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS checklist_templates_context_check;

ALTER TABLE public.checklist_templates
  ADD CONSTRAINT checklist_templates_context_check
  CHECK (context IN (
    'Rotina',
    'Auditoria',
    'Guincho',
    'Engate',
    'Desengate',
    'Entrada em Oficina',
    'Saída de Oficina',
    'Segurança',
    'Atualização de Hodômetro'
  ));

DO $$
DECLARE
  legacy_vehicle RECORD;
  migrated_trailer_id uuid;
  filler_profile_id uuid;
BEGIN
  FOR legacy_vehicle IN
    SELECT v.*
    FROM public.vehicles v
    WHERE v.semi_reboque = true
      AND btrim(coalesce(v.placa_semi_reboque, '')) <> ''
  LOOP
    SELECT existing.id
    INTO migrated_trailer_id
    FROM public.vehicles existing
    WHERE existing.client_id = legacy_vehicle.client_id
      AND existing.license_plate = legacy_vehicle.placa_semi_reboque
      AND existing.category = 'Semi-reboque/Implemento'
    LIMIT 1;

    IF migrated_trailer_id IS NULL THEN
      INSERT INTO public.vehicles (
        client_id,
        license_plate,
        type,
        category,
        active,
        energy_source,
        brand,
        model,
        year,
        acquisition,
        fipe_price,
        tracker,
        antt,
        owner,
        status,
        autonomy,
        renavam,
        chassi,
        detran_uf,
        color,
        tag
      )
      VALUES (
        legacy_vehicle.client_id,
        legacy_vehicle.placa_semi_reboque,
        'Semirreboque',
        'Semi-reboque/Implemento',
        true,
        'Combustão',
        '(migrado)',
        '(migrado)',
        EXTRACT(YEAR FROM now())::integer,
        'Owned',
        0,
        '',
        '',
        '',
        'Available',
        0,
        '(migrado)',
        '(migrado)',
        'NA',
        '(migrado)',
        'migrated-legacy-semireboque'
      )
      RETURNING id INTO migrated_trailer_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.vehicle_couplings c
      WHERE c.trailer_id = migrated_trailer_id
        AND c.uncoupled_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    -- Escolha documentada do filled_by:
    -- 1) primeiro profile do mesmo client_id ordenado por created_at/id
    -- 2) fallback para um Admin Master (client_id NULL)
    -- Se nenhum profile elegível existir, apenas registra o implemento migrado e pula o vínculo.
    SELECT p.id
    INTO filler_profile_id
    FROM public.profiles p
    WHERE p.client_id = legacy_vehicle.client_id
    ORDER BY p.created_at NULLS LAST, p.id
    LIMIT 1;

    IF filler_profile_id IS NULL THEN
      SELECT p.id
      INTO filler_profile_id
      FROM public.profiles p
      WHERE p.role = 'Admin Master'
      ORDER BY p.created_at NULLS LAST, p.id
      LIMIT 1;
    END IF;

    IF filler_profile_id IS NULL THEN
      RAISE NOTICE 'Legacy coupling skipped for vehicle %, no eligible filled_by profile found', legacy_vehicle.id;
      CONTINUE;
    END IF;

    INSERT INTO public.vehicle_couplings (
      client_id,
      trailer_id,
      tractor_id,
      tractor_plate,
      coupled_at,
      filled_by,
      notes
    )
    VALUES (
      legacy_vehicle.client_id,
      migrated_trailer_id,
      legacy_vehicle.id,
      legacy_vehicle.license_plate,
      now(),
      filler_profile_id,
      'Migrated from legacy semi_reboque flag'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- ALTER TABLE public.checklist_templates DROP CONSTRAINT IF EXISTS checklist_templates_context_check;
-- ALTER TABLE public.checklist_templates
--   ADD CONSTRAINT checklist_templates_context_check
--   CHECK (context IN ('Rotina','Auditoria','Guincho','Entrada em Oficina','Saída de Oficina','Segurança','Atualização de Hodômetro'));
-- DELETE FROM public.vehicle_couplings
-- WHERE trailer_id IN (
--   SELECT id FROM public.vehicles WHERE tag = 'migrated-legacy-semireboque'
-- );
-- DELETE FROM public.vehicles WHERE tag = 'migrated-legacy-semireboque';
-- NOTIFY pgrst, 'reload schema';
