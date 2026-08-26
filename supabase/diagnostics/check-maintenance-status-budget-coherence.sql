-- ============================================================
-- DIAGNÓSTICO: check-maintenance-status-budget-coherence
-- Data: 2026-08-25
-- Descrição: mede a coerência entre o status operacional e o status de
--   orçamento das ordens de serviço e a exposição financeira decorrente.
-- ⚠️ RODAR NO SUPABASE SQL EDITOR (DEV antes de PROD).
-- ⚠️ As seções 0 a 5 são SOMENTE LEITURA. A seção 6 é um MODELO de reparo,
--    inteiramente comentado: nada nela roda por acidente.
-- ============================================================

-- ─── 0. Identificação de banco/host/data ──────────────────────

SELECT
  current_database() AS database_name,
  inet_server_addr()::text AS server_addr,
  NOW()              AS diagnostic_run_at;

-- ─── 1. Gatilhos vigentes ────────────────────────────────────

SELECT tgname, tgrelid::regclass::text AS tabela, tgenabled
  FROM pg_trigger
 WHERE tgname IN (
   'trg_enforce_maintenance_status_budget_coherence',
   'trg_enforce_payment_installment_source_payable',
   'trg_enforce_workshop_maintenance_columns',
   'trg_lock_approved_budget_order_columns',
   'trg_lock_approved_budget_items'
 )
 ORDER BY tabela, tgname;

-- ─── 2. As OS dos prints ─────────────────────────────────────

SELECT
  mo.id,
  mo.os_number,
  mo.status,
  mo.budget_status,
  mo.approved_cost,
  mo.budget_discount,
  mo.budget_pdf_url IS NOT NULL AS tem_pdf,
  mo.budget_reviewed_by,
  mo.budget_reviewed_at,
  mo.actual_exit_date,
  mo.created_at,
  mo.updated_at,
  v.license_plate AS placa
FROM public.maintenance_orders mo
JOIN public.vehicles v ON v.id = mo.vehicle_id
WHERE mo.os_number = 'OS-2608-5578'
  AND v.license_plate = 'TTU1G18';

SELECT
  mo.id AS maintenance_order_id,
  mo.os_number,
  COUNT(bi.id) AS item_count,
  COALESCE(SUM(bi.quantity * bi.value - COALESCE(bi.discount, 0)), 0) AS items_total
FROM public.maintenance_orders mo
LEFT JOIN public.maintenance_budget_items bi
       ON bi.maintenance_order_id = mo.id
JOIN public.vehicles v ON v.id = mo.vehicle_id
WHERE mo.os_number = 'OS-2608-5578'
  AND v.license_plate = 'TTU1G18'
GROUP BY mo.id, mo.os_number;

SELECT
  r.id,
  r.maintenance_order_id,
  r.decision,
  r.reason,
  r.budget_total,
  r.decided_by,
  r.decided_at
FROM public.maintenance_budget_reviews r
JOIN public.maintenance_orders mo ON mo.id = r.maintenance_order_id
JOIN public.vehicles v ON v.id = mo.vehicle_id
WHERE mo.os_number = 'OS-2608-5578'
  AND v.license_plate = 'TTU1G18'
ORDER BY r.decided_at ASC;

-- ─── 3. Sintoma 1 — OS com nota potencialmente impagável ─────

SELECT
  mo.id,
  mo.os_number,
  mo.status,
  mo.budget_status,
  v.license_plate AS placa,
  w.name AS oficina,
  COUNT(bi.id) AS item_count,
  COALESCE(SUM(bi.quantity * bi.value - COALESCE(bi.discount, 0)), 0) AS items_total,
  mo.actual_exit_date,
  mo.client_id
FROM public.maintenance_orders mo
JOIN public.vehicles v ON v.id = mo.vehicle_id
LEFT JOIN public.workshops w ON w.id = mo.workshop_id
LEFT JOIN public.maintenance_budget_items bi
       ON bi.maintenance_order_id = mo.id
WHERE mo.budget_status IN ('pendente', 'reaberto')
  AND mo.status IN ('Serviço em execução', 'Concluído', 'Veículo retirado')
GROUP BY mo.id, mo.os_number, mo.status, mo.budget_status,
         v.license_plate, w.name, mo.actual_exit_date, mo.client_id, mo.created_at
ORDER BY mo.created_at ASC;

-- ─── 4. Sintoma 2 — fila de aprovação incoerente ─────────────

SELECT
  CASE
    WHEN mo.budget_status = 'aprovado' THEN 'orcamento_aprovado'
    ELSE 'sem_orcamento_ou_reprovado'
  END AS fila_incoerente,
  mo.id,
  mo.os_number,
  mo.status,
  mo.budget_status,
  v.license_plate AS placa,
  w.name AS oficina,
  mo.client_id
FROM public.maintenance_orders mo
JOIN public.vehicles v ON v.id = mo.vehicle_id
LEFT JOIN public.workshops w ON w.id = mo.workshop_id
WHERE mo.status = 'Aguardando aprovação'
  AND (
    mo.budget_status = 'aprovado'
    OR mo.budget_status IN ('sem_orcamento', 'reprovado')
  )
ORDER BY mo.created_at ASC;

-- ─── 5. Sintoma 3 — parcelas fora da nova regra ──────────────

SELECT
  CASE WHEN mo.status = 'Cancelado' THEN 'cancelado' ELSE 'outro_status' END AS exposicao,
  pi.id AS installment_id,
  pi.maintenance_order_id,
  mo.os_number,
  mo.status AS order_status,
  mo.budget_status,
  pi.status AS installment_status,
  pi.value,
  pi.invoice_number,
  pi.client_id
FROM public.payment_installments pi
JOIN public.maintenance_orders mo ON mo.id = pi.maintenance_order_id
WHERE pi.source_type = 'maintenance_order'
  AND mo.status NOT IN ('Concluído', 'Veículo retirado')
ORDER BY (mo.status = 'Cancelado') DESC, mo.created_at ASC, pi.created_at ASC;

-- ─── 6. MODELO DE REPARO — inteiramente comentado ────────────
-- ⚠️ Antes de qualquer escrita, conferir CADA OS contra o PDF do orçamento
--    e o histórico em maintenance_budget_reviews. Rodar uma OS por vez,
--    sempre em BEGIN/COMMIT, conferindo o resultado antes do COMMIT.
-- Os gatilhos de orçamento liberam o reparo quando auth.uid() IS NULL,
-- caminho deliberado para SQL Editor/service_role.
--
-- Caminho A — orçamento existe e é legítimo, serviço foi feito: devolver a OS
-- para decisão, mantendo o orçamento pendente.
-- BEGIN;
-- UPDATE public.maintenance_orders
--    SET status = 'Aguardando aprovação',
--        budget_status = 'pendente'
--  WHERE id = '<id da OS conferida>';
-- COMMIT;
--
-- Caminho B — o orçamento já foi decidido e o status operacional ficou para
-- trás: corrigir somente o status operacional real.
-- BEGIN;
-- UPDATE public.maintenance_orders
--    SET status = '<status operacional real>'
--  WHERE id = '<id da OS conferida>';
-- COMMIT;
--
-- Caminho C — não existe orçamento real (serviço sem custo/garantia):
-- registrar sem_orcamento e preservar o status operacional.
-- BEGIN;
-- UPDATE public.maintenance_orders
--    SET budget_status = 'sem_orcamento'
--  WHERE id = '<id da OS conferida>';
-- COMMIT;
