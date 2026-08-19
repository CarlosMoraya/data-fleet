import { formatDateForExport } from './dateUtils';

import type { Driver } from '../types/driver';

export type DriverExportRow = Driver & { vehiclePlate: string; shipperName: string; operationalUnitName: string };

export const DRIVER_EXPORT_HEADERS: readonly string[] = [
  'Nome',
  'CPF',
  'Telefone',
  'Regime',
  'Categoria CNH',
  'Nº Registro CNH',
  'Renach',
  'Emissão CNH',
  'Validade CNH',
  'Validade GR',
  'Veículo',
  'Embarcador',
  'Unidade Operacional',
  'Status',
];

function formatCpfForExport(cpf: string | null | undefined): string {
  const value = cpf ?? '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function buildDriverExportCells(row: DriverExportRow): string[] {
  return [
    row.name ?? '',
    formatCpfForExport(row.cpf),
    row.phone ?? '',
    row.employmentRegime ?? '',
    row.category ?? '',
    row.registrationNumber ?? '',
    row.renach ?? '',
    formatDateForExport(row.issueDate),
    formatDateForExport(row.expirationDate),
    formatDateForExport(row.grExpirationDate),
    row.vehiclePlate,
    row.shipperName,
    row.operationalUnitName,
    row.active === false ? 'Inativo' : 'Ativo',
  ];
}
