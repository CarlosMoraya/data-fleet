import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { autoRetireVehicleFromWorkshop } from './workshopScheduleUtils';

describe('autoRetireVehicleFromWorkshop', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('não retira OS com orçamento pendente e não lança exceção quando nenhuma OS elegível existe', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const update = vi.fn();
    fromMock.mockReturnValue({ ...query, update });

    await expect(autoRetireVehicleFromWorkshop('vehicle-1', 'workshop-1', 'checklist-1')).resolves.toBeUndefined();

    expect(query.not).toHaveBeenCalledWith('budget_status', 'in', '("pendente","reaberto")');
    expect(update).not.toHaveBeenCalled();
  });
});
