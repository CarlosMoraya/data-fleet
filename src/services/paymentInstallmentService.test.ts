import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import {
  approveMaintenancePaymentGroup,
  createExtraPaymentInstallmentsBatch,
  createPaymentInstallmentsBatch,
  getPaymentInstallmentAuditors,
  listApprovedOrdersForPayment,
  listPaymentInstallments,
} from './paymentInstallmentService';

describe('getPaymentInstallmentAuditors', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
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

describe('listApprovedOrdersForPayment', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('calcula remainingBudget por OS aprovada', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      data: [
        {
          id: 'os-1',
          os_number: 'OS-001',
          client_id: 'client-1',
          approved_cost: 1000,
          budget_pdf_url: 'budget-1.pdf',
          workshops: { name: 'Oficina A', cnpj: '111' },
          payment_installments: [],
        },
        {
          id: 'os-2',
          os_number: 'OS-002',
          client_id: 'client-1',
          approved_cost: 1000,
          budget_pdf_url: null,
          workshops: { name: 'Oficina B', cnpj: null },
          payment_installments: [
            { value: 400, status: 'pendente_aprovacao' },
            { value: 600, status: 'aprovado' },
          ],
        },
        {
          id: 'os-3',
          os_number: 'OS-003',
          client_id: 'client-1',
          approved_cost: 1000,
          budget_pdf_url: null,
          workshops: null,
          payment_installments: [
            { value: 400, status: 'reprovado' },
            { value: 600, status: 'aprovado' },
          ],
        },
        {
          id: 'os-4',
          os_number: 'OS-004',
          client_id: 'client-1',
          approved_cost: null,
          budget_pdf_url: null,
          workshops: { name: 'Oficina D', cnpj: null },
          payment_installments: [],
        },
      ],
      error: null,
    };
    fromMock.mockReturnValue(query);

    const result = await listApprovedOrdersForPayment('client-1');

    expect(result).toMatchObject([
      {
        id: 'os-1',
        osNumber: 'OS-001',
        approvedCost: 1000,
        remainingBudget: 1000,
        budgetPdfUrl: 'budget-1.pdf',
        workshopName: 'Oficina A',
        workshopCnpj: '111',
        clientId: 'client-1',
      },
      {
        id: 'os-2',
        osNumber: 'OS-002',
        approvedCost: 1000,
        remainingBudget: 0,
        workshopName: 'Oficina B',
        workshopCnpj: undefined,
        clientId: 'client-1',
      },
      {
        id: 'os-3',
        osNumber: 'OS-003',
        approvedCost: 1000,
        remainingBudget: 400,
        workshopName: '—',
        clientId: 'client-1',
      },
      {
        id: 'os-4',
        osNumber: 'OS-004',
        approvedCost: 0,
        remainingBudget: 0,
        workshopName: 'Oficina D',
        clientId: 'client-1',
      },
    ]);
    expect(fromMock).toHaveBeenCalledWith('maintenance_orders');
    expect(query.eq).toHaveBeenCalledWith('budget_status', 'aprovado');
    expect(query.eq).toHaveBeenCalledWith('client_id', 'client-1');
  });
});

describe('createPaymentInstallmentsBatch', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('propaga notes para as linhas inseridas quando informado', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert: insertMock });

    await createPaymentInstallmentsBatch({
      maintenanceOrderId: 'mo-1',
      clientId: 'client-1',
      createdById: 'user-1',
      installmentsTotal: 1,
      descricao: 'Serviço X',
      notes: 'Observação de teste',
      drafts: [
        { installmentNumber: 1, value: 100, dueDate: '2026-08-01', paymentMethod: 'boleto' },
      ],
    });

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({ notes: 'Observação de teste' }),
    ]);
  });

  it('grava notes como null quando omitido', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert: insertMock });

    await createPaymentInstallmentsBatch({
      maintenanceOrderId: 'mo-1',
      clientId: 'client-1',
      createdById: 'user-1',
      installmentsTotal: 1,
      drafts: [
        { installmentNumber: 1, value: 100, dueDate: '2026-08-01', paymentMethod: 'boleto' },
      ],
    });

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({ notes: null }),
    ]);
  });
});

describe('createExtraPaymentInstallmentsBatch', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('insere parcelas com source_type extra_payment, extra_payment_request_id e maintenance_order_id null', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert: insertMock });

    await createExtraPaymentInstallmentsBatch({
      extraPaymentRequestId: 'epr-1',
      clientId: 'client-1',
      createdById: 'user-1',
      installmentsTotal: 1,
      drafts: [
        { installmentNumber: 1, value: 350, dueDate: '2026-08-01', paymentMethod: 'pix' },
      ],
    });

    expect(fromMock).toHaveBeenCalledWith('payment_installments');
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        source_type: 'extra_payment',
        extra_payment_request_id: 'epr-1',
        maintenance_order_id: null,
        status: 'pendente_aprovacao',
      }),
    ]);
  });
});

describe('approveMaintenancePaymentGroup', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('lança erro sem chamar a RPC quando o array de parcelas é vazio', async () => {
    await expect(approveMaintenancePaymentGroup('mo-1', [])).rejects.toThrow(
      'Nenhuma parcela pendente foi informada para aprovação.',
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('monta o payload da RPC com ids e updatedAts alinhados', async () => {
    rpcMock.mockResolvedValue({
      data: [{ approved_count: 2, approved_ids: ['i1', 'i2'] }],
      error: null,
    });

    await approveMaintenancePaymentGroup('mo-1', [
      { id: 'i1', updatedAt: '2026-08-01T00:00:00Z' },
      { id: 'i2', updatedAt: '2026-08-02T00:00:00Z' },
    ]);

    expect(rpcMock).toHaveBeenCalledWith('approve_maintenance_payment_group', {
      p_maintenance_order_id: 'mo-1',
      p_installment_ids: ['i1', 'i2'],
      p_installment_updated_ats: ['2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z'],
    });
  });

  it('mapeia o retorno da RPC para camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [{ approved_count: 1, approved_ids: ['i1'] }],
      error: null,
    });

    const result = await approveMaintenancePaymentGroup('mo-1', [
      { id: 'i1', updatedAt: '2026-08-01T00:00:00Z' },
    ]);

    expect(result).toEqual({ approvedCount: 1, approvedIds: ['i1'] });
  });

  it('lança erro de consistência quando a quantidade retornada diverge do input', async () => {
    rpcMock.mockResolvedValue({
      data: [{ approved_count: 1, approved_ids: ['i1'] }],
      error: null,
    });

    await expect(
      approveMaintenancePaymentGroup('mo-1', [
        { id: 'i1', updatedAt: '2026-08-01T00:00:00Z' },
        { id: 'i2', updatedAt: '2026-08-02T00:00:00Z' },
      ]),
    ).rejects.toThrow('Não foi possível aprovar as parcelas. Tente novamente.');
  });

  it('propaga o erro retornado pelo Supabase', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(
      approveMaintenancePaymentGroup('mo-1', [{ id: 'i1', updatedAt: '2026-08-01T00:00:00Z' }]),
    ).rejects.toBeTruthy();
  });
});

describe('listPaymentInstallments com filtro sourceType', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('aplica eq(source_type, extra_payment) quando sourceType é informado', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      data: [],
      error: null,
    };
    fromMock.mockReturnValue(query);

    await listPaymentInstallments({ sourceType: 'extra_payment' });

    expect(query.eq).toHaveBeenCalledWith('source_type', 'extra_payment');
  });
});
