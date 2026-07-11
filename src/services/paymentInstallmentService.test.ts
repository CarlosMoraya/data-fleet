import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { getPaymentInstallmentAuditors } from './paymentInstallmentService';

describe('getPaymentInstallmentAuditors', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('mapeia os três nomes para camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          budget_approved_by_name: 'Ana',
          payment_approved_by_name: 'Bruno',
          paid_by_name: 'Carla',
        },
      ],
      error: null,
    });

    const result = await getPaymentInstallmentAuditors('i1');

    expect(result).toEqual({
      budgetApprovedByName: 'Ana',
      paymentApprovedByName: 'Bruno',
      paidByName: 'Carla',
    });
    expect(rpcMock).toHaveBeenCalledWith('get_payment_installment_auditors', {
      p_installment_id: 'i1',
    });
  });

  it('retorna todos os campos undefined quando a RPC não retorna linhas', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await getPaymentInstallmentAuditors('i1');

    expect(result).toEqual({
      budgetApprovedByName: undefined,
      paymentApprovedByName: undefined,
      paidByName: undefined,
    });
  });

  it('mantém apenas os nomes preenchidos quando os demais campos vêm nulos', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          budget_approved_by_name: null,
          payment_approved_by_name: 'Bruno',
          paid_by_name: null,
        },
      ],
      error: null,
    });

    const result = await getPaymentInstallmentAuditors('i1');

    expect(result).toEqual({
      budgetApprovedByName: undefined,
      paymentApprovedByName: 'Bruno',
      paidByName: undefined,
    });
  });

  it('lança quando a RPC retorna erro', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(getPaymentInstallmentAuditors('i1')).rejects.toBeTruthy();
  });
});
