import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Client, Role, User } from '../types';

const MELI_CLIENT_ID = 'meli-client';

let authState: { user: User | null; currentClient: Client | null } = {
  user: null,
  currentClient: null,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

// eslint-disable-next-line import/order -- vi.mock above is hoisted; SUT import follows mock registration
import { useMeliUtilizationAccess } from './useMeliUtilizationAccess';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
  vi.unstubAllEnvs();
});

function setAuth(role: Role, clientId: string | null) {
  authState = {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role,
      clientId: clientId ?? '',
      budgetApprovalLimit: 0,
    },
    currentClient: clientId ? ({ id: clientId, name: 'Cliente' } as Client) : null,
  };
}

function renderAccess(): { canView: boolean } {
  let result = { canView: false };

  function Probe() {
    result = useMeliUtilizationAccess();
    return null;
  }

  root = createRoot(container);
  act(() => root.render(<Probe />));
  return result;
}

describe('useMeliUtilizationAccess', () => {
  it('libera papel permitido no tenant configurado', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', MELI_CLIENT_ID);
    setAuth('Manager', MELI_CLIENT_ID);

    expect(renderAccess()).toEqual({ canView: true });
  });

  it('bloqueia Driver no tenant configurado', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', MELI_CLIENT_ID);
    setAuth('Driver', MELI_CLIENT_ID);

    expect(renderAccess()).toEqual({ canView: false });
  });

  it('bloqueia papel permitido em outro tenant', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', MELI_CLIENT_ID);
    setAuth('Director', 'outro-tenant');

    expect(renderAccess()).toEqual({ canView: false });
  });

  it('bloqueia quando a variável está vazia', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', '');
    setAuth('Manager', MELI_CLIENT_ID);

    expect(renderAccess()).toEqual({ canView: false });
  });

  it('bloqueia Admin Master sem cliente selecionado', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', MELI_CLIENT_ID);
    setAuth('Admin Master', null);

    expect(renderAccess()).toEqual({ canView: false });
  });
});
