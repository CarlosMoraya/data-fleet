import { describe, expect, it } from 'vitest';

import {
  filterApprovedOrdersByQuery,
  selectSelectableApprovedOrders,
} from './approvedOrderSearch';

import type { SearchableApprovedOrder } from './approvedOrderSearch';

function order(overrides: Partial<SearchableApprovedOrder> = {}): SearchableApprovedOrder {
  return {
    osNumber: 'OS-2606-1298',
    workshopName: 'Oficina São João',
    vehiclePlate: 'ABC1D23',
    remainingBudget: 500,
    status: 'Concluído',
    ...overrides,
  };
}

describe('selectSelectableApprovedOrders', () => {
  it('mantém uma OS pagável com saldo restante', () => {
    const selectable = order({ remainingBudget: 500 });
    expect(selectSelectableApprovedOrders([selectable])).toEqual([selectable]);
  });

  it('remove uma OS totalmente quitada', () => {
    expect(selectSelectableApprovedOrders([order({ remainingBudget: 0 })])).toEqual([]);
  });

  it('remove uma OS com saldo negativo', () => {
    expect(selectSelectableApprovedOrders([order({ remainingBudget: -100 })])).toEqual([]);
  });

  it('mantém uma OS parcialmente paga com saldo restante', () => {
    const partiallyPaid = order({ remainingBudget: 600 });
    expect(selectSelectableApprovedOrders([partiallyPaid])).toEqual([partiallyPaid]);
  });

  it('remove uma OS cancelada mesmo com saldo', () => {
    expect(selectSelectableApprovedOrders([
      order({ remainingBudget: 500, status: 'Cancelado' }),
    ])).toEqual([]);
  });

  it('mantém uma OS com orçamento recém-aprovado', () => {
    const justApproved = order({ remainingBudget: 500, status: 'Orçamento aprovado' });
    expect(selectSelectableApprovedOrders([justApproved])).toEqual([justApproved]);
  });

  it('mantém uma OS com serviço em execução', () => {
    const inProgress = order({ remainingBudget: 500, status: 'Serviço em execução' });
    expect(selectSelectableApprovedOrders([inProgress])).toEqual([inProgress]);
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(selectSelectableApprovedOrders([])).toEqual([]);
  });
});

describe('filterApprovedOrdersByQuery', () => {
  const orders = [
    order(),
    order({
      osNumber: 'OS-2607-7788',
      workshopName: 'Mecânica Central',
      vehiclePlate: 'XYZ9K88',
    }),
  ];

  it('busca por trecho da placa', () => {
    expect(filterApprovedOrdersByQuery(orders, '1d23')).toEqual([orders[0]]);
  });

  it('busca pelo número da OS', () => {
    expect(filterApprovedOrdersByQuery(orders, 'OS-2606')).toEqual([orders[0]]);
  });

  it('busca oficina ignorando acento e caixa', () => {
    expect(filterApprovedOrdersByQuery(orders, 'sao joao')).toEqual([orders[0]]);
  });

  it('devolve a lista inteira para query vazia ou só com espaços', () => {
    expect(filterApprovedOrdersByQuery(orders, '')).toEqual(orders);
    expect(filterApprovedOrdersByQuery(orders, '   ')).toEqual(orders);
  });

  it('devolve vazio quando não há correspondência', () => {
    expect(filterApprovedOrdersByQuery(orders, 'inexistente')).toEqual([]);
  });

  it('mantém OS sem placa encontrável pelo número e pela oficina', () => {
    const withoutPlate = order({ vehiclePlate: undefined });
    expect(filterApprovedOrdersByQuery([withoutPlate], '2606-1298')).toEqual([withoutPlate]);
    expect(filterApprovedOrdersByQuery([withoutPlate], 'sao joao')).toEqual([withoutPlate]);
  });
});
