import { isBlank, isWithinExpiryWindow } from './dashboardKpi';
import { SEARCH_PARAM, parseSearchFromParams as _parseSearchFromParams } from './vehicleFilters';

import type { Driver } from '../types';

export { SEARCH_PARAM, _parseSearchFromParams as parseSearchFromParams };

export const DRIVER_PENDENCY_VALUES = ['cnh_expired', 'cnh_expiring', 'gr_expiring', 'gr_expired', 'cnh_missing', 'gr_missing', 'with_vehicle', 'without_vehicle'] as const;

export type DriverPendency = typeof DRIVER_PENDENCY_VALUES[number];

export const DRIVER_PENDENCY_LABELS: Record<DriverPendency, string> = {
  cnh_expired: 'CNH vencida',
  cnh_expiring: 'CNH a vencer (30 dias)',
  gr_expiring: 'GR a vencer (30 dias)',
  gr_expired: 'GR vencida',
  cnh_missing: 'Sem CNH anexada',
  gr_missing: 'Sem GR',
  with_vehicle: 'Com veículo',
  without_vehicle: 'Sem veículo',
};

export const LEGACY_DRIVER_ISSUE_VALUES: Record<string, DriverPendency> = {
  cnh_vencida: 'cnh_expired',
  cnh_a_vencer: 'cnh_expiring',
  gr_a_vencer: 'gr_expiring',
  com_veiculo: 'with_vehicle',
  sem_veiculo: 'without_vehicle',
};

export const DRIVER_PENDENCY_EXPIRY_WINDOW_DAYS = 30;

export interface DriverStructuredFilters {
  shipperId: string | null;
  operationalUnitId: string | null;
  pendency: DriverPendency | null;
}

export const EMPTY_DRIVER_FILTERS: DriverStructuredFilters = {
  shipperId: null,
  operationalUnitId: null,
  pendency: null,
};

export interface DriverVehicleLink {
  shipperId: string | null;
  operationalUnitId: string | null;
}

export interface DriverFilterContext {
  todayIso: string;
  vehicleByDriverId: Record<string, DriverVehicleLink | undefined>;
}

export function isDriverPendency(value: string | null): value is DriverPendency {
  return DRIVER_PENDENCY_VALUES.includes(value as DriverPendency);
}

export function parseDriverFiltersFromParams(params: URLSearchParams): DriverStructuredFilters {
  const rawIssue = params.get('issue') ?? params.get('situacao');
  const issue = rawIssue ? (LEGACY_DRIVER_ISSUE_VALUES[rawIssue] ?? rawIssue) : null;
  return {
    shipperId: params.get('shipper') || params.get('embarcador') || null,
    operationalUnitId: params.get('unit') || params.get('unidade') || null,
    pendency: isDriverPendency(issue) ? issue : null,
  };
}

export function serializeDriverFiltersToParams(filters: DriverStructuredFilters, search?: string): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.shipperId) params.set('shipper', filters.shipperId);
  if (filters.operationalUnitId) params.set('unit', filters.operationalUnitId);
  if (filters.pendency) params.set('issue', filters.pendency);
  if (search) params.set(SEARCH_PARAM, search);
  return params;
}

export function hasLegacyDriverParams(params: URLSearchParams): boolean {
  return params.has('situacao') || params.has('embarcador') || params.has('unidade');
}

export function hasActiveDriverFilters(filters: DriverStructuredFilters): boolean {
  return filters.shipperId != null || filters.operationalUnitId != null || filters.pendency != null;
}

export function driverMatchesSearch(driver: Driver, search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  const digits = search.replace(/\D/g, '');
  const nameMatch = driver.name.toLowerCase().includes(q);
  const cpfMatch = digits.length > 0 && driver.cpf.includes(digits);
  return nameMatch || cpfMatch;
}

export function driverMatchesPendency(driver: Driver, pendency: DriverPendency, ctx: DriverFilterContext): boolean {
  switch (pendency) {
    case 'cnh_expired':
      return driver.expirationDate != null && driver.expirationDate < ctx.todayIso;
    case 'cnh_expiring':
      return isWithinExpiryWindow(driver.expirationDate ?? null, ctx.todayIso, DRIVER_PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'gr_expiring':
      return isWithinExpiryWindow(driver.grExpirationDate ?? null, ctx.todayIso, DRIVER_PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'gr_expired':
      return driver.grExpirationDate != null && driver.grExpirationDate < ctx.todayIso;
    case 'cnh_missing':
      return isBlank(driver.cnhUpload);
    case 'gr_missing':
      return isBlank(driver.grUpload) && !!ctx.vehicleByDriverId[driver.id];
    case 'with_vehicle':
      return !!ctx.vehicleByDriverId[driver.id];
    case 'without_vehicle':
      return !ctx.vehicleByDriverId[driver.id];
  }
}

export function applyDriverFilters(
  drivers: Driver[],
  search: string,
  filters: DriverStructuredFilters,
  ctx: DriverFilterContext
): Driver[] {
  return drivers.filter((driver) => {
    if (!driverMatchesSearch(driver, search)) return false;
    const link = ctx.vehicleByDriverId[driver.id];
    if (filters.shipperId && link?.shipperId !== filters.shipperId) return false;
    if (filters.operationalUnitId && link?.operationalUnitId !== filters.operationalUnitId) return false;
    if (filters.pendency && !driverMatchesPendency(driver, filters.pendency, ctx)) return false;
    return true;
  });
}
