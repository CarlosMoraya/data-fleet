import { formatDateForExport } from './dateUtils';
import { formatOdometerDistanceKm } from './meliUtilization';

import type { MeliUtilizationRow } from '../types/meliUtilization';

export const MELI_UTILIZATION_EXPORT_HEADERS: readonly string[] = [
  'Placa',
  'Veículo',
  'Utilização',
  'Motorista (Rota)',
  'Motorista (Cadastro)',
  'Divergência de Motorista',
  'Id da Rota',
  'Data da Rota',
  'Unidade (Rota)',
  'Unidade (Cadastro)',
  'Divergência de Unidade',
  'Ciclo',
  'KM Rodado',
  'Status',
  'Divergência de Status',
];

function formatKmForExport(value: number | null): string {
  const formatted = formatOdometerDistanceKm(value);
  return formatted === '—' ? '' : formatted;
}

export function buildMeliUtilizationExportCells(row: MeliUtilizationRow): string[] {
  return [
    row.licensePlate,
    row.vehicleDescription,
    row.utilized ? 'Utilizado' : 'Não utilizado',
    row.driverName ?? '',
    row.fleetDriverName ?? '',
    row.driverDivergent ? 'Sim' : 'Não',
    row.routeId ?? '',
    formatDateForExport(row.routeDate),
    row.unitCode ?? '',
    row.fleetUnitCode ?? '',
    row.unitDivergent ? 'Sim' : 'Não',
    row.cycle ?? '',
    formatKmForExport(row.odometerDistanceKm),
    row.unavailableOnDate ? 'Indisponível' : 'Disponível',
    row.statusDivergent ? 'Sim' : 'Não',
  ];
}