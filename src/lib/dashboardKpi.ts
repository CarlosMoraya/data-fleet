import type { MaintenanceOrderDashboard } from '../types/maintenance';
import type { VehicleRow } from '../components/dashboard/OperationalPanel';

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
    (o) => o.status !== 'Concluído' && o.status !== 'Cancelado'
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

export function calculateAverageMaintenanceDays(
  orders: Pick<MaintenanceOrderDashboard, 'status' | 'entry_date' | 'actual_exit_date'>[]
): number | null {
  const days = orders
    .filter((o) => o.status === 'Concluído' && o.entry_date != null && o.actual_exit_date != null)
    .map((o) => Math.floor((new Date(o.actual_exit_date as string).getTime() - new Date(o.entry_date as string).getTime()) / 86400000))
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
    .map((o) => Math.floor((today - new Date(o.entry_date as string).getTime()) / 86400000))
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
    .map((vehicle) => vehicle.license_plate as string);
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
    .map((v) => v.license_plate as string);
}

export function getExpiredCnhNames(
  drivers: { name: string | null; expiration_date: string | null }[],
  todayIso: string
): string[] {
  return drivers
    .filter((driver) => driver.expiration_date != null && driver.expiration_date < todayIso && driver.name)
    .map((driver) => driver.name as string);
}

export function getExpiringSoonCnhNames(
  drivers: { name: string | null; expiration_date: string | null }[],
  todayIso: string,
  windowDays: number
): string[] {
  return drivers
    .filter((driver) => isWithinExpiryWindow(driver.expiration_date, todayIso, windowDays) && driver.name)
    .map((driver) => driver.name as string);
}

export function getExpiringSoonGrPlates(
  vehicles: Pick<VehicleRow, 'license_plate' | 'gr_expiration_date'>[],
  todayIso: string,
  windowDays: number
): string[] {
  return vehicles
    .filter((vehicle) => isWithinExpiryWindow(vehicle.gr_expiration_date ?? null, todayIso, windowDays) && vehicle.license_plate)
    .map((vehicle) => vehicle.license_plate as string);
}

export function getExpiringSoonGrDriverNames(
  drivers: { name: string | null; gr_expiration_date: string | null }[],
  todayIso: string,
  windowDays: number
): string[] {
  return drivers
    .filter((driver) => isWithinExpiryWindow(driver.gr_expiration_date, todayIso, windowDays) && driver.name)
    .map((driver) => driver.name as string);
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
  const totals = new Array(monthKeys.length).fill(0);
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
        daysByKey.get(key)!.push(days);
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
      const entry = countsByKey.get(key)!;
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
