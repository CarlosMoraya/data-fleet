ALTER TABLE public.checklist_templates
DROP CONSTRAINT IF EXISTS checklist_templates_vehicle_category_check;

ALTER TABLE public.checklist_templates
ADD CONSTRAINT checklist_templates_vehicle_category_check
CHECK (
  vehicle_category IS NULL OR vehicle_category IN (
    'Leve',
    'Médio',
    'Pesado',
    'Elétrico',
    'Semi-reboque/Implemento'
  )
);

NOTIFY pgrst, 'reload schema';

-- ROLLBACK
-- Reverter so e seguro se nenhum template estiver usando 'Semi-reboque/Implemento'.
-- ALTER TABLE public.checklist_templates
-- DROP CONSTRAINT IF EXISTS checklist_templates_vehicle_category_check;
--
-- ALTER TABLE public.checklist_templates
-- ADD CONSTRAINT checklist_templates_vehicle_category_check
-- CHECK (
--   vehicle_category IS NULL OR vehicle_category IN (
--     'Leve',
--     'Médio',
--     'Pesado',
--     'Elétrico'
--   )
-- );
--
-- NOTIFY pgrst, 'reload schema';
