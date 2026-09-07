import { normalizeFleetPlate } from '../services/vehicleLastRouteService';

import type { FuelSupply } from '../types/fuelSupply';

export interface FuelSupplyFilters {
  shipperIds: string[];
  unitIds: string[];
  plateQuery: string;
}

export const EMPTY_FUEL_SUPPLY_FILTERS: FuelSupplyFilters = {
  shipperIds: [],
  unitIds: [],
  plateQuery: '',
};

/**
 * Filtra a lista conforme a seleção do usuário: OR dentro da dimensão,
 * AND entre dimensões.
 *
 * Consequência intencional: registros sem veículo identificado
 * (`shipperId`/`operationalUnitId` nulos) somem quando há filtro de
 * embarcador ou de unidade ativo.
 */
export function applyFuelSupplyFilters(
  supplies: FuelSupply[],
  filters: FuelSupplyFilters
): FuelSupply[] {
  const shipperSet = new Set(filters.shipperIds);
  const unitSet = new Set(filters.unitIds);
  const normalizedPlate = normalizeFleetPlate(filters.plateQuery);

  return supplies.filter((supply) => {
    if (shipperSet.size > 0 && (supply.shipperId === null || !shipperSet.has(supply.shipperId))) {
      return false;
    }
    if (
      unitSet.size > 0 &&
      (supply.operationalUnitId === null || !unitSet.has(supply.operationalUnitId))
    ) {
      return false;
    }
    if (normalizedPlate && !supply.plate.includes(normalizedPlate)) return false;
    return true;
  });
}

/** Conta os registros sem veículo casado. */
export function countUnmatchedSupplies(supplies: FuelSupply[]): number {
  return supplies.filter((supply) => supply.vehicleId === null).length;
}

/** Lê os filtros da URL. Nomes canônicos em inglês, sem aliases legados. */
export function parseFuelSupplyFiltersFromParams(params: URLSearchParams): FuelSupplyFilters {
  return {
    shipperIds: params.getAll('shipper'),
    unitIds: params.getAll('unit'),
    plateQuery: params.get('q') ?? '',
  };
}

/** Serializa os filtros para a URL. */
export function writeFuelSupplyFiltersToParams(filters: FuelSupplyFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const shipperId of filters.shipperIds) params.append('shipper', shipperId);
  for (const unitId of filters.unitIds) params.append('unit', unitId);
  if (filters.plateQuery) params.set('q', filters.plateQuery);
  return params;
}
