-- ============================================================
-- DIAGNÓSTICO: check-approved-budget-integrity
-- Data: 2026-08-22
-- Descrição: mede a divergência entre o valor aprovado (approved_cost) e a
--   soma real dos itens de orçamento das OS com budget_status = 'aprovado'.
--   Toda divergência é evidência de alteração do orçamento DEPOIS da
--   aprovação — o que as migrations 20260821000000 (oficina) e
--   20260822000000 (todos os papéis) passaram a impedir.
-- ⚠️ RODAR NO SUPABASE SQL EDITOR (DEV antes de PROD).
-- ⚠️ As seções 0 a 3 são SOMENTE LEITURA. A seção 4 é um MODELO de reparo,
--    inteiramente comentado: nada nela roda por acidente.
-- ============================================================

-- ─── 0. Identificação de banco/host/data ──────────────────────

SELECT
  current_database() AS database_name,
  inet_server_addr() AS server_addr,
  NOW()              AS diagnostic_run_at;

-- ─── 1. Gatilhos de trava ativos ──────────────────────────────

SELECT tgname, tgrelid::regclass AS tabela, tgenabled
  FROM pg_trigger
 WHERE tgname IN (
   'trg_enforce_workshop_maintenance_columns',
   'trg_lock_approved_budget_items',
   'trg_lock_approved_budget_order_columns'
 )
 ORDER BY tabela, tgname;
-- Esperado após 20260822000000: 3 linhas, tgenabled = 'O'.

-- ─── 2. OS aprovadas com itens divergentes do valor aprovado ──
-- total_itens = SUM(quantidade * valor - desconto do item) - desconto geral da OS.
-- A tolerância de 1 centavo absorve arredondamento de NUMERIC.

WITH item_totals AS (
  SELECT
    mo.id,
    mo.os_number,
    mo.client_id,
    mo.budget_reviewed_at,
    COALESCE(mo.approved_cost, 0)                                  AS approved_cost,
    COALESCE(mo.budget_discount, 0)                                AS budget_discount,
    COALESCE(SUM(bi.quantity * bi.value - COALESCE(bi.discount, 0)), 0)
      - COALESCE(mo.budget_discount, 0)                            AS items_total,
    COUNT(bi.id)                                                   AS item_count
  FROM public.maintenance_orders mo
  LEFT JOIN public.maintenance_budget_items bi
         ON bi.maintenance_order_id = mo.id
  WHERE mo.budget_status = 'aprovado'
  GROUP BY mo.id
)
SELECT
  it.os_number,
  c.name                                   AS cliente,
  v.license_plate                          AS placa,
  it.item_count                            AS qtd_itens,
  it.approved_cost,
  it.items_total,
  it.items_total - it.approved_cost        AS diferenca,
  it.budget_reviewed_at,
  p.name                                   AS aprovado_por
FROM item_totals it
JOIN public.maintenance_orders mo ON mo.id = it.id
LEFT JOIN public.clients  c ON c.id = it.client_id
LEFT JOIN public.vehicles v ON v.id = mo.vehicle_id
LEFT JOIN public.profiles p ON p.id = mo.budget_reviewed_by
WHERE ABS(it.items_total - it.approved_cost) > 0.01
ORDER BY ABS(it.items_total - it.approved_cost) DESC;

-- ─── 3. Detalhe dos itens de UMA OS divergente ────────────────
-- Trocar o os_number pelo da linha que se quer investigar.
-- Confronte esta lista com o PDF do orçamento (budget_pdf_url): o PDF é a
-- evidência original do que foi aprovado.

SELECT
  mo.os_number,
  mo.approved_cost,
  mo.budget_discount,
  mo.budget_pdf_url,
  bi.id            AS item_id,
  bi.sort_order,
  bi.item_name,
  bi.system,
  bi.quantity,
  bi.value,
  bi.discount,
  bi.quantity * bi.value - COALESCE(bi.discount, 0) AS total_linha,
  bi.created_at
FROM public.maintenance_orders mo
LEFT JOIN public.maintenance_budget_items bi ON bi.maintenance_order_id = mo.id
WHERE mo.os_number = 'OS-2606-8910'
ORDER BY bi.sort_order;
-- `created_at` do item é a única pista de quando a linha entrou: item criado
-- depois de budget_reviewed_at foi acrescentado após a aprovação. Não há
-- auditoria de autoria — por isso o reparo é decidido caso a caso.

-- ─── 4. MODELO DE REPARO (comentado — não roda como está) ─────
-- Rodar SEMPRE dentro de BEGIN/COMMIT, uma OS por vez, depois de conferir a
-- seção 3 contra o PDF. Os gatilhos de trava liberam a escrita aqui porque
-- auth.uid() é NULL no SQL Editor; pela aplicação, nada disso é possível.
--
-- Caminho A — o PDF aprovado NÃO contém o item: a linha foi acrescentada
-- depois e deve sair. Restaura a coerência com approved_cost.
--
-- BEGIN;
--   DELETE FROM public.maintenance_budget_items
--    WHERE id = '<item_id da seção 3>';
--   -- Confirme o novo total antes de fechar:
--   SELECT COALESCE(SUM(quantity * value - COALESCE(discount, 0)), 0)
--     FROM public.maintenance_budget_items
--    WHERE maintenance_order_id = '<id da OS>';
-- COMMIT;   -- ou ROLLBACK; se o número não bater
--
-- Caminho B — o serviço realmente cresceu e o valor maior é legítimo: o
-- correto NÃO é editar o aprovado no banco, e sim reprovar/reabrir a OS pelo
-- fluxo de Aprovação de Orçamentos, para que exista decisão registrada
-- (budget_reviewed_by / budget_reviewed_at) sobre o novo valor:
--
-- BEGIN;
--   UPDATE public.maintenance_orders
--      SET budget_status = 'pendente',
--          status = 'Aguardando aprovação',
--          approved_cost = NULL,
--          budget_reviewed_by = NULL,
--          budget_reviewed_at = NULL
--    WHERE id = '<id da OS>';
-- COMMIT;
-- Depois disso a OS volta para a fila de Aprovação de Orçamentos e é aprovada
-- pela alçada competente, com o valor correto.
--
-- ⚠️ Nunca "consertar" ajustando approved_cost direto para bater com os itens:
--    isso legitima no banco um valor que ninguém aprovou.
