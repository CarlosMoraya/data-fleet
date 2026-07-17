import type { Vehicle } from '../types/vehicle';

export type VehicleExportRow = Vehicle & { unavailable: boolean };

export const VEHICLE_EXPORT_HEADERS: readonly string[] = [
  'Placa',
  'Marca',
  'Modelo',
  'Ano',
  'Tipo',
  'Categoria',
  'Energia',
  'Proprietário',
  'Aquisição',
  'Motorista',
  'Embarcador',
  'Unidade Operacional',
  'Finalidade',
  'Renavam',
  'Chassi',
  'Status',
  'Disponibilidade',
];

const ACQUISITION_LABELS: Record<string, string> = {
  Owned: 'Próprio',
  Rented: 'Alugado',
  Agregado: 'Agregado',
};

export function buildVehicleExportCells(row: VehicleExportRow): string[] {
  return [
    row.licensePlate ?? '',
    row.brand ?? '',
    row.model ?? '',
    row.year != null ? String(row.year) : '',
    row.type ?? '',
    row.category ?? '',
    row.energySource ?? '',
    row.owner ?? '',
    row.acquisition ? (ACQUISITION_LABELS[row.acquisition] ?? '') : '',
    row.driverName ?? '',
    row.shipperName ?? '',
    row.operationalUnitName ?? '',
    row.vehicleUsage ?? '',
    row.renavam ?? '',
    row.chassi ?? '',
    row.active === false ? 'Inativo' : 'Ativo',
    row.unavailable ? 'Indisponível' : 'Disponível',
  ];
}
