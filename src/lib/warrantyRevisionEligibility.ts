import type { Vehicle } from '../types';

export interface EligibilityCriteria {
  brand?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  category?: string;
  operationalUnitId?: string;
  requireWarrantyActive?: boolean;
  maxCurrentKm?: number;
  acquisitionFrom?: string;
  acquisitionTo?: string;
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function withinAcquisition(acquisitionDate: string | undefined, from: string | undefined, to: string | undefined): boolean {
  if (!acquisitionDate) return false;
  if (from && acquisitionDate < from) return false;
  if (to && acquisitionDate > to) return false;
  return true;
}

/**
 * Filtra veículos compatíveis com os critérios de elegibilidade para um plano
 * de revisão por modelo. Exclui veículos que já possuem um plano ativo
 * (`activeVehicleIds`). O KM atual é consultado em `currentKmByVehicle`.
 */
export function filterEligibleVehicles(
  vehicles: Vehicle[],
  criteria: EligibilityCriteria,
  activeVehicleIds: Set<string>,
  currentKmByVehicle: Map<string, number>,
): Vehicle[] {
  return vehicles.filter((vehicle) => {
    if (activeVehicleIds.has(vehicle.id)) return false;

    if (criteria.brand && norm(vehicle.brand) !== norm(criteria.brand)) return false;
    if (criteria.model && norm(vehicle.model) !== norm(criteria.model)) return false;
    if (criteria.category && (vehicle.category ?? '') !== criteria.category) return false;
    if (criteria.operationalUnitId && vehicle.operationalUnitId !== criteria.operationalUnitId) return false;

    if (criteria.yearFrom != null && vehicle.year < criteria.yearFrom) return false;
    if (criteria.yearTo != null && vehicle.year > criteria.yearTo) return false;

    if (criteria.acquisitionFrom || criteria.acquisitionTo) {
      if (!withinAcquisition(vehicle.acquisitionDate, criteria.acquisitionFrom, criteria.acquisitionTo)) return false;
    }

    if (criteria.maxCurrentKm != null) {
      const km = currentKmByVehicle.get(vehicle.id);
      // KM desconhecido: não exclui por KM.
      if (km != null && km > criteria.maxCurrentKm) return false;
    }

    if (criteria.requireWarrantyActive === true) {
      if (vehicle.warranty !== true) return false;
    }

    return true;
  });
}