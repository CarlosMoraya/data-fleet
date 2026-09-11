-- ============================================================
-- DIAGNÓSTICO: janela pagável de payment_installments
-- Data: 2026-09-10 — acompanha 20260910000000_widen_payment_installment_payable_window.sql
-- SOMENTE LEITURA. Rodar em DEV e em PROD após aplicar a migration.
--
-- LIMITAÇÃO: este arquivo verifica ESTRUTURA. Não tente testar o gatilho
-- com INSERT aqui: o SQL Editor não tem auth.uid(), o escape hatch da
-- função libera tudo, e o teste passaria sempre. Comportamento se valida
-- em tela, com usuário autenticado.
-- ============================================================

-- 1) O gatilho existe e está ativo.
SELECT tgname, tgenabled
  FROM pg_trigger
 WHERE tgname = 'trg_enforce_payment_installment_source_payable';
-- Esperado: 1 linha, tgenabled = 'O'.

-- 2) O corpo da função contém a janela nova e as guardas preservadas.
SELECT
  position('''Orçamento aprovado''' IN prosrc) > 0                              AS has_orcamento_aprovado,
  position('''Serviço em execução''' IN prosrc) > 0                             AS has_servico_em_execucao,
  position('''Concluído''' IN prosrc) > 0                                       AS has_concluido,
  position('''Veículo retirado''' IN prosrc) > 0                                AS has_veiculo_retirado,
  position('Cancelado' IN prosrc) > 0                                           AS mentions_cancelado,
  position('auth.uid() IS NULL' IN prosrc) > 0                                  AS has_escape_hatch,
  position('source_budget_status IS DISTINCT FROM ''aprovado''' IN prosrc) > 0  AS requires_budget_approved,
  position('source_status IS NULL' IN prosrc) > 0                               AS guards_null_status,
  position('NOT FOUND' IN prosrc) > 0                                           AS guards_missing_order,
  prosecdef                                                                     AS is_security_definer
  FROM pg_proc
 WHERE proname = 'fn_enforce_payment_installment_source_payable'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: 1 linha com
--   has_orcamento_aprovado   = t
--   has_servico_em_execucao  = t
--   has_concluido            = t
--   has_veiculo_retirado     = t
--   mentions_cancelado       = f
--   has_escape_hatch         = t
--   requires_budget_approved = t
--   guards_null_status       = t
--   guards_missing_order     = t
--   is_security_definer      = t

-- 3) Informativo: quantas OS com orçamento aprovado existem em cada status.
--    As linhas 'Orçamento aprovado' e 'Serviço em execução' passam a
--    aparecer no cadastro de pagamento (se tiverem saldo).
SELECT status, count(*) AS total
  FROM public.maintenance_orders
 WHERE budget_status = 'aprovado'
 GROUP BY status
 ORDER BY status;
