import { vi, describe, it, expect, beforeEach } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('../lib/invokeEdgeFn', () => ({ invokeEdgeFunction: invokeMock }));

import { toggleUserActive } from './userService';

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ success: true });
});

describe('toggleUserActive', () => {
  it('inativa um usuário ativo', async () => {
    await toggleUserActive({ id: 'profile-1', active: true });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('create-user', { action: 'set_active', user_id: 'profile-1', active: false });
  });

  it('reativa um usuário inativo', async () => {
    await toggleUserActive({ id: 'profile-2', active: false });
    expect(invokeMock).toHaveBeenCalledWith('create-user', { action: 'set_active', user_id: 'profile-2', active: true });
  });

  it('trata active undefined como ativo', async () => {
    await toggleUserActive({ id: 'profile-3' });
    expect(invokeMock).toHaveBeenCalledWith('create-user', { action: 'set_active', user_id: 'profile-3', active: false });
  });

  it('trata active null como ativo', async () => {
    await toggleUserActive({ id: 'profile-4', active: null });
    expect(invokeMock).toHaveBeenCalledWith('create-user', { action: 'set_active', user_id: 'profile-4', active: false });
  });

  it('propaga o erro da Edge Function', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Edge function error: 403 {"error":"Você não pode alterar o seu próprio status de ativação."}'));
    await expect(toggleUserActive({ id: 'profile-5', active: true })).rejects.toThrow('Edge function error: 403');
  });
});
