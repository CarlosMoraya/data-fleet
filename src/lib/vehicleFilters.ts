import { isBlank, isCrlvExpired, isWithinExpiryWindow, lacksTrackerCoverage } from './dashboardKpi';
import { formatDate } from './dateUtils';

import type { Vehicle } from '../types';

export const PENDENCY_VALUES = ['crlv_expired', 'crlv_expiring', 'gr_expiring', 'gr_expired', 'crlv_missing', 'gr_missing', 'insurance_missing', 'maintenance_contract_missing', 'no_driver', 'checklist_overdue', 'tracker_missing'] as const;

export type VehiclePendency = typeof PENDENCY_VALUES[number];

export const PENDENCY_LABELS: Record<VehiclePendency, string> = {
  crlv_expired: 'CRLV vencido',
  crlv_expiring: 'CRLV a vencer (30 dias)',
  gr_expiring: 'GR a vencer (30 dias)',
  gr_expired: 'GR vencida',
  crlv_missing: 'Sem CRLV anexado',
  gr_missing: 'Sem GR',
  insurance_missing: 'Sem apólice de seguro',
  maintenance_contract_missing: 'Sem contrato de manutenção',
  no_driver: 'Sem motorista',
  checklist_overdue: 'Checklist vencido',
  tracker_missing: 'Sem rastreador',
};

export const LEGACY_VEHICLE_ISSUE_VALUES: Record<string, VehiclePendency> = {
  crlv_vencido: 'crlv_expired',
  crlv_a_vencer: 'crlv_expiring',
  gr_a_vencer: 'gr_expiring',
  sem_motorista: 'no_driver',
  checklist_vencido: 'checklist_overdue',
};

export const SEARCH_PARAM = 'q';

export const LAST_ROUTE_PARAM = 'lastRoute';
export const LAST_ROUTE_NONE = 'none';
export const LAST_ROUTE_OLDER_7D = 'older_7d';
export const LAST_ROUTE_OLDER_30D = 'older_30d';
export const LAST_ROUTE_RECENT_WINDOW_DAYS = 7;
export const LAST_ROUTE_OLDER_WINDOW_DAYS = 30;

export type LastRouteFilterValue = string;

export interface LastRouteFilterOption {
  value: LastRouteFilterValue;
  label: string;
  count: number;
}

export const PENDENCY_EXPIRY_WINDOW_DAYS = 30;

export const AVAILABILITY_VALUES = ['available', 'unavailable'] as const;

export type VehicleAvailability = typeof AVAILABILITY_VALUES[number];

export const AVAILABILITY_LABELS: Record<VehicleAvailability, string> = {
  available: 'Disponíveis',
  unavailable: 'Indisponíveis',
};

export function isVehicleAvailability(value: string): value is VehicleAvailability {
  return (AVAILABILITY_VALUES as readonly string[]).includes(value);
}

export interface VehicleStructuredFilters {
  shipperIds: string[];
  operationalUnitIds: string[];
  pendencies: VehiclePendency[];
  lastRoutes: LastRouteFilterValue[];
  availability: VehicleAvailability[];
}

export const EMPTY_STRUCTURED_FILTERS: VehicleStructuredFilters = {
  shipperIds: [],
  operationalUnitIds: [],
  pendencies: [],
  lastRoutes: [],
  availability: [],
};

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function readMultiValueParam(
  params: URLSearchParams,
  canonicalKey: string,
  legacyKey?: string,
): string[] {
  const canonical = params.getAll(canonicalKey).filter(Boolean);
  const rawValues = canonical.length > 0
    ? canonical
    : legacyKey ? params.getAll(legacyKey).filter(Boolean) : [];
  return dedupe(rawValues);
}

export function appendMultiValueParam(
  params: URLSearchParams,
  key: string,
  values: readonly string[],
): void {
  for (const value of values) {
    if (value) params.append(key, value);
  }
}

export interface PendencyContext {
  todayIso: string;
  currentYear: string;
  overdueChecklistVehicleIds: Set<string>;
}

export function isVehiclePendency(value: string | null): value is VehiclePendency {
  return PENDENCY_VALUES.includes(value as VehiclePendency);
}

function dateOnlyToUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return timestamp;
}

function isLastRouteFilterValue(value: string | null): value is LastRouteFilterValue {
  return value === LAST_ROUTE_NONE ||
    value === LAST_ROUTE_OLDER_7D ||
    value === LAST_ROUTE_OLDER_30D ||
    (value != null && dateOnlyToUtc(value) != null);
}

function lastRouteReferenceDate(
  vehicles: Vehicle[],
  lastRouteByPlate: Map<string, { lastRouteDate: string }>,
  normalizePlate: (plate: string) => string,
): string | null {
  let referenceDate: string | null = null;
  for (const vehicle of vehicles) {
    const date = lastRouteByPlate.get(normalizePlate(vehicle.licensePlate))?.lastRouteDate;
    if (date && dateOnlyToUtc(date) != null && (referenceDate == null || date > referenceDate)) {
      referenceDate = date;
    }
  }
  return referenceDate;
}

function routeAgeInDays(referenceDate: string, routeDate: string): number | null {
  const referenceTime = dateOnlyToUtc(referenceDate);
  const routeTime = dateOnlyToUtc(routeDate);
  if (referenceTime == null || routeTime == null) return null;
  return (referenceTime - routeTime) / 86_400_000;
}

export function parseVehicleFiltersFromParams(params: URLSearchParams): VehicleStructuredFilters {
  const shipperIds = readMultiValueParam(params, 'shipper', 'embarcador');
  const operationalUnitIds = readMultiValueParam(params, 'unit', 'unidade');
  const rawIssues = readMultiValueParam(params, 'issue', 'pendencia');
  const pendencies = rawIssues
    .map((raw) => LEGACY_VEHICLE_ISSUE_VALUES[raw] ?? raw)
    .filter(isVehiclePendency);
  const lastRoutes = readMultiValueParam(params, LAST_ROUTE_PARAM).filter(isLastRouteFilterValue);
  const availability = readMultiValueParam(params, 'availability').filter(isVehicleAvailability);
  return {
    shipperIds,
    operationalUnitIds,
    pendencies,
    lastRoutes,
    availability,
  };
}

export function serializeVehicleFiltersToParams(filters: VehicleStructuredFilters, search?: string): URLSearchParams {
  const params = new URLSearchParams();
  appendMultiValueParam(params, 'shipper', filters.shipperIds);
  appendMultiValueParam(params, 'unit', filters.operationalUnitIds);
  appendMultiValueParam(params, 'issue', filters.pendencies);
  appendMultiValueParam(params, LAST_ROUTE_PARAM, filters.lastRoutes);
  appendMultiValueParam(params, 'availability', filters.availability);
  if (search) params.set(SEARCH_PARAM, search);
  return params;
}

export function parseSearchFromParams(params: URLSearchParams): string {
  return params.get(SEARCH_PARAM) ?? '';
}

export function hasLegacyVehicleParams(params: URLSearchParams): boolean {
  return params.has('pendencia') || params.has('embarcador') || params.has('unidade');
}

export function hasActiveStructuredFilters(filters: VehicleStructuredFilters): boolean {
  return filters.shipperIds.length > 0 ||
    filters.operationalUnitIds.length > 0 ||
    filters.pendencies.length > 0 ||
    filters.lastRoutes.length > 0 ||
    filters.availability.length > 0;
}

export function buildLastRouteFilterOptions(
  vehicles: Vehicle[],
  lastRouteByPlate: Map<string, { lastRouteDate: string }>,
  normalizePlate: (plate: string) => string,
): LastRouteFilterOption[] {
  const referenceDate = lastRouteReferenceDate(vehicles, lastRouteByPlate, normalizePlate);
  const exactDateCounts = new Map<string, number>();
  let older7DaysCount = 0;
  let older30DaysCount = 0;
  let withoutRouteCount = 0;

  for (const vehicle of vehicles) {
    const route = lastRouteByPlate.get(normalizePlate(vehicle.licensePlate));
    if (!route || !referenceDate) {
      withoutRouteCount += 1;
      continue;
    }

    const age = routeAgeInDays(referenceDate, route.lastRouteDate);
    if (age == null) {
      withoutRouteCount += 1;
    } else if (age >= 0 && age < LAST_ROUTE_RECENT_WINDOW_DAYS) {
      exactDateCounts.set(route.lastRouteDate, (exactDateCounts.get(route.lastRouteDate) ?? 0) + 1);
    } else if (age >= LAST_ROUTE_RECENT_WINDOW_DAYS && age <= LAST_ROUTE_OLDER_WINDOW_DAYS) {
      older7DaysCount += 1;
    } else if (age > LAST_ROUTE_OLDER_WINDOW_DAYS) {
      older30DaysCount += 1;
    }
  }

  const options = [...exactDateCounts.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([value, count]) => ({ value, label: formatDate(value), count }));

  if (older7DaysCount > 0) {
    options.push({ value: LAST_ROUTE_OLDER_7D, label: 'Há mais de 7 dias', count: older7DaysCount });
  }
  if (older30DaysCount > 0) {
    options.push({ value: LAST_ROUTE_OLDER_30D, label: 'Há mais de 30 dias', count: older30DaysCount });
  }
  if (withoutRouteCount > 0) {
    options.push({ value: LAST_ROUTE_NONE, label: 'Sem rota registrada', count: withoutRouteCount });
  }
  return options;
}

export function vehicleMatchesLastRoute(
  vehicle: Vehicle,
  value: LastRouteFilterValue,
  lastRouteByPlate: Map<string, { lastRouteDate: string }>,
  normalizePlate: (plate: string) => string,
  referenceDate: string | null,
): boolean {
  const route = lastRouteByPlate.get(normalizePlate(vehicle.licensePlate));
  if (value === LAST_ROUTE_NONE) return route == null;
  if (!route) return false;
  if (dateOnlyToUtc(value) != null) return route.lastRouteDate === value;
  if (!referenceDate) return false;

  const age = routeAgeInDays(referenceDate, route.lastRouteDate);
  if (age == null) return false;
  if (value === LAST_ROUTE_OLDER_7D) {
    return age >= LAST_ROUTE_RECENT_WINDOW_DAYS && age <= LAST_ROUTE_OLDER_WINDOW_DAYS;
  }
  if (value === LAST_ROUTE_OLDER_30D) return age > LAST_ROUTE_OLDER_WINDOW_DAYS;
  return false;
}

export function vehicleMatchesSearch(vehicle: Vehicle, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    vehicle.licensePlate.toLowerCase().includes(q) ||
    `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(q) ||
    vehicle.chassi.toLowerCase().includes(q)
  );
}

export function vehicleMatchesPendency(vehicle: Vehicle, pendency: VehiclePendency, ctx: PendencyContext): boolean {
  switch (pendency) {
    case 'crlv_expired':
      return isCrlvExpired({
        crlv_year: vehicle.crlvYear ?? null,
        crlv_expiration_date: vehicle.crlvExpirationDate ?? null,
      }, ctx.currentYear, ctx.todayIso);
    case 'crlv_expiring':
      return isWithinExpiryWindow(vehicle.crlvExpirationDate ?? null, ctx.todayIso, PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'gr_expiring':
      return isWithinExpiryWindow(vehicle.grExpirationDate ?? null, ctx.todayIso, PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'gr_expired':
      return vehicle.grExpirationDate != null && vehicle.grExpirationDate < ctx.todayIso;
    case 'crlv_missing':
      return isBlank(vehicle.crlvUpload);
    case 'gr_missing':
      return isBlank(vehicle.grUpload);
    case 'insurance_missing':
      return vehicle.hasInsurance !== true;
    case 'maintenance_contract_missing':
      return vehicle.hasMaintenanceContract !== true;
    case 'no_driver':
      return !vehicle.driverId;
    case 'checklist_overdue':
      return ctx.overdueChecklistVehicleIds.has(vehicle.id);
    case 'tracker_missing':
      return lacksTrackerCoverage(vehicle);
  }
}

export function applyVehicleFilters(
  vehicles: Vehicle[],
  search: string,
  filters: VehicleStructuredFilters,
  pendencyContext: PendencyContext,
  unavailableVehicleIds?: Set<string>,
  lastRouteByPlate?: Map<string, { lastRouteDate: string }>,
  normalizePlate?: (plate: string) => string,
): Vehicle[] {
  const referenceDate = filters.lastRoutes.length > 0 && lastRouteByPlate && normalizePlate
    ? lastRouteReferenceDate(vehicles, lastRouteByPlate, normalizePlate)
    : null;

  return vehicles.filter((vehicle) => {
    if (!vehicleMatchesSearch(vehicle, search)) return false;
    if (filters.shipperIds.length > 0 && (!vehicle.shipperId || !filters.shipperIds.includes(vehicle.shipperId))) return false;
    if (filters.operationalUnitIds.length > 0 && (!vehicle.operationalUnitId || !filters.operationalUnitIds.includes(vehicle.operationalUnitId))) return false;
    if (
      filters.pendencies.length > 0 &&
      !filters.pendencies.some((pendency) => vehicleMatchesPendency(vehicle, pendency, pendencyContext))
    ) return false;
    if (filters.availability.length > 0 && unavailableVehicleIds) {
      const isUnavailable = unavailableVehicleIds.has(vehicle.id);
      const matchesAvailability = filters.availability.some((availability) =>
        availability === 'available' ? !isUnavailable : isUnavailable
      );
      if (!matchesAvailability) return false;
    }
    if (
      filters.lastRoutes.length > 0 &&
      lastRouteByPlate &&
      normalizePlate &&
      !filters.lastRoutes.some((lastRoute) =>
        vehicleMatchesLastRoute(vehicle, lastRoute, lastRouteByPlate, normalizePlate, referenceDate)
      )
    ) return false;
    return true;
  });
}
