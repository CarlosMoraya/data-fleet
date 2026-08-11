-- ─── 1. Data de inicio na operacao do veiculo ───

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS operation_start_date date;

COMMENT ON COLUMN public.vehicles.operation_start_date IS
  'Data em que o veiculo comecou efetivamente a operar na frota. Distinta de acquisition_date (compra do veiculo proprio, assinatura do contrato de locacao ou assinatura do contrato de prestacao de servicos do agregado). Nao alimenta nenhum calculo de revisao de garantia.';

-- ─── 2. Obrigatoriedade configuravel por tenant ───
-- Excecao consciente ao padrao "tudo obrigatorio por default" das demais colunas
-- desta tabela: o default e TRUE (opcional) para nao quebrar a edicao dos
-- veiculos ja cadastrados, que nascem com operation_start_date nulo.

ALTER TABLE public.vehicle_field_settings
  ADD COLUMN IF NOT EXISTS operation_start_date_optional boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vehicle_field_settings.operation_start_date_optional IS
  'TRUE = campo Data de Inicio na Operacao e opcional no formulario de veiculo. Default de fabrica TRUE, ao contrario das demais colunas desta tabela.';
