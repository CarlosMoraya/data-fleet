-- =============================================================================
-- 20260907000003_backfill_prod_meli_is_dedicated.sql
--
-- Módulo Utilização MELI — Etapa 0.
-- Marca como dedicados os veículos do embarcador MERCADO LIVRE em produção.
--
-- ⚠️ SOMENTE PROD. Não aplicar em DEV — lá o vínculo é feito pela 20260907000002.
-- ORDEM: depois da 20260907000000 e da 20260907000001.
--
-- NÚMERO ESPERADO: 375 linhas afetadas.
-- Apurado em 2026-09-07: o cliente da9ad1ff tem 410 veículos, sendo 375 no
-- embarcador MERCADO LIVRE (361 ativos + 14 inativos), 26 em BRF, 5 em PESADOS,
-- 2 em FROTA e 2 sem embarcador.
--
-- POR QUE INCLUI OS 14 INATIVOS
-- "Ativo" e "dedicado" são eixos independentes. Um veículo inativo que volte a
-- operar não deveria exigir remarcação manual da flag. O módulo já filtra por
-- atividade onde isso importa.
--
-- IDEMPOTÊNCIA
-- O predicado `AND v.is_dedicated = false` faz a reaplicação afetar 0 linhas.
-- Nenhum veículo já marcado é tocado.
-- =============================================================================

UPDATE public.vehicles v
   SET is_dedicated = true
  FROM public.shippers s
 WHERE s.id = v.shipper_id
   AND v.client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
   AND s.name = 'MERCADO LIVRE'
   AND v.is_dedicated = false;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- CONFERÊNCIA (rodar após aplicar)
-- =============================================================================
-- 1. Total de dedicados MELI — esperado: 375
-- SELECT count(*) AS meli_dedicados
--   FROM public.vehicles v
--   JOIN public.shippers s ON s.id = v.shipper_id
--  WHERE v.client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND s.name = 'MERCADO LIVRE'
--    AND v.is_dedicated = true;
--
-- 2. Nenhum veículo de OUTRO embarcador foi marcado — esperado: 0
-- SELECT count(*) AS marcados_indevidamente
--   FROM public.vehicles v
--   LEFT JOIN public.shippers s ON s.id = v.shipper_id
--  WHERE v.client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND v.is_dedicated = true
--    AND (s.name IS DISTINCT FROM 'MERCADO LIVRE');
--
-- 3. Quebra por embarcador e flag, para conferência visual
-- SELECT COALESCE(s.name,'(sem embarcador)') AS embarcador,
--        v.is_dedicated, count(*) AS veiculos
--   FROM public.vehicles v
--   LEFT JOIN public.shippers s ON s.id = v.shipper_id
--  WHERE v.client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--  GROUP BY 1, 2 ORDER BY 1, 2;
--
-- ⚠️ Se a consulta 1 devolver um número muito diferente de 375, PARE e avise
-- antes de seguir para a Etapa 1. Divergência grande indica que o nome do
-- embarcador mudou ou que a carteira de veículos foi alterada desde 2026-09-07.

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- UPDATE public.vehicles v
--    SET is_dedicated = false
--   FROM public.shippers s
--  WHERE s.id = v.shipper_id
--    AND v.client_id = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4'
--    AND s.name = 'MERCADO LIVRE';
