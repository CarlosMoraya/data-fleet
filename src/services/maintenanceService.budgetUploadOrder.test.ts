import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, uploadMock, uuidMock, callOrder } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  uploadMock: vi.fn(),
  uuidMock: vi.fn(),
  callOrder: [] as string[],
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

vi.mock('../lib/storageHelpers', () => ({
  uploadMaintenanceBudget: uploadMock,
}));

vi.mock('../lib/uuid', () => ({
  safeRandomUUID: uuidMock,
}));

import { saveMaintenanceOrder } from './maintenanceService';

function mockSupabase() {
  const orderUpdate = vi.fn((_payload: Record<string, unknown>) => {
    callOrder.push('update');
    return { eq: vi.fn().mockResolvedValue({ error: null }) };
  });
  const orderInsert = vi.fn((_rows: Record<string, unknown>[]) => {
    callOrder.push('insert');
    return {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'os-gerada' }, error: null }),
    };
  });
  const itemsDelete = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  const itemsInsert = vi.fn(() => Promise.resolve({ error: null }));

  fromMock.mockImplementation((table: string) => {
    if (table === 'maintenance_orders') return { update: orderUpdate, insert: orderInsert };
    if (table === 'maintenance_budget_items') return { delete: itemsDelete, insert: itemsInsert };
    throw new Error(`Tabela inesperada: ${table}`);
  });

  return { orderUpdate, orderInsert };
}

const base = {
  clientId: 'c1',
  vehicleId: 'v1',
  workshopId: 'w1',
  entryDate: '2026-09-25',
  type: 'Preventiva' as const,
  status: 'Aguardando orçamento' as const,
  estimatedCost: 0,
};

const pdf = new File(['%PDF-1.4'], 'orcamento.pdf', { type: 'application/pdf' });

describe('saveMaintenanceOrder — PDF de orçamento em criação', () => {
  beforeEach(() => {
    fromMock.mockReset();
    uploadMock.mockReset();
    uuidMock.mockReset();
    callOrder.length = 0;
    uuidMock.mockReturnValue('os-gerada');
  });

  it('CRÍTICO: falha no envio do PDF não grava a OS (HTTP 520)', async () => {
    const { orderInsert, orderUpdate } = mockSupabase();
    uploadMock.mockRejectedValue(new Error('Erro ao enviar orçamento: HTTP 520 error'));

    await expect(saveMaintenanceOrder({
      data: { ...base },
      budgetItems: [],
      budgetFile: pdf,
      profileId: 'p1',
    })).rejects.toThrow('Erro ao enviar orçamento: HTTP 520 error');

    expect(orderInsert).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('envia o PDF sob o id gerado antes do INSERT e grava a OS com esse id', async () => {
    const { orderInsert, orderUpdate } = mockSupabase();
    uploadMock.mockImplementation(() => {
      callOrder.push('upload');
      return Promise.resolve('c1/maintenance/os-gerada/budget.pdf');
    });

    const orderId = await saveMaintenanceOrder({
      data: { ...base },
      budgetItems: [],
      budgetFile: pdf,
      profileId: 'p1',
    });

    expect(orderId).toBe('os-gerada');
    expect(callOrder).toEqual(['upload', 'insert', 'update']);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledWith('c1', 'os-gerada', pdf);
    expect(orderInsert.mock.calls[0][0][0].id).toBe('os-gerada');
    expect(orderUpdate.mock.calls[0][0]).toEqual({
      budget_pdf_url: 'c1/maintenance/os-gerada/budget.pdf',
      budget_status: 'pendente',
      status: 'Aguardando aprovação',
      budget_rejection_reason: null,
    });
  });

  it('sem PDF não chama o upload e grava a OS com o id gerado', async () => {
    const { orderInsert } = mockSupabase();

    const orderId = await saveMaintenanceOrder({
      data: { ...base },
      budgetItems: [],
      budgetFile: null,
      profileId: 'p1',
    });

    expect(orderId).toBe('os-gerada');
    expect(uploadMock).not.toHaveBeenCalled();
    expect(orderInsert.mock.calls[0][0][0].id).toBe('os-gerada');
  });

  it('edição mantém a ordem atual: UPDATE da OS, upload, UPDATE do orçamento', async () => {
    const { orderInsert } = mockSupabase();
    uploadMock.mockImplementation(() => {
      callOrder.push('upload');
      return Promise.resolve('c1/maintenance/os-1/budget.pdf');
    });

    const orderId = await saveMaintenanceOrder({
      data: { ...base, id: 'os-1' },
      budgetItems: [],
      budgetFile: pdf,
      profileId: 'p1',
      currentStatus: 'Aguardando orçamento',
      currentBudgetStatus: 'sem_orcamento',
    });

    expect(orderId).toBe('os-1');
    expect(callOrder).toEqual(['update', 'upload', 'update']);
    expect(uploadMock).toHaveBeenCalledWith('c1', 'os-1', pdf);
    expect(uuidMock).not.toHaveBeenCalled();
    expect(orderInsert).not.toHaveBeenCalled();
  });
});
