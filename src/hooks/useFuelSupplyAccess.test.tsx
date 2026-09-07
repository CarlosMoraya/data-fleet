import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Client, Role, User } from '../types';

const DELUNA_CLIENT_ID = '11111111-1111-1111-1111-111111111111';

let authState: { user: User | null; currentClient: Client | null } = {
  user: null,
  currentClient: null,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

// eslint-disable-next-line import/order -- vi.mock calls above are hoisted by Vitest; SUT import must follow mock registration
import { useFuelSupplyAccess } from './useFuelSupplyAccess';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
  vi.unstubAllEnvs();
});

function setAuth(role: Role, clientId: string | null) {
  authState = {
    user: {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role,
      clientId: clientId ?? '',
      budgetApprovalLimit: 0,
    },
    currentClient: clientId ? ({ id: clientId, name: 'Cliente' } as Client) : null,
  };
}

function renderAccess(): { canView: boolean; canSync: boolean } {
  let result: { canView: boolean; canSync: boolean } = { canView: false, canSync: false };

  function Probe() {
    result = useFuelSupplyAccess();
    return null;
  }

  root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
  return result;
}

describe('useFuelSupplyAccess', () => {
  it('libera visualização e sync para Manager do tenant Deluna', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', DELUNA_CLIENT_ID);
    setAuth('Manager', DELUNA_CLIENT_ID);

    expect(renderAccess()).toEqual({ canView: true, canSync: true });
  });

  it('libera apenas visualização para Fleet Analyst do tenant Deluna', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', DELUNA_CLIENT_ID);
    setAuth('Fleet Analyst', DELUNA_CLIENT_ID);

    expect(renderAccess()).toEqual({ canView: true, canSync: false });
  });

  it('bloqueia tudo para usuário de outro tenant', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', DELUNA_CLIENT_ID);
    setAuth('Director', 'outro-tenant');

    expect(renderAccess()).toEqual({ canView: false, canSync: false });
  });

  it('bloqueia tudo quando VITE_VELOE_CLIENT_ID está ausente', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', '');
    setAuth('Manager', DELUNA_CLIENT_ID);

    expect(renderAccess()).toEqual({ canView: false, canSync: false });
  });
});
