-- Rollback: so e seguro executar se nenhum veiculo tiver a data preenchida.
-- Verificar antes:
--   SELECT count(*) FROM public.vehicles WHERE operation_start_date IS NOT NULL;
-- Se o retorno for maior que 0, executar este rollback APAGA esses dados.

ALTER TABLE public.vehicle_field_settings
  DROP COLUMN IF EXISTS operation_start_date_optional;

ALTER TABLE public.vehicles
  DROP COLUMN IF EXISTS operation_start_date;
