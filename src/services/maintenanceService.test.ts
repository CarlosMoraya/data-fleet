import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { getMaintenanceBudgetApprovalDetails } from './maintenanceService';

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
