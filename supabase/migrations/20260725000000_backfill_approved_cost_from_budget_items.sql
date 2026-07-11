-- Backfill approved_cost for maintenance_orders already approved, from the sum of their budget items.
-- Only touches orders with budget_status = 'aprovado' and approved_cost NULL or 0.
update maintenance_orders mo
set approved_cost = coalesce(
  (select sum(bi.quantity * bi.value) from maintenance_budget_items bi where bi.maintenance_order_id = mo.id),
  0
)
where mo.budget_status = 'aprovado'
  and (mo.approved_cost is null or mo.approved_cost = 0);
