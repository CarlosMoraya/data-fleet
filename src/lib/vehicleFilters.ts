import type { Vehicle } from '../types';
import { isCrlvExpired, isWithinExpiryWindow } from './dashboardKpi';

export const PENDENCY_VALUES = ['crlv_expired', 'crlv_expiring', 'gr_expiring', 'no_driver', 'checklist_overdue'] as const;

export type VehiclePendency = typeof PENDENCY_VALUES[number];

export const PENDENCY_LABELS: Record<VehiclePendency, string> = {
  crlv_expired: 'CRLV vencido',
  crlv_expiring: 'CRLV a vencer (30 dias)',
  gr_expiring: 'GR a vencer (30 dias)',
  no_driver: 'Sem motorista',
  checklist_overdue: 'Checklist vencido',
};

export const LEGACY_VEHICLE_ISSUE_VALUES: Record<string, VehiclePendency> = {
  crlv_vencido: 'crlv_expired',
  crlv_a_vencer: 'crlv_expiring',
  gr_a_vencer: 'gr_expiring',
  sem_motorista: 'no_driver',
  checklist_vencido: 'checklist_overdue',
};

export const SEARCH_PARAM = 'q';

export const PENDENCY_EXPIRY_WINDOW_DAYS = 30;

export interface VehicleStructuredFilters {
  shipperId: string | null;
  operationalUnitId: string | null;
  pendency: VehiclePendency | null;
}

export const EMPTY_STRUCTURED_FILTERS: VehicleStructuredFilters = {
  shipperId: null,
  operationalUnitId: null,
  pendency: null,
};

export interface PendencyContext {
  todayIso: string;
  currentYear: string;
  overdueChecklistVehicleIds: Set<string>;
}

export function isVehiclePendency(value: string | null): value is VehiclePendency {
  return PENDENCY_VALUES.includes(value as VehiclePendency);
}

export function parseVehicleFiltersFromParams(params: URLSearchParams): VehicleStructuredFilters {
  const rawIssue = params.get('issue') ?? params.get('pendencia');
  const issue = rawIssue ? (LEGACY_VEHICLE_ISSUE_VALUES[rawIssue] ?? rawIssue) : null;
  return {
    shipperId: params.get('shipper') || params.get('embarcador') || null,
    operationalUnitId: params.get('unit') || params.get('unidade') || null,
    pendency: isVehiclePendency(issue) ? issue : null,
  };
}

export function serializeVehicleFiltersToParams(filters: VehicleStructuredFilters, search?: string): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.shipperId) params.set('shipper', filters.shipperId);
  if (filters.operationalUnitId) params.set('unit', filters.operationalUnitId);
  if (filters.pendency) params.set('issue', filters.pendency);
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
  return filters.shipperId != null || filters.operationalUnitId != null || filters.pendency != null;
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
    case 'no_driver':
      return !vehicle.driverId;
    case 'checklist_overdue':
      return ctx.overdueChecklistVehicleIds.has(vehicle.id);
  }
}

export function applyVehicleFilters(
  vehicles: Vehicle[],
  search: string,
  filters: VehicleStructuredFilters,
  ctx: PendencyContext
): Vehicle[] {
  return vehicles.filter((vehicle) => {
    if (!vehicleMatchesSearch(vehicle, search)) return false;
    if (filters.shipperId && vehicle.shipperId !== filters.shipperId) return false;
    if (filters.operationalUnitId && vehicle.operationalUnitId !== filters.operationalUnitId) return false;
    if (filters.pendency && !vehicleMatchesPendency(vehicle, filters.pendency, ctx)) return false;
    return true;
  });
}
