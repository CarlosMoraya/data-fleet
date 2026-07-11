import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../types';

let authState: {
  user: User | null;
  logout: () => Promise<void>;
} = {
  user: null,
  logout: async () => {},
};

let lastNavigateTo: string | null = null;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('react-router-dom', () => ({
  NavLink: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string | ((args: { isActive: boolean }) => string);
  }) => (
    <a
      href={to}
      data-classname={typeof className === 'function' ? className({ isActive: false }) : className}
    >
      {children}
    </a>
  ),
  Navigate: ({ to }: { to: string }) => {
    lastNavigateTo = to;
    return <div data-testid="navigate" data-to={to} />;
  },
  Outlet: () => <div data-testid="outlet" />,
}));

// eslint-disable-next-line import/order -- vi.mock calls above are hoisted by Vitest; SUT import must follow mock registration for correct module resolution
import ControleCarretas from './ControleCarretas';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  lastNavigateTo = null;
});

afterEach(() => {
  const root = (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  authState = {
    user: null,
    logout: async () => {},
  };
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

describe('ControleCarretas', () => {
  it('renderiza as duas abas para papel de escritório (Coordinator)', () => {
    authState = {
      user: {
        id: 'u1',
        name: 'Coord User',
        email: 'coord@example.com',
        role: 'Coordinator',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      logout: async () => {},
    };

    renderWithAct(<ControleCarretas />);

    expect(container.textContent).toContain('Histórico de engates');
    expect(container.textContent).toContain('Engate');
  });

  it('renderiza apenas "Engate" para Operador de Engate, sem a barra de abas', () => {
    authState = {
      user: {
        id: 'u2',
        name: 'Coupling User',
        email: 'coupling@example.com',
        role: 'Coupling Agent',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      logout: async () => {},
    };

    renderWithAct(<ControleCarretas />);

    expect(container.textContent).toContain('Engate');
    expect(container.textContent).not.toContain('Histórico de engates');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('redireciona papel sem acesso (Driver) para /checklists', () => {
    authState = {
      user: {
        id: 'u3',
        name: 'Driver User',
        email: 'driver@example.com',
        role: 'Driver',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      logout: async () => {},
    };

    renderWithAct(<ControleCarretas />);

    expect(lastNavigateTo).toBe('/checklists');
  });
});