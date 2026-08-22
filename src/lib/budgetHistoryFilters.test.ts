import { describe, expect, it } from 'vitest';

import {
  BUDGET_DECISION_OPTIONS,
  applyBudgetHistoryFilters,
  buildBudgetHistoryWorkshopOptions,
  type BudgetHistoryFilters,
} from './budgetHistoryFilters';

import type { MaintenanceOrder } from '../types/maintenance';

type Row = Pick<MaintenanceOrder, 'budgetStatus' | 'workshop' | 'os' | 'licensePlate' | 'workshopOs'>;

function row(over: Partial<Row>): Row {
  return {
    budgetStatus: 'aprovado',
    workshop: 'Oficina Central',
    os: 'OS-001',
    licensePlate: 'SSB4J74',
    workshopOs: '31427',
    ...over,
  };
}

const ALL: Row[] = [
  row({ budgetStatus: 'aprovado', os: 'OS-001', licensePlate: 'SSB4J74', workshopOs: '31427' }),
  row({ budgetStatus: 'aprovado', os: 'OS-002', licensePlate: 'ABC1D23', workshopOs: '99999' }),
  row({ budgetStatus: 'reprovado', os: 'OS-003', licensePlate: 'XYZ9K88', workshopOs: '77777', workshop: 'Oficina Norte' }),
  row({ budgetStatus: 'reprovado', os: 'OS-004', licensePlate: 'DEF2G34', workshopOs: '88888', workshop: 'Oficina Norte' }),
  row({ budgetStatus: 'reaberto', os: 'OS-005', licensePlate: 'GHI3J45', workshopOs: '66666', workshop: 'Oficina Norte' }),
];

const EMPTY: BudgetHistoryFilters = { decision: '', workshop: '', search: '' };

describe('BUDGET_DECISION_OPTIONS', () => {
  it('contém exatamente 3 entradas com rótulos vindos de BUDGET_STATUS_FILTER_OPTIONS', () => {
    expect(BUDGET_DECISION_OPTIONS).toHaveLength(3);
    expect(BUDGET_DECISION_OPTIONS.map(o => o.value)).toEqual(['aprovado', 'reprovado', 'reaberto']);
    expect(BUDGET_DECISION_OPTIONS.map(o => o.label)).toEqual(['Aprovado', 'Reprovado', 'Reaberto']);
  });
});

describe('applyBudgetHistoryFilters', () => {
  it('cenário feliz: decision reprovado devolve só as 2 reprovadas', () => {
    const out = applyBudgetHistoryFilters(ALL, { ...EMPTY, decision: 'reprovado' });
    expect(out.map(o => o.os)).toEqual(['OS-003', 'OS-004']);
  });

  it('decision reaberto devolve só a OS reaberta', () => {
    const out = applyBudgetHistoryFilters(ALL, { ...EMPTY, decision: 'reaberto' });
    expect(out.map(o => o.os)).toEqual(['OS-005']);
  });

  it('filtros combinados (decisão + oficina + busca) reduzem corretamente', () => {
    const out = applyBudgetHistoryFilters(ALL, {
      decision: 'reprovado',
      workshop: 'Oficina Norte',
      search: 'XYZ',
    });
    expect(out.map(o => o.os)).toEqual(['OS-003']);
  });

  it('busca por placa parcial em minúsculos casa case-insensitive', () => {
    const out = applyBudgetHistoryFilters(ALL, { ...EMPTY, search: 'ssb4' });
    expect(out.map(o => o.os)).toEqual(['OS-001']);
  });

  it('busca por workshopOs casa', () => {
    const out = applyBudgetHistoryFilters(ALL, { ...EMPTY, search: '31427' });
    expect(out.map(o => o.os)).toEqual(['OS-001']);
  });

  it('filtros todos vazios devolvem a lista inteira sem alterar a ordem', () => {
    const out = applyBudgetHistoryFilters(ALL, { decision: '', workshop: '', search: '   ' });
    expect(out).toEqual(ALL);
  });
});

describe('buildBudgetHistoryWorkshopOptions', () => {
  it('lista única, sem vazios/espaços, ordenada em pt-BR', () => {
    const orders: Pick<MaintenanceOrder, 'workshop'>[] = [
      { workshop: 'Oficina Norte' },
      { workshop: 'Oficina Central' },
      { workshop: 'Oficina Norte' },
      { workshop: '   ' },
      { workshop: '' },
      { workshop: 'Oficina Z' },
    ];
    expect(buildBudgetHistoryWorkshopOptions(orders)).toEqual([
      'Oficina Central',
      'Oficina Norte',
      'Oficina Z',
    ]);
  });
});