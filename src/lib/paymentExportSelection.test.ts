import { describe, expect, it } from 'vitest';

import { resolveExportSelection } from './paymentExportSelection';

import type { PaymentInstallment } from '../types/payment';

function makeInstallment(id: string): PaymentInstallment {
  return {
    id,
    maintenanceOrderId: 'mo-1',
    sourceType: 'maintenance_order',
    clientId: 'c1',
    installmentNumber: 1,
    installmentsTotal: 1,
    value: 100,
    dueDate: '2026-07-10',
    status: 'pendente_aprovacao',
    paymentMethod: 'boleto',
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
  };
}

describe('resolveExportSelection', () => {
  it('sem seleção retorna todos os filtrados', () => {
    const filtered = [makeInstallment('a'), makeInstallment('b')];

    expect(resolveExportSelection(filtered, new Set())).toEqual(filtered);
  });

  it('com seleção retorna só os selecionados que estão em filtered', () => {
    const filtered = [makeInstallment('a'), makeInstallment('b'), makeInstallment('c')];

    expect(resolveExportSelection(filtered, new Set(['a', 'c']))).toEqual([
      filtered[0],
      filtered[2],
    ]);
  });

  it('seleção de id inexistente em filtered não inclui item', () => {
    const filtered = [makeInstallment('a')];

    expect(resolveExportSelection(filtered, new Set(['missing']))).toEqual([]);
  });
});
