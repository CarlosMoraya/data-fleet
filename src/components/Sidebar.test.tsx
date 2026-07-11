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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('react-router-dom', () => ({
  NavLink: ({
    children,
    to,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string | ((args: { isActive: boolean }) => string);
    onClick?: () => void;
  }) => (
    <a
      href={to}
      data-classname={typeof className === 'function' ? className({ isActive: false }) : className}
      onClick={onClick}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

// eslint-disable-next-line import/order -- vi.mock calls above are hoisted by Vitest; SUT import must follow mock registration for correct module resolution
import Sidebar from './Sidebar';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
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

describe('Sidebar', () => {
  it('does not expose restricted nav items when role is an empty string', () => {
    authState = {
      user: {
        id: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        role: '' as User['role'],
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Dashboard');
    expect(container.textContent).not.toContain('Cadastros');
    expect(container.textContent).toContain('Alterar senha');
    expect(container.textContent).toContain('Logout');
  });

  it('papel de escritório vê "Controle de carretas" e não vê os itens antigos', () => {
    authState = {
      user: {
        id: 'u2',
        name: 'Coord User',
        email: 'coord@example.com',
        role: 'Coordinator',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).toContain('Controle de carretas');
    expect(container.textContent).not.toContain('Engates/Pátio');
  });

  it('Operador de Engate vê "Controle de carretas"', () => {
    authState = {
      user: {
        id: 'u3',
        name: 'Coupling User',
        email: 'coupling@example.com',
        role: 'Coupling Agent',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).toContain('Controle de carretas');
  });
});
