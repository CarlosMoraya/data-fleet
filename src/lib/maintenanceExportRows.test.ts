import { describe, expect, it } from 'vitest';

import { MAINTENANCE_EXPORT_HEADERS, buildMaintenanceExportCells, type MaintenanceExportRow } from './maintenanceExportRows';

import type { MaintenanceOrder } from '../types/maintenance';

function baseOrder(overrides: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    id: 'mo-1',
    os: 'OS-0001',
    licensePlate: 'ABC1D23',
    vehicleModel: 'FH 540',
    workshop: 'Oficina Central',
    vehicleId: 'v1',
    workshopId: 'w1',
    entryDate: '2026-08-02',
    expectedExitDate: '2026-08-10',
    type: 'Corretiva',
    status: 'Serviço em execução',
    description: 'Troca de embreagem',
    mechanicName: 'José Mecânico',
    estimatedCost: 1234.5,
    createdBy: 'u1',
    createdAt: '2026-08-02T10:00:00Z',
    ...overrides,
  };
}

function fullRow(): MaintenanceExportRow {
  return {
    ...baseOrder({
      workshopOs: 'WS-100',
      shipperName: 'Embarcador X',
      operationalUnitName: 'Unidade SP',
      actualExitDate: '2026-08-09',
      currentKm: 128000,
      budgetStatus: 'aprovado',
      approvedCost: 1000,
      budgetDiscount: 34.5,
      budgetRejectionReason: undefined,
    }),
    clientDisplayName: 'Transportadora Alfa',
  };
}

describe('maintenanceExportRows', () => {
  it('has exactly 21 headers in the exact order', () => {
    expect(MAINTENANCE_EXPORT_HEADERS.length).toBe(21);
    expect(MAINTENANCE_EXPORT_HEADERS).toEqual([
      'OS', 'OS da Oficina', 'Placa', 'Modelo', 'Tipo', 'Status', 'Oficina',
      'Embarcador', 'Unidade Operacional', 'Problema', 'Entrada',
      'Previsão de Saída', 'Saída Real', 'Dias na Oficina', 'Km na Entrada',
      'Status do Orçamento', 'Custo Estimado', 'Custo Aprovado', 'Desconto',
      'Motivo da Reprovação', 'Cliente',
    ]);
  });

  it('builds one cell per header', () => {
    const cells = buildMaintenanceExportCells(fullRow());
    expect(cells.length).toBe(MAINTENANCE_EXPORT_HEADERS.length);
  });

  it('maps a complete order with all fields filled', () => {
    const cells = buildMaintenanceExportCells(fullRow());
    expect(cells[0]).toBe('OS-0001');
    expect(cells[1]).toBe('WS-100');
    expect(cells[2]).toBe('ABC1D23');
    expect(cells[3]).toBe('FH 540');
    expect(cells[4]).toBe('Corretiva');
    expect(cells[5]).toBe('Serviço em execução');
    expect(cells[6]).toBe('Oficina Central');
    expect(cells[7]).toBe('Embarcador X');
    expect(cells[8]).toBe('Unidade SP');
    expect(cells[9]).toBe('Troca de embreagem');
    expect(cells[10]).toBe('02/08/2026');
    expect(cells[11]).toBe('10/08/2026');
    expect(cells[12]).toBe('09/08/2026');
    expect(cells[13]).toBe('7');
    expect(cells[14]).toBe('128000');
    expect(cells[15]).toBe('Aprovado');
    expect(cells[16]).toBe('1.234,50');
    expect(cells[17]).toBe('1.000,00');
    expect(cells[18]).toBe('34,50');
    expect(cells[19]).toBe('');
    expect(cells[20]).toBe('Transportadora Alfa');
  });

  it('handles minimal order with missing optional fields', () => {
    const row: MaintenanceExportRow = {
      ...baseOrder({
        workshopOs: undefined,
        vehicleModel: undefined,
        shipperName: undefined,
        operationalUnitName: undefined,
        actualExitDate: undefined,
        currentKm: undefined,
        approvedCost: undefined,
        budgetDiscount: undefined,
        budgetRejectionReason: undefined,
        budgetStatus: undefined,
      }),
      clientDisplayName: '',
    };
    const cells = buildMaintenanceExportCells(row);
    expect(cells[1]).toBe('');
    expect(cells[3]).toBe('');
    expect(cells[7]).toBe('');
    expect(cells[8]).toBe('');
    expect(cells[12]).toBe('');
    expect(cells[14]).toBe('');
    expect(cells[15]).toBe('Sem Orçamento');
    expect(cells[17]).toBe('');
    expect(cells[18]).toBe('');
    expect(cells[19]).toBe('');
    expect(cells[20]).toBe('');
  });

  it('returns empty string for budgetDiscount zero', () => {
    const row: MaintenanceExportRow = {
      ...baseOrder({ budgetDiscount: 0 }),
      clientDisplayName: '',
    };
    const cells = buildMaintenanceExportCells(row);
    expect(cells[18]).toBe('');
  });

  it('returns empty string for entryDate and days in workshop when entryDate is empty', () => {
    const row: MaintenanceExportRow = {
      ...baseOrder({ entryDate: '' }),
      clientDisplayName: '',
    };
    const cells = buildMaintenanceExportCells(row);
    expect(cells[10]).toBe('');
    expect(cells[13]).toBe('');
  });
});
