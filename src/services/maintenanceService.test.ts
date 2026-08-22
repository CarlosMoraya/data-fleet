import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { getMaintenanceBudgetApprovalDetails, saveMaintenanceOrder } from './maintenanceService';

function orderQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

function itemsQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('getMaintenanceBudgetApprovalDetails', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('mapeia cabeçalho e itens do orçamento aprovado', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') {
        return orderQuery({
          os_number: 'OS-0001',
          approved_cost: 1500,
          budget_discount: 50,
          budget_pdf_url: 'https://budget.pdf',
          workshops: { name: 'Oficina A' },
        });
      }
      return itemsQuery([
        {
          id: 'item-1', maintenance_order_id: 'mo-1', client_id: 'client-1',
          item_name: 'Pastilha', system: 'freios', quantity: 2, value: 100, discount: 0, sort_order: 0,
        },
      ]);
    });

    const result = await getMaintenanceBudgetApprovalDetails('mo-1');

    expect(result.osNumber).toBe('OS-0001');
    expect(result.approvedCost).toBe(1500);
    expect(result.budgetDiscount).toBe(50);
    expect(result.budgetPdfUrl).toBe('https://budget.pdf');
    expect(result.workshopName).toBe('Oficina A');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemName).toBe('Pastilha');
  });

  it('usa fallback "—" quando não há oficina e undefined quando não há PDF', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') {
        return orderQuery({
          os_number: 'OS-0002',
          approved_cost: null,
          budget_discount: null,
          budget_pdf_url: null,
          workshops: null,
        });
      }
      return itemsQuery([]);
    });

    const result = await getMaintenanceBudgetApprovalDetails('mo-2');

    expect(result.workshopName).toBe('—');
    expect(result.budgetPdfUrl).toBeUndefined();
    expect(result.approvedCost).toBe(0);
    expect(result.budgetDiscount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('propaga erro de query do cabeçalho', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') {
        return orderQuery(null, { message: 'order failed' });
      }
      return itemsQuery([]);
    });

    await expect(getMaintenanceBudgetApprovalDetails('mo-3')).rejects.toBeTruthy();
  });

  it('propaga erro de query dos itens', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') {
        return orderQuery({
          os_number: 'OS-0004',
          approved_cost: 100,
          budget_discount: 0,
          budget_pdf_url: null,
          workshops: null,
        });
      }
      return itemsQuery(null, { message: 'items failed' });
    });

    await expect(getMaintenanceBudgetApprovalDetails('mo-4')).rejects.toBeTruthy();
  });
});

describe('saveMaintenanceOrder — orçamento aprovado', () => {
  function mockSupabase() {
    const orderUpdate = vi.fn((_payload: Record<string, unknown>) => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const itemsDelete = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const itemsInsert = vi.fn((_rows: Record<string, unknown>[]) => Promise.resolve({ error: null }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') return { update: orderUpdate };
      if (table === 'maintenance_budget_items') return { delete: itemsDelete, insert: itemsInsert };
      throw new Error(`Tabela inesperada: ${table}`);
    });

    return { orderUpdate, itemsDelete, itemsInsert };
  }

  const approvedOrderData = {
    id: 'os-1',
    clientId: 'c1',
    vehicleId: 'v1',
    workshopId: 'w1',
    entryDate: '2026-08-20',
    expectedExitDate: '2026-08-30',
    type: 'Preventiva' as const,
    status: 'Serviço em execução' as const,
    description: 'Troca de pastilhas',
    notes: 'Observação interna',
    workshopOs: 'OS-9',
    mechanicName: 'Paulo',
    currentKm: 92000,
    estimatedCost: 350,
    approvedCost: 350,
    budgetDiscount: 50,
  };

  const item = { itemName: 'Pastilha', system: 'freios', quantity: 2, value: 100, discount: 0, sortOrder: 0 };

  beforeEach(() => {
    fromMock.mockReset();
  });

  it('com a oficina travada grava só os campos operacionais e não toca nos itens', async () => {
    const { orderUpdate } = mockSupabase();

    const orderId = await saveMaintenanceOrder({
      data: approvedOrderData,
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
      budgetLock: 'workshop',
    });

    expect(orderId).toBe('os-1');
    expect(fromMock).toHaveBeenCalledWith('maintenance_orders');
    expect(fromMock).not.toHaveBeenCalledWith('maintenance_budget_items');
    expect(orderUpdate).toHaveBeenCalledTimes(1);

    const payload = orderUpdate.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      'current_km',
      'expected_exit_date',
      'mechanic_name',
      'workshop_os_number',
    ]);
    expect(payload).toEqual({
      expected_exit_date: '2026-08-30',
      workshop_os_number: 'OS-9',
      mechanic_name: 'Paulo',
      current_km: 92000,
    });
  });

  it('sem trava mantém a substituição de itens', async () => {
    const { itemsDelete, itemsInsert } = mockSupabase();

    await saveMaintenanceOrder({
      data: approvedOrderData,
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
    });

    expect(fromMock).toHaveBeenCalledWith('maintenance_budget_items');
    expect(itemsDelete).toHaveBeenCalledTimes(1);
    expect(itemsInsert).toHaveBeenCalledTimes(1);
    expect(itemsInsert.mock.calls[0][0][0]).toMatchObject({
      maintenance_order_id: 'os-1',
      item_name: 'Pastilha',
      quantity: 2,
      value: 100,
    });
  });

  it('com o cliente travado grava o resto da OS, mas nenhuma coluna de orçamento', async () => {
    const { orderUpdate } = mockSupabase();

    const orderId = await saveMaintenanceOrder({
      data: approvedOrderData,
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
      budgetLock: 'client',
    });

    expect(orderId).toBe('os-1');
    expect(fromMock).not.toHaveBeenCalledWith('maintenance_budget_items');
    expect(orderUpdate).toHaveBeenCalledTimes(1);

    const payload = orderUpdate.mock.calls[0][0];
    // O que o cliente continua podendo gravar numa OS aprovada
    expect(payload).toMatchObject({
      status: 'Serviço em execução',
      description: 'Troca de pastilhas',
      notes: 'Observação interna',
      mechanic_name: 'Paulo',
      current_km: 92000,
      expected_exit_date: '2026-08-30',
    });
    // O que nunca pode ser reescrito
    expect(payload).not.toHaveProperty('budget_discount');
    expect(payload).not.toHaveProperty('estimated_cost');
    expect(payload).not.toHaveProperty('approved_cost');
    expect(payload).not.toHaveProperty('budget_status');
    expect(payload).not.toHaveProperty('budget_pdf_url');
  });

  it('com o cliente travado ignora um PDF novo em vez de reabrir a aprovação', async () => {
    const { orderUpdate } = mockSupabase();

    await saveMaintenanceOrder({
      data: approvedOrderData,
      budgetItems: [item],
      budgetFile: new File(['x'], 'novo-orcamento.pdf', { type: 'application/pdf' }),
      profileId: 'p1',
      budgetLock: 'client',
    });

    // Uma única escrita, sem o update que devolveria a OS para 'Aguardando aprovação'
    expect(orderUpdate).toHaveBeenCalledTimes(1);
    expect(orderUpdate.mock.calls[0][0]).not.toHaveProperty('budget_status');
    expect(fromMock).not.toHaveBeenCalledWith('maintenance_budget_items');
  });
});

describe('saveMaintenanceOrder — orçamento reaberto', () => {
  function mockSupabase() {
    const orderUpdate = vi.fn((_payload: Record<string, unknown>) => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const itemsDelete = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const itemsInsert = vi.fn((_rows: Record<string, unknown>[]) => Promise.resolve({ error: null }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_orders') return { update: orderUpdate };
      if (table === 'maintenance_budget_items') return { delete: itemsDelete, insert: itemsInsert };
      throw new Error(`Tabela inesperada: ${table}`);
    });

    return { orderUpdate, itemsDelete, itemsInsert };
  }

  const reopenedOrderData = {
    id: 'os-2',
    clientId: 'c1',
    vehicleId: 'v1',
    workshopId: 'w1',
    entryDate: '2026-08-20',
    expectedExitDate: '2026-08-30',
    type: 'Corretiva' as const,
    status: 'Aguardando orçamento' as const,
    description: 'Revisão do orçamento',
    budgetPdfUrl: 'c1/os-2/orcamento.pdf',
    estimatedCost: 350,
  };

  const item = { itemName: 'Pastilha', system: 'freios', quantity: 2, value: 100, discount: 0, sortOrder: 0 };

  const resubmitPayload = { budget_status: 'pendente', status: 'Aguardando aprovação' };

  beforeEach(() => {
    fromMock.mockReset();
  });

  it('cenário feliz: reaberto com itens e PDF volta para a fila de aprovação', async () => {
    const { orderUpdate } = mockSupabase();

    await saveMaintenanceOrder({
      data: reopenedOrderData,
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
      currentBudgetStatus: 'reaberto',
    });

    const payloads = orderUpdate.mock.calls.map(c => c[0]);
    expect(payloads).toContainEqual(resubmitPayload);
  });

  it('CRÍTICO: orçamento aprovado não sofre o update de reenvio e mantém o payload restrito', async () => {
    const { orderUpdate } = mockSupabase();

    await saveMaintenanceOrder({
      data: { ...reopenedOrderData, status: 'Serviço em execução' as const },
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
      budgetLock: 'client',
      currentBudgetStatus: 'aprovado',
    });

    expect(orderUpdate).toHaveBeenCalledTimes(1);
    const payload = orderUpdate.mock.calls[0][0];
    expect(payload).not.toHaveProperty('budget_status');
    expect(payload).not.toHaveProperty('approved_cost');
    expect(payload).not.toHaveProperty('estimated_cost');
    expect(payload).not.toHaveProperty('budget_discount');
    expect(fromMock).not.toHaveBeenCalledWith('maintenance_budget_items');
  });

  it('edge: reaberto sem PDF não dispara o reenvio', async () => {
    const { orderUpdate } = mockSupabase();

    await saveMaintenanceOrder({
      data: { ...reopenedOrderData, budgetPdfUrl: undefined },
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
      currentBudgetStatus: 'reaberto',
    });

    const payloads = orderUpdate.mock.calls.map(c => c[0]);
    expect(payloads).not.toContainEqual(resubmitPayload);
  });

  it('edge: reaberto sem itens significativos não dispara o reenvio', async () => {
    const { orderUpdate } = mockSupabase();

    await saveMaintenanceOrder({
      data: reopenedOrderData,
      budgetItems: [{ ...item, itemName: '  ' }],
      budgetFile: null,
      profileId: 'p1',
      currentBudgetStatus: 'reaberto',
    });

    const payloads = orderUpdate.mock.calls.map(c => c[0]);
    expect(payloads).not.toContainEqual(resubmitPayload);
  });

  it('sem currentBudgetStatus o comportamento de hoje não muda', async () => {
    const { orderUpdate } = mockSupabase();

    await saveMaintenanceOrder({
      data: reopenedOrderData,
      budgetItems: [item],
      budgetFile: null,
      profileId: 'p1',
    });

    const payloads = orderUpdate.mock.calls.map(c => c[0]);
    expect(payloads).not.toContainEqual(resubmitPayload);
  });
});
