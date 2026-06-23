ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS crlv_year TEXT,
  ADD COLUMN IF NOT EXISTS tag TEXT,
  ADD COLUMN IF NOT EXISTS sanitary_inspection_upload TEXT,
  ADD COLUMN IF NOT EXISTS spare_key BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gr_upload TEXT,
  ADD COLUMN IF NOT EXISTS gr_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE public.vehicles
SET
  brand = COALESCE(brand, split_part(brand_model, ' ', 1)),
  model = COALESCE(NULLIF(model, ''), NULLIF(trim(regexp_replace(brand_model, '^[^ ]+\\s*', '')), '')),
  category = COALESCE(category, CASE
    WHEN type IN ('Passeio', 'Utilitário', 'Van', 'Moto') THEN 'Leve'
    WHEN type IN ('Vuc', 'Toco') THEN 'Médio'
    WHEN type IN ('Truck', 'Cavalo') THEN 'Pesado'
    WHEN energy_source = 'Elétrico' THEN 'Elétrico'
    ELSE 'Leve'
  END);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_category_check'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_category_check
      CHECK (category IS NULL OR category IN ('Leve', 'Médio', 'Pesado', 'Elétrico'));
  END IF;
END $$;
