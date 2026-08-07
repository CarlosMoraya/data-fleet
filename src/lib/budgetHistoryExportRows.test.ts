import { describe, expect, it } from 'vitest';

import { BUDGET_HISTORY_EXPORT_HEADERS, buildBudgetHistoryExportCells } from './budgetHistoryExportRows';

import type { MaintenanceOrder } from '../types/maintenance';

function makeOrder(over: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    id: 'o1',
    os: 'OS-001',
    licensePlate: 'SSB4J74',
    vehicleModel: undefined,
    workshop: 'Oficina Central',
    vehicleId: 'v1',
    workshopId: 'w1',
    entryDate: '2026-07-01',
    expectedExitDate: '2026-07-01',
    type: 'Corretiva',
    status: 'Orçamento aprovado',
    description: '',
    mechanicName: '',
    estimatedCost: 0,
    createdBy: 'João',
    createdAt: '2026-07-01T10:00:00Z',
    budgetStatus: 'aprovado',
    budgetDiscount: 0,
    budgetReviewedBy: 'Data Stack',
    budgetReviewedAt: '2026-08-07T10:00:00Z',
    ...over,
  } as MaintenanceOrder;
}

describe('buildBudgetHistoryExportCells', () => {
  it('cenário feliz (aprovado): decisão Aprovado, valor formatado, motivo vazio', () => {
    const cells = buildBudgetHistoryExportCells(
      makeOrder({ approvedCost: 15896.11, budgetStatus: 'aprovado' }),
    );

    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Decisão')]).toBe('Aprovado');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Valor Aprovado')]).toBe('15.896,11');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Motivo da Reprovação')]).toBe('');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Revisado por')]).toBe('Data Stack');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Revisado em')]).toMatch(/^07\/08\/2026\b/);
  });

  it('cenário reprovado: decisão Reprovado, Valor Aprovado vazio, motivo preenchido', () => {
    const cells = buildBudgetHistoryExportCells(
      makeOrder({
        budgetStatus: 'reprovado',
        approvedCost: undefined,
        budgetRejectionReason: 'Valor acima do praticado',
      }),
    );

    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Decisão')]).toBe('Reprovado');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Valor Aprovado')]).toBe('');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Motivo da Reprovação')]).toBe('Valor acima do praticado');
  });

  it('edge case: budgetDiscount=0 e approvedCost undefined → ambas vazias', () => {
    const cells = buildBudgetHistoryExportCells(
      makeOrder({ budgetDiscount: 0, approvedCost: undefined }),
    );
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Valor Aprovado')]).toBe('');
    expect(cells[BUDGET_HISTORY_EXPORT_HEADERS.indexOf('Desconto')]).toBe('');
  });

  it('contrato: número de células igual ao número de headers', () => {
    const cells = buildBudgetHistoryExportCells(makeOrder());
    expect(cells.length).toBe(BUDGET_HISTORY_EXPORT_HEADERS.length);
  });
});