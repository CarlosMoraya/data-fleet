-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (dev primeiro)

-- 1. Colunas de soft delete em vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Colunas de soft delete em drivers
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Placa: índice único parcial (só entre ativos)
DROP INDEX IF EXISTS public.vehicles_client_plate_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_client_plate_uniq
  ON public.vehicles(client_id, license_plate) WHERE active = true;

-- 4. CPF: constraint UNIQUE(client_id, cpf) vira índice parcial
--    (a constraint nomeada auto-gerada precisa ser removida por DO block)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.drivers'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(client_id, cpf)%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.drivers DROP CONSTRAINT %I', cname);
  END IF;
END $$;
DROP INDEX IF EXISTS public.drivers_client_cpf_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS drivers_client_cpf_uniq
  ON public.drivers(client_id, cpf) WHERE active = true;

-- 5. Índices de apoio para filtro por active
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON public.vehicles(active);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.drivers(active);
