import type { Driver } from '../types';
import { isWithinExpiryWindow } from './dashboardKpi';

export const DRIVER_PENDENCY_VALUES = ['cnh_vencida', 'cnh_a_vencer', 'gr_a_vencer', 'com_veiculo', 'sem_veiculo'] as const;

export type DriverPendency = typeof DRIVER_PENDENCY_VALUES[number];

export const DRIVER_PENDENCY_LABELS: Record<DriverPendency, string> = {
  cnh_vencida: 'CNH vencida',
  cnh_a_vencer: 'CNH a vencer (30 dias)',
  gr_a_vencer: 'GR a vencer (30 dias)',
  com_veiculo: 'Com veículo',
  sem_veiculo: 'Sem veículo',
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
  const pendency = params.get('situacao');
  return {
    shipperId: params.get('embarcador') || null,
    operationalUnitId: params.get('unidade') || null,
    pendency: isDriverPendency(pendency) ? pendency : null,
  };
}

export function serializeDriverFiltersToParams(filters: DriverStructuredFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.shipperId) params.set('embarcador', filters.shipperId);
  if (filters.operationalUnitId) params.set('unidade', filters.operationalUnitId);
  if (filters.pendency) params.set('situacao', filters.pendency);
  return params;
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
    case 'cnh_vencida':
      return driver.expirationDate != null && driver.expirationDate < ctx.todayIso;
    case 'cnh_a_vencer':
      return isWithinExpiryWindow(driver.expirationDate ?? null, ctx.todayIso, DRIVER_PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'gr_a_vencer':
      return isWithinExpiryWindow(driver.grExpirationDate ?? null, ctx.todayIso, DRIVER_PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'com_veiculo':
      return !!ctx.vehicleByDriverId[driver.id];
    case 'sem_veiculo':
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
