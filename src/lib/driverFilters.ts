import { isBlank, isWithinExpiryWindow } from './dashboardKpi';
import {
  SEARCH_PARAM,
  appendMultiValueParam,
  parseSearchFromParams as _parseSearchFromParams,
  readMultiValueParam,
} from './vehicleFilters';

import type { Driver } from '../types';

export { SEARCH_PARAM, _parseSearchFromParams as parseSearchFromParams };

export const DRIVER_PENDENCY_VALUES = ['cnh_expired', 'cnh_expiring', 'gr_expiring', 'gr_expired', 'cnh_missing', 'gr_missing', 'with_vehicle', 'without_vehicle', 'pj_contract_missing'] as const;

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
  pj_contract_missing: 'PJ sem contrato anexado',
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
  shipperIds: string[];
  operationalUnitIds: string[];
  pendencies: DriverPendency[];
}

export const EMPTY_DRIVER_FILTERS: DriverStructuredFilters = {
  shipperIds: [],
  operationalUnitIds: [],
  pendencies: [],
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
  const shipperIds = readMultiValueParam(params, 'shipper', 'embarcador');
  const operationalUnitIds = readMultiValueParam(params, 'unit', 'unidade');
  const rawIssues = readMultiValueParam(params, 'issue', 'situacao');
  const pendencies = rawIssues
    .map((raw) => LEGACY_DRIVER_ISSUE_VALUES[raw] ?? raw)
    .filter(isDriverPendency);
  return {
    shipperIds,
    operationalUnitIds,
    pendencies,
  };
}

export function serializeDriverFiltersToParams(filters: DriverStructuredFilters, search?: string): URLSearchParams {
  const params = new URLSearchParams();
  appendMultiValueParam(params, 'shipper', filters.shipperIds);
  appendMultiValueParam(params, 'unit', filters.operationalUnitIds);
  appendMultiValueParam(params, 'issue', filters.pendencies);
  if (search) params.set(SEARCH_PARAM, search);
  return params;
}

export function hasLegacyDriverParams(params: URLSearchParams): boolean {
  return params.has('situacao') || params.has('embarcador') || params.has('unidade');
}

export function hasActiveDriverFilters(filters: DriverStructuredFilters): boolean {
  return filters.shipperIds.length > 0 ||
    filters.operationalUnitIds.length > 0 ||
    filters.pendencies.length > 0;
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
    case 'pj_contract_missing':
      return driver.employmentRegime === 'PJ' && isBlank(driver.serviceContractUpload);
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
    if (filters.shipperIds.length > 0 && (!link?.shipperId || !filters.shipperIds.includes(link.shipperId))) return false;
    if (filters.operationalUnitIds.length > 0 && (!link?.operationalUnitId || !filters.operationalUnitIds.includes(link.operationalUnitId))) return false;
    if (
      filters.pendencies.length > 0 &&
      !filters.pendencies.some((pendency) => driverMatchesPendency(driver, pendency, ctx))
    ) return false;
    return true;
  });
}
