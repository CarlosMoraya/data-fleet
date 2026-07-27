import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));

import { getLoanDeliveryChecklistIds } from './vehicleLoanService';

describe('getLoanDeliveryChecklistIds', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('retorna Set vazio para lista de ids vazia, sem consultar o banco', async () => {
    const result = await getLoanDeliveryChecklistIds([]);

    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('mapeia os delivery_checklist_id retornados para um Set', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [{ delivery_checklist_id: 'c1' }, { delivery_checklist_id: 'c2' }],
      error: null,
    });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inMock }) });

    const result = await getLoanDeliveryChecklistIds(['c1', 'c2', 'c3']);

    expect(result).toEqual(new Set(['c1', 'c2']));
  });

  it('ignora linhas com delivery_checklist_id nulo', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [{ delivery_checklist_id: 'c1' }, { delivery_checklist_id: null }],
      error: null,
    });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inMock }) });

    const result = await getLoanDeliveryChecklistIds(['c1', 'c2']);

    expect(result).toEqual(new Set(['c1']));
  });

  it('propaga erro do Supabase', async () => {
    const inMock = vi.fn().mockResolvedValue({ data: null, error: new Error('boom') });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inMock }) });

    await expect(getLoanDeliveryChecklistIds(['c1'])).rejects.toThrow('boom');
  });
});
