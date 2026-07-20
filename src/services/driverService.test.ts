import { beforeEach, describe, expect, it, vi } from 'vitest';

const { eqMock, updateMock, fromMock, invokeEdgeFunctionMock } = vi.hoisted(() => ({
  eqMock: vi.fn(),
  updateMock: vi.fn(),
  fromMock: vi.fn(),
  invokeEdgeFunctionMock: vi.fn(),
}));

vi.mock('../lib/invokeEdgeFn', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { shouldClearServiceContract, toggleDriverActive } from './driverService';

import type { Driver } from '../types/driver';

describe('toggleDriverActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
    eqMock.mockReset();
    updateMock.mockReset();
    fromMock.mockReset();
    invokeEdgeFunctionMock.mockReset();
    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
  });

  it('blocks auth access when deactivating a driver with profile', async () => {
    const driver = { id: 'driver-1', active: true, profileId: 'profile-1' } as Driver;

    await toggleDriverActive(driver, 'editor-1');

    expect(updateMock).toHaveBeenCalledWith({
      active: false,
      inactivated_at: '2026-07-02T12:00:00.000Z',
      inactivated_by: 'editor-1',
    });
    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('create-user', {
      action: 'block',
      user_id: 'profile-1',
    });
  });

  it('unblocks auth access when reactivating a driver with profile', async () => {
    const driver = { id: 'driver-2', active: false, profileId: 'profile-2' } as Driver;

    await toggleDriverActive(driver, 'editor-2');

    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('create-user', {
      action: 'unblock',
      user_id: 'profile-2',
    });
  });

  it('does not call edge function when profileId is absent', async () => {
    const driver = { id: 'driver-3', active: true } as Driver;

    await toggleDriverActive(driver, 'editor-3');

    expect(invokeEdgeFunctionMock).not.toHaveBeenCalled();
  });
});

describe('shouldClearServiceContract', () => {
  it('limpa contrato quando PJ vira CLT', () => {
    expect(shouldClearServiceContract('CLT', 'https://x/contrato.pdf')).toBe(true);
  });

  it('preserva contrato enquanto o regime é PJ', () => {
    expect(shouldClearServiceContract('PJ', 'https://x/contrato.pdf')).toBe(false);
  });

  it('não limpa quando não existe contrato', () => {
    expect(shouldClearServiceContract('CLT', undefined)).toBe(false);
    expect(shouldClearServiceContract('CLT', null)).toBe(false);
  });

  it('limpa contrato legado quando o regime não foi informado', () => {
    expect(shouldClearServiceContract(null, 'https://x/contrato.pdf')).toBe(true);
  });

  it('ignora URL vazia', () => {
    expect(shouldClearServiceContract(undefined, '')).toBe(false);
  });
});
