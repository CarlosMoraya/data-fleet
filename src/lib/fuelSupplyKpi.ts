import type { FuelSupply } from '../types/fuelSupply';

export interface FuelSupplyKpis {
  totalValue: number;
  totalLiters: number;
  averagePricePerLiter: number | null;
  averageKmPerLiter: number | null;
  supplyCount: number;
}

/**
 * Deriva os 5 indicadores do período. Função pura: não formata valores para
 * exibição — isso é responsabilidade do componente.
 */
export function calculateFuelSupplyKpis(supplies: FuelSupply[]): FuelSupplyKpis {
  let totalValue = 0;
  let totalLiters = 0;
  let consumptionKm = 0;
  let consumptionLiters = 0;

  for (const supply of supplies) {
    if (supply.totalValue !== null) totalValue += supply.totalValue;
    if (supply.amountLiters !== null) totalLiters += supply.amountLiters;

    const { kmTraveled, amountLiters } = supply;
    if (kmTraveled !== null && kmTraveled > 0 && amountLiters !== null && amountLiters > 0) {
      consumptionKm += kmTraveled;
      consumptionLiters += amountLiters;
    }
  }

  return {
    totalValue,
    totalLiters,
    averagePricePerLiter: totalLiters > 0 ? totalValue / totalLiters : null,
    averageKmPerLiter: consumptionLiters > 0 ? consumptionKm / consumptionLiters : null,
    supplyCount: supplies.length,
  };
}
