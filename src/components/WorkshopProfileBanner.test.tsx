import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { User, WorkshopAccount } from '../types';

let authState: {
  user: User | null;
  workshopAccount: WorkshopAccount | null;
} = {
  user: null,
  workshopAccount: null,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import WorkshopProfileBanner from './WorkshopProfileBanner';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

function makeUser(role: User['role']): User {
  return {
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    role,
    clientId: 'c1',
    budgetApprovalLimit: 0,
  };
}

const INCOMPLETE_ACCOUNT: WorkshopAccount = {
  id: 'wa-1',
  profileId: 'u1',
  name: 'Oficina Sem Cadastro',
  cnpj: '11222333000181',
  active: true,
};

const COMPLETE_ACCOUNT: WorkshopAccount = {
  ...INCOMPLETE_ACCOUNT,
  phone: '11999998888',
  email: 'contato@oficina.com',
  contactPerson: 'Carlos Silva',
  addressStreet: 'Rua das Flores',
  addressNumber: '123',
  addressNeighborhood: 'Centro',
  addressCity: 'São Paulo',
  addressState: 'SP',
  addressZip: '01001000',
  specialties: ['Freios'],
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  authState = { user: null, workshopAccount: null };
});

function renderBanner() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(<WorkshopProfileBanner />);
  });
}

describe('WorkshopProfileBanner', () => {
  it('Workshop com conta incompleta vê a faixa, o botão e os rótulos faltantes', () => {
    authState = { user: makeUser('Workshop'), workshopAccount: INCOMPLETE_ACCOUNT };

    renderBanner();

    expect(container.textContent).toContain('Complete o cadastro da sua oficina');
    expect(container.textContent).toContain(
      'Enquanto o cadastro estiver incompleto você pode acompanhar as ordens de serviço, mas não enviar orçamentos nem atualizar status.'
    );
    expect(container.textContent).toContain('Complete seu cadastro');
    expect(container.textContent).toContain('Telefone');
    expect(container.textContent).toContain('Especialidades');
    expect(container.textContent).toContain('CEP');
  });

  it('Workshop com conta completa não renderiza nada', () => {
    authState = { user: makeUser('Workshop'), workshopAccount: COMPLETE_ACCOUNT };

    renderBanner();

    expect(container.textContent).toBe('');
  });

  it('Fleet Analyst não renderiza nada, mesmo com workshopAccount nulo', () => {
    authState = { user: makeUser('Fleet Analyst'), workshopAccount: null };

    renderBanner();

    expect(container.textContent).toBe('');
  });
});
