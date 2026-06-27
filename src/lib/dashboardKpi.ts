import { normalizeBudgetSystem } from './budgetSystems';

import type { VehicleRow } from '../components/dashboard/OperationalPanel';
import type { MaintenanceOrderDashboard } from '../types/maintenance';

export interface CostDashboardFilters {
  category: string | null;
  model: string | null;
  shipper: string | null;
  operationalUnit: string | null;
  maintenanceType: MaintenanceOrderDashboard['type'] | null;
}

export function normalizeCostFilterValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function buildCostFilterOptions(
  vehicles: Pick<VehicleRow, 'category' | 'model' | 'shipper_name' | 'operational_unit_name'>[]
): { categories: string[]; models: string[]; shippers: string[]; operationalUnits: string[] } {
  const categories = new Set<string>();
  const models = new Set<string>();
  const shippers = new Set<string>();
  const operationalUnits = new Set<string>();

  for (const vehicle of vehicles) {
    const category = normalizeCostFilterValue(vehicle.category);
    const model = normalizeCostFilterValue(vehicle.model);
    const shipper = normalizeCostFilterValue(vehicle.shipper_name);
    const operationalUnit = normalizeCostFilterValue(vehicle.operational_unit_name);

    if (category) categories.add(category);
    if (model) models.add(model);
    if (shipper) shippers.add(shipper);
    if (operationalUnit) operationalUnits.add(operationalUnit);
  }

  const sortPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

  return {
    categories: [...categories].sort(sortPtBr),
    models: [...models].sort(sortPtBr),
    shippers: [...shippers].sort(sortPtBr),
    operationalUnits: [...operationalUnits].sort(sortPtBr),
  };
}

export function applyCostFilters<T extends Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'type'>>(input: {
  vehicles: VehicleRow[];
  orders: T[];
  filters: CostDashboardFilters;
}): { filteredVehicles: VehicleRow[]; filteredOrders: T[] } {
  const { vehicles, orders, filters } = input;

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (filters.category && normalizeCostFilterValue(vehicle.category) !== filters.category) return false;
    if (filters.model && normalizeCostFilterValue(vehicle.model) !== filters.model) return false;
    if (filters.shipper && normalizeCostFilterValue(vehicle.shipper_name) !== filters.shipper) return false;
    if (filters.operationalUnit && normalizeCostFilterValue(vehicle.operational_unit_name) !== filters.operationalUnit) return false;
    return true;
  });

  const allowedVehicleIds = new Set(filteredVehicles.map((vehicle) => vehicle.id));
  const filteredOrders = orders.filter((order) => {
    if (!allowedVehicleIds.has(order.vehicle_id)) return false;
    if (filters.maintenanceType && order.type !== filters.maintenanceType) return false;
    return true;
  });

  return { filteredVehicles, filteredOrders };
}

export function sumApprovedMaintenanceCost(
  orders: Pick<MaintenanceOrderDashboard, 'approved_cost' | 'status'>[]
): number {
  return orders.reduce((sum, order) => {
    if (order.status === 'Cancelado' || order.approved_cost == null || order.approved_cost <= 0) {
      return sum;
    }
    return sum + order.approved_cost;
  }, 0);
}

export function calculateAverageApprovedTicket(
  orders: Pick<MaintenanceOrderDashboard, 'approved_cost' | 'status'>[]
): number | null {
  const approvedOrders = orders.filter(
    (order) => order.status !== 'Cancelado' && order.approved_cost != null && order.approved_cost > 0
  );

  if (approvedOrders.length === 0) return null;

  return sumApprovedMaintenanceCost(approvedOrders) / approvedOrders.length;
}

export function calculateCostPerKm(input: {
  totalCost: number;
  vehicleKmRows: { vehicle_id: string; km_driven: number }[];
  allowedVehicleIds: Set<string>;
}): { value: number | null; totalKm: number } {
  const totalKm = input.vehicleKmRows.reduce((sum, row) => {
    if (!input.allowedVehicleIds.has(row.vehicle_id) || row.km_driven <= 0) {
      return sum;
    }
    return sum + row.km_driven;
  }, 0);

  if (totalKm <= 0) {
    return { value: null, totalKm: 0 };
  }

  return {
    value: input.totalCost / totalKm,
    totalKm,
  };
}

export interface BudgetItemForCost {
  maintenance_order_id: string;
  system: string | null;
  value: number;
}

export interface VehicleFinancialRankingRow {
  vehicleId: string;
  plate: string | null;
  model: string | null;
  totalCost: number;
  orderCount: number;
  correctiveOrderCount: number;
  kmDriven: number | null;
  costPerKm: number | null;
}

export function buildCostByVehicleAttribute(
  filteredVehicles: Pick<VehicleRow, 'id' | 'category' | 'model' | 'shipper_name' | 'operational_unit_name'>[],
  filteredOrders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'approved_cost' | 'status'>[],
  attribute: 'category' | 'model' | 'shipper_name' | 'operational_unit_name',
  fallbackLabel: string,
): { name: string; value: number }[] {
  const vehicleAttrMap = new Map<string, string>();
  for (const v of filteredVehicles) {
    const raw = v[attribute];
    vehicleAttrMap.set(v.id, typeof raw === 'string' && raw.trim().length > 0 ? raw : fallbackLabel);
  }

  const totals = new Map<string, number>();
  for (const order of filteredOrders) {
    if (order.status === 'Cancelado' || order.approved_cost == null || order.approved_cost <= 0) continue;
    const attr = vehicleAttrMap.get(order.vehicle_id) ?? fallbackLabel;
    totals.set(attr, (totals.get(attr) ?? 0) + order.approved_cost);
  }

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
}

export function buildCostBySystemData(
  filteredOrders: Pick<MaintenanceOrderDashboard, 'id' | 'approved_cost' | 'status'>[],
  budgetItems: BudgetItemForCost[],
): { name: string; value: number }[] {
  const allowedOrderIds = new Set(filteredOrders.map((o) => o.id));

  const itemsByOrder = new Map<string, BudgetItemForCost[]>();
  for (const item of budgetItems) {
    if (!allowedOrderIds.has(item.maintenance_order_id)) continue;
    const list = itemsByOrder.get(item.maintenance_order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.maintenance_order_id, list);
  }

  const totals = new Map<string, number>();
  for (const order of filteredOrders) {
    if (order.status === 'Cancelado' || order.approved_cost == null || order.approved_cost <= 0) continue;
    const items = itemsByOrder.get(order.id) ?? [];
    const sumItems = items.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0);

    if (sumItems > 0) {
      for (const item of items) {
        if (item.value <= 0) continue;
        const system = normalizeBudgetSystem(item.system);
        totals.set(system, (totals.get(system) ?? 0) + order.approved_cost * (item.value / sumItems));
      }
    } else {
      totals.set('Outros', (totals.get('Outros') ?? 0) + order.approved_cost);
    }
  }

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
}

export function buildVehicleFinancialRanking(input: {
  filteredVehicles: Pick<VehicleRow, 'id' | 'license_plate' | 'model'>[];
  filteredOrders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'type' | 'approved_cost' | 'status'>[];
  vehicleKmRows: { vehicle_id: string; km_driven: number }[];
}): VehicleFinancialRankingRow[] {
  const kmByVehicle = new Map<string, number>();
  for (const row of input.vehicleKmRows) {
    kmByVehicle.set(row.vehicle_id, row.km_driven);
  }

  const ordersByVehicle = new Map<string, typeof input.filteredOrders>();
  for (const order of input.filteredOrders) {
    if (order.status === 'Cancelado') continue;
    const list = ordersByVehicle.get(order.vehicle_id) ?? [];
    list.push(order);
    ordersByVehicle.set(order.vehicle_id, list);
  }

  const rows: VehicleFinancialRankingRow[] = [];
  for (const vehicle of input.filteredVehicles) {
    const group = ordersByVehicle.get(vehicle.id);
    if (!group || group.length === 0) continue;

    const totalCost = sumApprovedMaintenanceCost(group);
    const orderCount = group.length;
    const correctiveOrderCount = group.filter((o) => o.type === 'Corretiva').length;
    const km = kmByVehicle.get(vehicle.id);
    const kmDriven = km != null && km > 0 ? km : null;
    const costPerKm = kmDriven != null ? totalCost / kmDriven : null;

    rows.push({
      vehicleId: vehicle.id,
      plate: vehicle.license_plate ?? null,
      model: vehicle.model ?? null,
      totalCost,
      orderCount,
      correctiveOrderCount,
      kmDriven,
      costPerKm,
    });
  }

  return rows.sort((a, b) => {
    if (b.totalCost !== a.totalCost) return b.totalCost - a.totalCost;
    if (b.correctiveOrderCount !== a.correctiveOrderCount) return b.correctiveOrderCount - a.correctiveOrderCount;
    return (a.plate ?? '').localeCompare(b.plate ?? '', 'pt-BR');
  });
}

export function countActiveInMaintenance(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status'>[],
  vehicles: Pick<VehicleRow, 'id' | 'type'>[],
  vehicleTypeFilter: string | null
): number {
  let active = orders.filter(
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado'
  );

  if (vehicleTypeFilter) {
    const vIds = new Set(
      vehicles.filter((v) => v.type === vehicleTypeFilter).map((v) => v.id)
    );
    active = active.filter((o) => vIds.has(o.vehicle_id));
  }

  return active.length;
}

export function buildActiveMaintenanceTypeData(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status' | 'type'>[],
  vehicles: Pick<VehicleRow, 'id' | 'type'>[],
  vehicleTypeFilter: string | null
): { name: MaintenanceOrderDashboard['type']; value: number }[] {
  let active = orders.filter(
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado'
  );

  if (vehicleTypeFilter) {
    const vIds = new Set(
      vehicles.filter((v) => v.type === vehicleTypeFilter).map((v) => v.id)
    );
    active = active.filter((o) => vIds.has(o.vehicle_id));
  }

  const maintenanceTypes = ['Corretiva', 'Preventiva', 'Preditiva'] as const;
  const result: { name: MaintenanceOrderDashboard['type']; value: number }[] = [];

  for (const type of maintenanceTypes) {
    const count = active.filter((o) => o.type === type).length;
    if (count > 0) {
      result.push({ name: type, value: count });
    }
  }

  return result;
}

// ─── Executive KPIs & Action Queue (Fase 1) ────────────────────────────────

export type ActionSeverity = 'high' | 'medium';

export interface ActionItem {
  category: 'checklist' | 'crlv' | 'crlv_expiring' | 'cnh' | 'cnh_expiring' | 'os_overdue' | 'os_pending_approval' | 'gr_vehicle_expiring' | 'gr_driver_expiring';
  label: string;
  count: number;
  severity: ActionSeverity;
  details: string[];
}

export type OperationalActionCategory =
  | 'vehicles_unavailable'
  | 'vehicles_no_driver'
  | 'os_open'
  | 'os_overdue'
  | 'os_exit_this_week'
  | 'os_pending_approval'
  | 'checklist_overdue'
  | 'action_plans_open'
  | 'os_pending_budget'
  | 'os_due_soon';

export interface OperationalActionItem {
  category: OperationalActionCategory;
  label: string;
  count: number;
  severity: ActionSeverity;
  details: string[];
}

export function calculateFleetAvailability(totalVehicles: number, vehiclesInMaintenance: number): number {
  if (totalVehicles <= 0) return 0;
  const result = Math.round(((totalVehicles - vehiclesInMaintenance) / totalVehicles) * 100);
  return Math.max(0, Math.min(100, result));
}

export function countVehiclesInMaintenance(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status'>[],
  vehicleTypeFilter: string | null,
  vehicles: Pick<VehicleRow, 'id' | 'type'>[]
): number {
  const active = orders.filter(
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado' && o.status !== 'Veículo retirado'
  );

  if (vehicleTypeFilter) {
    const allowedVehicleIds = new Set(
      vehicles.filter((v) => v.type === vehicleTypeFilter).map((v) => v.id)
    );
    const filtered = active.filter((o) => allowedVehicleIds.has(o.vehicle_id));
    return new Set(filtered.map((o) => o.vehicle_id)).size;
  }

  return new Set(active.map((o) => o.vehicle_id)).size;
}

export function calculateChecklistComplianceRate(totalVehicles: number, overdueVehicleCount: number): number {
  if (totalVehicles <= 0) return 100;
  const result = Math.round(((totalVehicles - overdueVehicleCount) / totalVehicles) * 100);
  return Math.max(0, Math.min(100, result));
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeOverdueChecklistVehicleIds(params: {
  vehicles: { id: string; client_id?: string | null }[];
  checklistRows: { vehicle_id: string; context: string; completed_at: string }[];
  intervalsByClient: Map<string, { rotina_day_interval: number | null; seguranca_day_interval: number | null }>;
  today: Date;
}): Set<string> {
  const { vehicles, checklistRows, intervalsByClient, today } = params;
  const overdue = new Set<string>();

  const lastByVehicle = new Map<string, { rotina?: string; seguranca?: string }>();
  for (const c of checklistRows) {
    if (!c.vehicle_id || !c.completed_at) continue;
    const entry = lastByVehicle.get(c.vehicle_id) ?? {};
    if (c.context === 'Rotina' && (!entry.rotina || c.completed_at > entry.rotina)) {
      entry.rotina = c.completed_at;
    }
    if (c.context === 'Segurança' && (!entry.seguranca || c.completed_at > entry.seguranca)) {
      entry.seguranca = c.completed_at;
    }
    lastByVehicle.set(c.vehicle_id, entry);
  }

  for (const v of vehicles) {
    const clientId = v.client_id ?? null;
    const intervals = clientId != null ? intervalsByClient.get(clientId) : undefined;
    if (!intervals) continue;
    if (intervals.rotina_day_interval == null && intervals.seguranca_day_interval == null) continue;

    const last = lastByVehicle.get(v.id);
    if (intervals.rotina_day_interval != null) {
      const lastDate = last?.rotina ? new Date(last.rotina) : null;
      if (!lastDate || daysBetween(lastDate, today) > intervals.rotina_day_interval) {
        overdue.add(v.id);
        continue;
      }
    }
    if (intervals.seguranca_day_interval != null) {
      const lastDate = last?.seguranca ? new Date(last.seguranca) : null;
      if (!lastDate || daysBetween(lastDate, today) > intervals.seguranca_day_interval) {
        overdue.add(v.id);
      }
    }
  }

  return overdue;
}

export function countOverdueMaintenanceOrders(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'expected_exit_date'>[],
  todayIso: string
): number {
  return orders.filter(
    (o) =>
      o.status !== 'Concluído' &&
      o.status !== 'Cancelado' &&
      o.expected_exit_date != null &&
      o.expected_exit_date < todayIso
  ).length;
}

export function countPendingApprovalOrders(
  orders: Pick<MaintenanceOrderDashboard, 'status'>[]
): number {
  return orders.filter((o) => o.status === 'Aguardando aprovação').length;
}

export function getEndOfWeekIso(todayIso: string): string {
  const [year, month, day] = todayIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysToAdd = (7 - date.getUTCDay()) % 7;
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().split('T')[0];
}

export function countVehiclesWithoutDriver(vehicles: Pick<VehicleRow, 'driver_id'>[]): number {
  return vehicles.filter((vehicle) => vehicle.driver_id == null).length;
}

export function getVehiclesWithoutDriverPlates(vehicles: Pick<VehicleRow, 'driver_id' | 'license_plate'>[]): string[] {
  return vehicles
    .filter((vehicle) => vehicle.driver_id == null && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function countOpenOrders(orders: Pick<MaintenanceOrderDashboard, 'status'>[]): number {
  return orders.filter((order) => order.status !== 'Concluído' && order.status !== 'Cancelado').length;
}

export function countActiveOrdersExitingByEndOfWeek(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'expected_exit_date'>[],
  todayIso: string,
  endOfWeekIso: string
): number {
  return orders.filter(
    (order) =>
      order.status !== 'Concluído' &&
      order.status !== 'Cancelado' &&
      order.expected_exit_date != null &&
      order.expected_exit_date >= todayIso &&
      order.expected_exit_date <= endOfWeekIso
  ).length;
}

export function getActiveOrdersExitingByEndOfWeekVehicleIds(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status' | 'expected_exit_date'>[],
  todayIso: string,
  endOfWeekIso: string
): string[] {
  return orders
    .filter(
      (order) =>
        order.status !== 'Concluído' &&
        order.status !== 'Cancelado' &&
        order.expected_exit_date != null &&
        order.expected_exit_date >= todayIso &&
        order.expected_exit_date <= endOfWeekIso
    )
    .map((order) => order.vehicle_id);
}

export function countActiveOrdersDueWithinDays(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'expected_exit_date'>[],
  todayIso: string,
  days: number
): number {
  const today = new Date(todayIso).getTime();
  return orders.filter((order) => {
    if (
      order.status === 'Concluído' ||
      order.status === 'Cancelado' ||
      order.expected_exit_date == null ||
      order.expected_exit_date < todayIso
    ) {
      return false;
    }
    return Math.floor((new Date(order.expected_exit_date).getTime() - today) / 86400000) <= days;
  }).length;
}

export function getActiveOrdersDueWithinDaysVehicleIds(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status' | 'expected_exit_date'>[],
  todayIso: string,
  days: number
): string[] {
  const today = new Date(todayIso).getTime();
  return orders
    .filter((order) => {
      if (
        order.status === 'Concluído' ||
        order.status === 'Cancelado' ||
        order.expected_exit_date == null ||
        order.expected_exit_date < todayIso
      ) {
        return false;
      }
      return Math.floor((new Date(order.expected_exit_date).getTime() - today) / 86400000) <= days;
    })
    .map((order) => order.vehicle_id);
}

export function countPendingBudgetOrders(orders: Pick<MaintenanceOrderDashboard, 'status'>[]): number {
  return orders.filter((order) => order.status === 'Aguardando orçamento').length;
}

export function getPendingBudgetVehicleIds(
  orders: Pick<MaintenanceOrderDashboard, 'vehicle_id' | 'status'>[]
): string[] {
  return orders
    .filter((order) => order.status === 'Aguardando orçamento')
    .map((order) => order.vehicle_id);
}

export function isWithinExpiryWindow(date: string | null, todayIso: string, windowDays: number): boolean {
  if (date == null || date < todayIso) return false;
  return Math.floor((new Date(date).getTime() - new Date(todayIso).getTime()) / 86400000) <= windowDays;
}

export function buildActionQueue(input: {
  checklist: string[];
  crlv: string[];
  crlvExpiring: string[];
  cnh: string[];
  osOverdue: string[];
  osPendingApproval: string[];
  cnhExpiring?: string[];
  grVehicleExpiring?: string[];
  grDriverExpiring?: string[];
}): ActionItem[] {
  const cnhExpiring = input.cnhExpiring ?? [];
  const grVehicleExpiring = input.grVehicleExpiring ?? [];
  const grDriverExpiring = input.grDriverExpiring ?? [];
  const items: ActionItem[] = [
    { category: 'checklist', label: 'Veículos com checklist vencido', count: input.checklist.length, severity: 'high', details: input.checklist },
    { category: 'crlv', label: 'Veículos com CRLV vencido', count: input.crlv.length, severity: 'high', details: input.crlv },
    { category: 'crlv_expiring', label: 'Veículos com CRLV a vencer (30d)', count: input.crlvExpiring.length, severity: 'medium', details: input.crlvExpiring },
    { category: 'cnh', label: 'Motoristas com CNH vencida', count: input.cnh.length, severity: 'high', details: input.cnh },
    { category: 'os_overdue', label: 'OS com prazo de saída vencido', count: input.osOverdue.length, severity: 'high', details: input.osOverdue },
    { category: 'os_pending_approval', label: 'OS aguardando aprovação', count: input.osPendingApproval.length, severity: 'medium', details: input.osPendingApproval },
    { category: 'cnh_expiring', label: 'Motoristas com CNH a vencer (30d)', count: cnhExpiring.length, severity: 'medium', details: cnhExpiring },
    { category: 'gr_vehicle_expiring', label: 'Veículos com GR a vencer (30d)', count: grVehicleExpiring.length, severity: 'medium', details: grVehicleExpiring },
    { category: 'gr_driver_expiring', label: 'Motoristas com GR a vencer (30d)', count: grDriverExpiring.length, severity: 'medium', details: grDriverExpiring },
  ];

  return items
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const order = { high: 0, medium: 1 };
      return order[a.severity] - order[b.severity];
    });
}

export function buildOperationalActionQueue(input: {
  vehiclesUnavailable: string[];
  vehiclesNoDriver: string[];
  osOverdue: string[];
  checklistOverdue: string[];
  osExitThisWeek: string[];
  osPendingApproval: string[];
  osPendingBudget: string[];
  actionPlansOpen: string[];
  osDueSoon: string[];
}): OperationalActionItem[] {
  const items: OperationalActionItem[] = [
    { category: 'vehicles_unavailable', label: 'Veículos indisponíveis', count: input.vehiclesUnavailable.length, severity: 'high', details: input.vehiclesUnavailable },
    { category: 'vehicles_no_driver', label: 'Veículos sem motorista', count: input.vehiclesNoDriver.length, severity: 'medium', details: input.vehiclesNoDriver },
    { category: 'os_overdue', label: 'OS com prazo de saída vencido', count: input.osOverdue.length, severity: 'high', details: input.osOverdue },
    { category: 'checklist_overdue', label: 'Veículos com checklist vencido', count: input.checklistOverdue.length, severity: 'high', details: input.checklistOverdue },
    { category: 'os_exit_this_week', label: 'Veículos com saída prevista até fim da semana', count: input.osExitThisWeek.length, severity: 'medium', details: input.osExitThisWeek },
    { category: 'os_pending_approval', label: 'OS aguardando aprovação', count: input.osPendingApproval.length, severity: 'medium', details: input.osPendingApproval },
    { category: 'os_pending_budget', label: 'OS aguardando orçamento', count: input.osPendingBudget.length, severity: 'medium', details: input.osPendingBudget },
    { category: 'action_plans_open', label: 'Planos de ação de checklist abertos', count: input.actionPlansOpen.length, severity: 'medium', details: input.actionPlansOpen },
    { category: 'os_due_soon', label: 'OS vencendo nos próximos 7 dias', count: input.osDueSoon.length, severity: 'medium', details: input.osDueSoon },
  ];

  return items.filter((item) => item.count > 0);
}

export function calculateAverageMaintenanceDays(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'entry_date' | 'actual_exit_date'>[]
): number | null {
  const days = orders
    .filter((o) => o.status === 'Concluído' && o.entry_date != null && o.actual_exit_date != null)
    .map((o) => Math.floor((new Date(o.actual_exit_date).getTime() - new Date(o.entry_date).getTime()) / 86400000))
    .filter((value) => value >= 0);

  if (days.length === 0) return null;
  return Math.round(days.reduce((sum, value) => sum + value, 0) / days.length);
}

export function calculateAverageOpenOrderAgeDays(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'entry_date'>[],
  todayIso: string
): number | null {
  const today = new Date(todayIso).getTime();
  const days = orders
    .filter((o) => o.status !== 'Concluído' && o.status !== 'Cancelado' && o.entry_date != null)
    .map((o) => Math.floor((today - new Date(o.entry_date).getTime()) / 86400000))
    .filter((value) => value >= 0);

  if (days.length === 0) return null;
  return Math.round(days.reduce((sum, value) => sum + value, 0) / days.length);
}

export function buildMaintenanceStatusData(
  orders: Pick<MaintenanceOrderDashboard, 'status'>[]
): { name: string; value: number }[] {
  const statuses = ['Aguardando orçamento', 'Aguardando aprovação', 'Orçamento aprovado', 'Serviço em execução'];
  return statuses
    .map((status) => ({
      name: status,
      value: orders.filter((o) => o.status === status).length,
    }))
    .filter((item) => item.value > 0);
}

export function calculatePreviousPeriodRange(from: string, to: string): { from: string; to: string } {
  const parseIsoDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };
  const formatIsoDate = (value: Date) => value.toISOString().split('T')[0];

  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  const durationDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000);
  const prevTo = new Date(fromDate);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - durationDays);

  return { from: formatIsoDate(prevFrom), to: formatIsoDate(prevTo) };
}

export function calculateCostVariation(
  current: number,
  previous: number
): { percent: number | null; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return { percent: null, direction: current > 0 ? 'up' : 'flat' };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  return { percent, direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat' };
}

export function countExpiringSoon(dates: (string | null)[], todayIso: string, windowDays: number): number {
  const today = new Date(todayIso).getTime();
  return dates.filter((date) => {
    if (date == null || date < todayIso) return false;
    return Math.floor((new Date(date).getTime() - today) / 86400000) <= windowDays;
  }).length;
}

export function mapVehicleIdsToPlates(ids: string[], plateByVehicleId: Map<string, string | null>): string[] {
  return ids
    .map((id) => plateByVehicleId.get(id))
    .filter((plate): plate is string => Boolean(plate));
}

export function isCrlvExpired(vehicle: Pick<VehicleRow, 'crlv_year' | 'crlv_expiration_date'>, currentYear: string, todayIso: string): boolean {
  if (vehicle.crlv_expiration_date != null) {
    return vehicle.crlv_expiration_date < todayIso;
  }
  return vehicle.crlv_year != null && vehicle.crlv_year < currentYear;
}

export function getExpiredCrlvPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'crlv_year' | 'crlv_expiration_date'>[],
  currentYear: string,
  todayIso: string
): string[] {
  return vehicles
    .filter((vehicle) => isCrlvExpired(vehicle, currentYear, todayIso) && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getExpiringSoonCrlvPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'crlv_expiration_date'>[],
  todayIso: string,
  windowDays: number
): string[] {
  return vehicles
    .filter((v) => {
      const date = v.crlv_expiration_date;
      return date != null && date >= todayIso && Math.floor((new Date(date).getTime() - new Date(todayIso).getTime()) / 86400000) <= windowDays && v.license_plate;
    })
    .map((v) => v.license_plate);
}

export function getExpiredCnhNames(
  drivers: { name: string | null; expiration_date: string | null }[],
  todayIso: string
): string[] {
  return drivers
    .filter((driver) => driver.expiration_date != null && driver.expiration_date < todayIso && driver.name)
    .map((driver) => driver.name);
}

export function getExpiringSoonCnhNames(
  drivers: { name: string | null; expiration_date: string | null }[],
  todayIso: string,
  windowDays: number
): string[] {
  return drivers
    .filter((driver) => isWithinExpiryWindow(driver.expiration_date, todayIso, windowDays) && driver.name)
    .map((driver) => driver.name);
}

export function getExpiringSoonGrPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'gr_expiration_date'>[],
  todayIso: string,
  windowDays: number
): string[] {
  return vehicles
    .filter((vehicle) => isWithinExpiryWindow(vehicle.gr_expiration_date ?? null, todayIso, windowDays) && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getExpiringSoonGrDriverNames(
  drivers: { name: string | null; gr_expiration_date: string | null }[],
  todayIso: string,
  windowDays: number
): string[] {
  return drivers
    .filter((driver) => isWithinExpiryWindow(driver.gr_expiration_date, todayIso, windowDays) && driver.name)
    .map((driver) => driver.name);
}

// ─── Visão Geral — Cobertura e Mapa da Frota ───────────────────────────────

export function calculateInsuranceCoverageRate(vehicles: Pick<VehicleRow, 'has_insurance'>[]): number {
  if (vehicles.length === 0) return 0;
  const covered = vehicles.filter((vehicle) => vehicle.has_insurance === true).length;
  return Math.max(0, Math.min(100, Math.round((covered / vehicles.length) * 100)));
}

export function calculateTrackerCoverageRate(vehicles: Pick<VehicleRow, 'tracker'>[]): number {
  if (vehicles.length === 0) return 0;
  const covered = vehicles.filter((vehicle) => typeof vehicle.tracker === 'string' && vehicle.tracker.trim().length > 0).length;
  return Math.max(0, Math.min(100, Math.round((covered / vehicles.length) * 100)));
}

export function buildFleetCountByKey(
  vehicles: VehicleRow[],
  keyAccessor: (v: VehicleRow) => string | null | undefined,
  fallbackLabel: string
): { name: string; value: number }[] {
  const counts = new Map<string, number>();

  for (const vehicle of vehicles) {
    const rawKey = keyAccessor(vehicle);
    const key = typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : fallbackLabel;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function buildTopFleetModels(
  vehicles: Pick<VehicleRow, 'model'>[],
  limit: number,
  fallbackLabel: string
): { name: string; value: number }[] {
  return buildFleetCountByKey(vehicles as VehicleRow[], (vehicle) => vehicle.model, fallbackLabel).slice(0, limit);
}

// ─── Dashboard Fase 3 — Tendência histórica e projeção ────────────────────

function enumerateBucketKeys(from: string, to: string, granularity: 'day' | 'month'): { key: string; name: string }[] {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const result: { key: string; name: string }[] = [];

  if (granularity === 'day') {
    const current = new Date(Date.UTC(fy, fm - 1, fd));
    const end = new Date(Date.UTC(ty, tm - 1, td));
    while (current <= end) {
      const y = current.getUTCFullYear();
      const m = String(current.getUTCMonth() + 1).padStart(2, '0');
      const d = String(current.getUTCDate()).padStart(2, '0');
      result.push({ key: `${y}-${m}-${d}`, name: `${d}/${m}` });
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else {
    const current = new Date(Date.UTC(fy, fm - 1, 1));
    const end = new Date(Date.UTC(ty, tm - 1, 1));
    while (current <= end) {
      const y = current.getUTCFullYear();
      const m = String(current.getUTCMonth() + 1).padStart(2, '0');
      result.push({ key: `${y}-${m}`, name: `${m}/${y}` });
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return result;
}

export function chooseTrendGranularity(from: string, to: string): 'day' | 'month' {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  const spanDays = Math.floor((toMs - fromMs) / 86400000);
  return spanDays <= 62 ? 'day' : 'month';
}

export function buildCostTrendSeries(
  orders: Pick<MaintenanceOrderDashboard, 'entry_date' | 'approved_cost'>[],
  from: string,
  to: string,
  granularity: 'day' | 'month'
): { name: string; value: number }[] {
  const buckets = enumerateBucketKeys(from, to, granularity);
  const sums = new Map<string, number>();

  for (const order of orders) {
    if (order.entry_date == null || order.approved_cost == null || order.approved_cost <= 0) continue;
    const key = granularity === 'day'
      ? order.entry_date.substring(0, 10)
      : order.entry_date.substring(0, 7);
    sums.set(key, (sums.get(key) ?? 0) + order.approved_cost);
  }

  return buckets.map((bucket) => ({
    name: bucket.name,
    value: sums.get(bucket.key) ?? 0,
  }));
}

export function getTrailingMonthKeys(todayIso: string, count: number): string[] {
  const [y, m] = todayIso.substring(0, 7).split('-').map(Number);
  const result: string[] = [];
  const firstDayOfCurrentMonth = new Date(Date.UTC(y, m - 1, 1));

  for (let i = count; i >= 1; i--) {
    const d = new Date(firstDayOfCurrentMonth);
    d.setUTCMonth(d.getUTCMonth() - i);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    result.push(`${year}-${month}`);
  }

  return result;
}

export function sumApprovedCostByMonthKeys(
  orders: Pick<MaintenanceOrderDashboard, 'entry_date' | 'approved_cost'>[],
  monthKeys: string[]
): number[] {
  const totals: number[] = new Array<number>(monthKeys.length).fill(0);
  const indexByKey = new Map(monthKeys.map((key, i) => [key, i]));

  for (const order of orders) {
    if (order.entry_date == null || order.approved_cost == null || order.approved_cost <= 0) continue;
    const key = order.entry_date.substring(0, 7);
    const idx = indexByKey.get(key);
    if (idx !== undefined) {
      totals[idx] += order.approved_cost;
    }
  }

  return totals;
}

export function calculateMovingAverageProjection(monthlyTotals: number[]): number | null {
  if (monthlyTotals.length === 0) return null;
  return Math.round(monthlyTotals.reduce((sum, v) => sum + v, 0) / monthlyTotals.length);
}

// ─── Dashboard Evolução — Indicadores mensais com seletor de horizonte ──────

export type HorizonOption = '3m' | '6m' | '12m' | 'current_year';

export function resolveHorizonRange(horizon: HorizonOption, todayIso: string): { from: string; to: string } {
  const [yStr, mStr] = todayIso.split('-');
  const year = Number(yStr);
  const month = Number(mStr);

  const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
  const to = lastDayOfMonth.toISOString().split('T')[0];

  let from: string;

  if (horizon === 'current_year') {
    from = `${year}-01-01`;
  } else {
    const n = horizon === '3m' ? 3 : horizon === '6m' ? 6 : 12;
    const firstDay = new Date(Date.UTC(year, month - 1 - (n - 1), 1));
    from = firstDay.toISOString().split('T')[0];
  }

  return { from, to };
}

export function buildMonthlyOrderCounts(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'entry_date' | 'actual_exit_date'>[],
  from: string,
  to: string
): { name: string; opened: number; completed: number }[] {
  const buckets = enumerateBucketKeys(from, to, 'month');
  const openedByKey = new Map<string, number>();
  const completedByKey = new Map<string, number>();

  for (const order of orders) {
    if (order.entry_date != null) {
      const key = order.entry_date.substring(0, 7);
      openedByKey.set(key, (openedByKey.get(key) ?? 0) + 1);
    }
    if (order.status === 'Concluído' && order.actual_exit_date != null) {
      const key = order.actual_exit_date.substring(0, 7);
      completedByKey.set(key, (completedByKey.get(key) ?? 0) + 1);
    }
  }

  return buckets.map((b) => ({
    name: b.name,
    opened: openedByKey.get(b.key) ?? 0,
    completed: completedByKey.get(b.key) ?? 0,
  }));
}

export function buildMonthlyAverageCompletionDays(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'entry_date' | 'actual_exit_date'>[],
  from: string,
  to: string
): { name: string; value: number }[] {
  const buckets = enumerateBucketKeys(from, to, 'month');
  const daysByKey = new Map<string, number[]>();

  for (const order of orders) {
    if (order.status === 'Concluído' && order.entry_date != null && order.actual_exit_date != null) {
      const exitMs = new Date(order.actual_exit_date).getTime();
      const entryMs = new Date(order.entry_date).getTime();
      const days = Math.floor((exitMs - entryMs) / 86400000);
      if (days >= 0) {
        const key = order.actual_exit_date.substring(0, 7);
        if (!daysByKey.has(key)) daysByKey.set(key, []);
        daysByKey.get(key).push(days);
      }
    }
  }

  return buckets.map((b) => {
    const days = daysByKey.get(b.key);
    if (!days || days.length === 0) return { name: b.name, value: 0 };
    return { name: b.name, value: Math.round(days.reduce((s, d) => s + d, 0) / days.length) };
  });
}

export function buildMonthlyMaintenanceTypeCounts(
  orders: Pick<MaintenanceOrderDashboard, 'type' | 'entry_date'>[],
  from: string,
  to: string
): { name: string; Corretiva: number; Preventiva: number; Preditiva: number }[] {
  const buckets = enumerateBucketKeys(from, to, 'month');
  const countsByKey = new Map<string, { Corretiva: number; Preventiva: number; Preditiva: number }>();

  for (const order of orders) {
    if (order.entry_date != null) {
      const key = order.entry_date.substring(0, 7);
      if (!countsByKey.has(key)) {
        countsByKey.set(key, { Corretiva: 0, Preventiva: 0, Preditiva: 0 });
      }
      const entry = countsByKey.get(key);
      if (order.type === 'Corretiva') entry.Corretiva += 1;
      else if (order.type === 'Preventiva') entry.Preventiva += 1;
      else if (order.type === 'Preditiva') entry.Preditiva += 1;
    }
  }

  return buckets.map((b) => {
    const c = countsByKey.get(b.key) ?? { Corretiva: 0, Preventiva: 0, Preditiva: 0 };
    return { name: b.name, ...c };
  });
}

// ─── Conformidade Documental ───────────────────────────────────────────────

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

export function getExpiredGrVehiclePlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'gr_expiration_date'>[],
  todayIso: string
): string[] {
  return vehicles
    .filter((vehicle) => vehicle.gr_expiration_date != null && vehicle.gr_expiration_date < todayIso && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getExpiredGrDriverNames(
  drivers: { name: string | null; gr_expiration_date: string | null }[],
  todayIso: string
): string[] {
  return drivers
    .filter((driver) => driver.gr_expiration_date != null && driver.gr_expiration_date < todayIso && driver.name)
    .map((driver) => driver.name);
}

export function getVehiclesMissingCrlvUploadPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'crlv_upload'>[]
): string[] {
  return vehicles
    .filter((vehicle) => isBlank(vehicle.crlv_upload) && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getVehiclesMissingGrPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'gr_upload'>[]
): string[] {
  return vehicles
    .filter((vehicle) => isBlank(vehicle.gr_upload) && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getVehiclesMissingInsurancePlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'has_insurance'>[]
): string[] {
  return vehicles
    .filter((vehicle) => vehicle.has_insurance !== true && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getVehiclesMissingMaintenanceContractPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'has_maintenance_contract'>[]
): string[] {
  return vehicles
    .filter((vehicle) => vehicle.has_maintenance_contract !== true && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate);
}

export function getDriversMissingCnhUploadNames(
  drivers: { name: string | null; cnh_upload: string | null }[]
): string[] {
  return drivers
    .filter((driver) => isBlank(driver.cnh_upload) && driver.name)
    .map((driver) => driver.name);
}

export function getDriversWithVehicleMissingGrNames(
  drivers: { id: string; name: string | null; gr_upload: string | null }[],
  driverIdsWithVehicle: Set<string>
): string[] {
  return drivers
    .filter((driver) => driverIdsWithVehicle.has(driver.id) && isBlank(driver.gr_upload) && driver.name)
    .map((driver) => driver.name);
}

export function isVehicleDocumentallyIrregular(
  vehicle: VehicleRow,
  currentYear: string,
  todayIso: string,
  windowDays: number
): boolean {
  return isCrlvExpired(vehicle, currentYear, todayIso)
    || isWithinExpiryWindow(vehicle.crlv_expiration_date, todayIso, windowDays)
    || (vehicle.gr_expiration_date != null && vehicle.gr_expiration_date < todayIso)
    || isWithinExpiryWindow(vehicle.gr_expiration_date ?? null, todayIso, windowDays)
    || isBlank(vehicle.crlv_upload)
    || isBlank(vehicle.gr_upload)
    || vehicle.has_insurance !== true
    || vehicle.has_maintenance_contract !== true;
}

export function isDriverDocumentallyIrregular(
  driver: { id: string; expiration_date: string | null; gr_expiration_date: string | null; cnh_upload: string | null; gr_upload: string | null },
  driverIdsWithVehicle: Set<string>,
  todayIso: string,
  windowDays: number
): boolean {
  return (driver.expiration_date != null && driver.expiration_date < todayIso)
    || isWithinExpiryWindow(driver.expiration_date, todayIso, windowDays)
    || isBlank(driver.cnh_upload)
    || (driver.gr_expiration_date != null && driver.gr_expiration_date < todayIso)
    || isWithinExpiryWindow(driver.gr_expiration_date, todayIso, windowDays)
    || (driverIdsWithVehicle.has(driver.id) && isBlank(driver.gr_upload));
}

export function countIrregularVehicles(
  vehicles: VehicleRow[],
  currentYear: string,
  todayIso: string,
  windowDays: number
): number {
  return vehicles.filter((vehicle) => isVehicleDocumentallyIrregular(vehicle, currentYear, todayIso, windowDays)).length;
}

export function countIrregularDrivers(
  drivers: { id: string; expiration_date: string | null; gr_expiration_date: string | null; cnh_upload: string | null; gr_upload: string | null }[],
  driverIdsWithVehicle: Set<string>,
  todayIso: string,
  windowDays: number
): number {
  return drivers.filter((driver) => isDriverDocumentallyIrregular(driver, driverIdsWithVehicle, todayIso, windowDays)).length;
}

export function calculateDocumentaryComplianceRate(totalEntities: number, irregularEntities: number): number {
  if (totalEntities <= 0) return 100;
  const result = Math.round(((totalEntities - irregularEntities) / totalEntities) * 100);
  return Math.max(0, Math.min(100, result));
}

export type ComplianceActionCategory =
  | 'crlv_expired' | 'cnh_expired' | 'gr_vehicle_expired' | 'gr_driver_expired'
  | 'crlv_expiring' | 'cnh_expiring' | 'gr_vehicle_expiring' | 'gr_driver_expiring'
  | 'crlv_missing' | 'cnh_missing' | 'gr_vehicle_missing' | 'gr_driver_missing'
  | 'insurance_missing' | 'maintenance_contract_missing';

export interface ComplianceActionItem {
  category: ComplianceActionCategory;
  label: string;
  count: number;
  severity: ActionSeverity;
  details: string[];
}

export function buildComplianceActionQueue(input: {
  crlvExpired: string[]; cnhExpired: string[]; grVehicleExpired: string[]; grDriverExpired: string[];
  crlvExpiring: string[]; cnhExpiring: string[]; grVehicleExpiring: string[]; grDriverExpiring: string[];
  crlvMissing: string[]; cnhMissing: string[]; grVehicleMissing: string[]; grDriverMissing: string[];
  insuranceMissing: string[]; maintenanceContractMissing: string[];
}): ComplianceActionItem[] {
  const items: ComplianceActionItem[] = [
    { category: 'crlv_expired', label: 'Veículos com CRLV Vencido', count: input.crlvExpired.length, severity: 'high', details: input.crlvExpired },
    { category: 'cnh_expired', label: 'Motoristas com CNH Vencida', count: input.cnhExpired.length, severity: 'high', details: input.cnhExpired },
    { category: 'gr_vehicle_expired', label: 'GR de Veículo Vencida', count: input.grVehicleExpired.length, severity: 'high', details: input.grVehicleExpired },
    { category: 'gr_driver_expired', label: 'GR de Motorista Vencida', count: input.grDriverExpired.length, severity: 'high', details: input.grDriverExpired },
    { category: 'crlv_expiring', label: 'CRLV a Vencer em 30 dias', count: input.crlvExpiring.length, severity: 'medium', details: input.crlvExpiring },
    { category: 'cnh_expiring', label: 'CNH a Vencer em 30 dias', count: input.cnhExpiring.length, severity: 'medium', details: input.cnhExpiring },
    { category: 'gr_vehicle_expiring', label: 'GR de Veículo a Vencer em 30 dias', count: input.grVehicleExpiring.length, severity: 'medium', details: input.grVehicleExpiring },
    { category: 'gr_driver_expiring', label: 'GR de Motorista a Vencer em 30 dias', count: input.grDriverExpiring.length, severity: 'medium', details: input.grDriverExpiring },
    { category: 'crlv_missing', label: 'Veículos sem CRLV Anexado', count: input.crlvMissing.length, severity: 'high', details: input.crlvMissing },
    { category: 'cnh_missing', label: 'Motoristas sem CNH Anexada', count: input.cnhMissing.length, severity: 'high', details: input.cnhMissing },
    { category: 'gr_vehicle_missing', label: 'Veículos sem GR', count: input.grVehicleMissing.length, severity: 'high', details: input.grVehicleMissing },
    { category: 'gr_driver_missing', label: 'Motoristas sem GR', count: input.grDriverMissing.length, severity: 'high', details: input.grDriverMissing },
    { category: 'insurance_missing', label: 'Veículo sem Apólice de Seguro', count: input.insuranceMissing.length, severity: 'high', details: input.insuranceMissing },
    { category: 'maintenance_contract_missing', label: 'Veículo sem Contrato de Manutenção', count: input.maintenanceContractMissing.length, severity: 'high', details: input.maintenanceContractMissing },
  ];

  return items
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const order = { high: 0, medium: 1 };
      return order[a.severity] - order[b.severity];
    });
}
