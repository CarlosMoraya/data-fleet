import type { Vehicle } from '../types';
import { isCrlvExpired, isWithinExpiryWindow } from './dashboardKpi';

export const PENDENCY_VALUES = ['crlv_vencido', 'crlv_a_vencer', 'gr_a_vencer', 'sem_motorista', 'checklist_vencido'] as const;

export type VehiclePendency = typeof PENDENCY_VALUES[number];

export const PENDENCY_LABELS: Record<VehiclePendency, string> = {
  crlv_vencido: 'CRLV vencido',
  crlv_a_vencer: 'CRLV a vencer (30 dias)',
  gr_a_vencer: 'GR a vencer (30 dias)',
  sem_motorista: 'Sem motorista',
  checklist_vencido: 'Checklist vencido',
};

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
  const pendency = params.get('pendencia');
  return {
    shipperId: params.get('embarcador') || null,
    operationalUnitId: params.get('unidade') || null,
    pendency: isVehiclePendency(pendency) ? pendency : null,
  };
}

export function serializeVehicleFiltersToParams(filters: VehicleStructuredFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.shipperId) params.set('embarcador', filters.shipperId);
  if (filters.operationalUnitId) params.set('unidade', filters.operationalUnitId);
  if (filters.pendency) params.set('pendencia', filters.pendency);
  return params;
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
    case 'crlv_vencido':
      return isCrlvExpired({
        crlv_year: vehicle.crlvYear ?? null,
        crlv_expiration_date: vehicle.crlvExpirationDate ?? null,
      }, ctx.currentYear, ctx.todayIso);
    case 'crlv_a_vencer':
      return isWithinExpiryWindow(vehicle.crlvExpirationDate ?? null, ctx.todayIso, PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'gr_a_vencer':
      return isWithinExpiryWindow(vehicle.grExpirationDate ?? null, ctx.todayIso, PENDENCY_EXPIRY_WINDOW_DAYS);
    case 'sem_motorista':
      return !vehicle.driverId;
    case 'checklist_vencido':
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
