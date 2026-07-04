UPDATE public.checklist_templates
SET context = 'Guincho'
WHERE context = 'Reboque';

ALTER TABLE public.checklist_templates
DROP CONSTRAINT IF EXISTS checklist_templates_context_check;

ALTER TABLE public.checklist_templates
ADD CONSTRAINT checklist_templates_context_check
CHECK (
  context IN (
    'Rotina',
    'Auditoria',
    'Guincho',
    'Entrada em Oficina',
    'Saída de Oficina',
    'Segurança',
    'Atualização de Hodômetro'
  )
);

ALTER TABLE public.vehicles
DROP CONSTRAINT IF EXISTS vehicles_type_check;

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_type_check
CHECK (
  type IN (
    'Passeio',
    'Utilitário',
    'Van',
    'Moto',
    'Vuc',
    'Toco',
    'Truck',
    'Cavalo',
    'Semirreboque',
    'Reboque',
    'Dolly'
  )
);

ALTER TABLE public.vehicles
DROP CONSTRAINT IF EXISTS vehicles_category_check;

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_category_check
CHECK (
  category IS NULL OR category IN (
    'Leve',
    'Médio',
    'Pesado',
    'Elétrico',
    'Semi-reboque/Implemento'
  )
);

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- Reverter os valores novos de tipo/categoria so e seguro se nenhum registro estiver usando
-- 'Semirreboque', 'Reboque', 'Dolly' ou 'Semi-reboque/Implemento'.
-- UPDATE public.checklist_templates
-- SET context = 'Reboque'
-- WHERE context = 'Guincho';
--
-- ALTER TABLE public.checklist_templates
-- DROP CONSTRAINT IF EXISTS checklist_templates_context_check;
--
-- ALTER TABLE public.checklist_templates
-- ADD CONSTRAINT checklist_templates_context_check
-- CHECK (
--   context IN (
--     'Rotina',
--     'Auditoria',
--     'Reboque',
--     'Entrada em Oficina',
--     'Saída de Oficina',
--     'Segurança',
--     'Atualização de Hodômetro'
--   )
-- );
--
-- ALTER TABLE public.vehicles
-- DROP CONSTRAINT IF EXISTS vehicles_type_check;
--
-- ALTER TABLE public.vehicles
-- ADD CONSTRAINT vehicles_type_check
-- CHECK (
--   type IN (
--     'Passeio',
--     'Utilitário',
--     'Van',
--     'Moto',
--     'Vuc',
--     'Toco',
--     'Truck',
--     'Cavalo'
--   )
-- );
--
-- ALTER TABLE public.vehicles
-- DROP CONSTRAINT IF EXISTS vehicles_category_check;
--
-- ALTER TABLE public.vehicles
-- ADD CONSTRAINT vehicles_category_check
-- CHECK (
--   category IS NULL OR category IN (
--     'Leve',
--     'Médio',
--     'Pesado',
--     'Elétrico'
--   )
-- );
--
-- NOTIFY pgrst, 'reload schema';
