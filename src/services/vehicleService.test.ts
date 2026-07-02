import { beforeEach, describe, expect, it, vi } from 'vitest';

const { eqMock, updateMock, fromMock } = vi.hoisted(() => ({
  eqMock: vi.fn(),
  updateMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { toggleVehicleActive } from './vehicleService';

import type { Vehicle } from '../types/vehicle';

describe('toggleVehicleActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
    eqMock.mockReset();
    updateMock.mockReset();
    fromMock.mockReset();
    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
  });

  it('sets inactivated audit fields when deactivating', async () => {
    const vehicle = { id: 'vehicle-1', active: true } as Vehicle;

    await toggleVehicleActive(vehicle, 'profile-1');

    expect(fromMock).toHaveBeenCalledWith('vehicles');
    expect(updateMock).toHaveBeenCalledWith({
      active: false,
      inactivated_at: '2026-07-02T12:00:00.000Z',
      inactivated_by: 'profile-1',
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'vehicle-1');
  });

  it('clears inactivated audit fields when reactivating', async () => {
    const vehicle = { id: 'vehicle-2', active: false } as Vehicle;

    await toggleVehicleActive(vehicle, 'profile-2');

    expect(updateMock).toHaveBeenCalledWith({
      active: true,
      inactivated_at: null,
      inactivated_by: null,
    });
  });
});
