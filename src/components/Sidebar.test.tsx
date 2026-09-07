import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Client, User } from '../types';

const DELUNA_CLIENT_ID = '11111111-1111-1111-1111-111111111111';

let authState: {
  user: User | null;
  currentClient: Client | null;
  logout: () => Promise<void>;
} = {
  user: null,
  currentClient: null,
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
    currentClient: null,
    logout: async () => {},
  };
  vi.unstubAllEnvs();
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
      currentClient: null,
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
      currentClient: null,
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
      currentClient: null,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).toContain('Controle de carretas');
  });

  it('papel Workshop vê o item "Minha Oficina"', () => {
    authState = {
      user: {
        id: 'u4',
        name: 'Workshop User',
        email: 'workshop@example.com',
        role: 'Workshop',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      currentClient: null,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).toContain('Minha Oficina');
  });

  it('papel Admin Master não vê o item "Minha Oficina"', () => {
    authState = {
      user: {
        id: 'u5',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'Admin Master',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      currentClient: null,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Minha Oficina');
  });

  it('regressão: contagem de itens visíveis para Admin Master inclui Chamados', () => {
    authState = {
      user: {
        id: 'u6',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'Admin Master',
        clientId: 'c1',
        budgetApprovalLimit: 0,
      },
      currentClient: null,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.querySelectorAll('nav a')).toHaveLength(12);
  });
  it('tenant Deluna + Manager vê o item "Abastecimento"', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', DELUNA_CLIENT_ID);
    authState = {
      user: {
        id: 'u7',
        name: 'Manager Deluna',
        email: 'manager@deluna.com',
        role: 'Manager',
        clientId: DELUNA_CLIENT_ID,
        budgetApprovalLimit: 0,
      },
      currentClient: { id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).toContain('Abastecimento');
  });

  it('tenant diferente + Manager não vê o item "Abastecimento"', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', DELUNA_CLIENT_ID);
    authState = {
      user: {
        id: 'u8',
        name: 'Manager Outro',
        email: 'manager@outro.com',
        role: 'Manager',
        clientId: 'outro-tenant',
        budgetApprovalLimit: 0,
      },
      currentClient: { id: 'outro-tenant', name: 'Outro Cliente' } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Abastecimento');
  });

  it('sem VITE_VELOE_CLIENT_ID o item "Abastecimento" fica ausente', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', '');
    authState = {
      user: {
        id: 'u9',
        name: 'Manager Deluna',
        email: 'manager@deluna.com',
        role: 'Manager',
        clientId: DELUNA_CLIENT_ID,
        budgetApprovalLimit: 0,
      },
      currentClient: { id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Abastecimento');
  });

  it('tenant Deluna + Operations Manager não vê o item "Abastecimento"', () => {
    vi.stubEnv('VITE_VELOE_CLIENT_ID', DELUNA_CLIENT_ID);
    authState = {
      user: {
        id: 'u10',
        name: 'Gestor de Operações',
        email: 'ops@deluna.com',
        role: 'Operations Manager',
        clientId: DELUNA_CLIENT_ID,
        budgetApprovalLimit: 0,
      },
      currentClient: { id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Abastecimento');
  });

  it('tenant habilitado + Director vê o item "Utilização MELI"', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', '6c5daeb6-df37-4e61-93c4-41975bf846c6');
    authState = {
      user: {
        id: 'u11',
        name: 'Director Deluna',
        email: 'director@deluna.com',
        role: 'Director',
        clientId: '6c5daeb6-df37-4e61-93c4-41975bf846c6',
        budgetApprovalLimit: 0,
      },
      currentClient: {
        id: '6c5daeb6-df37-4e61-93c4-41975bf846c6',
        name: 'Deluna Transportes',
      } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).toContain('Utilização MELI');
  });

  it('tenant diferente + Director não vê o item "Utilização MELI"', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', '6c5daeb6-df37-4e61-93c4-41975bf846c6');
    authState = {
      user: {
        id: 'u12',
        name: 'Director Outro',
        email: 'director@outro.com',
        role: 'Director',
        clientId: '00000000-0000-0000-0000-000000000002',
        budgetApprovalLimit: 0,
      },
      currentClient: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Outro Cliente',
      } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Utilização MELI');
  });

  it('sem VITE_LAST_ROUTE_CLIENT_ID o item "Utilização MELI" fica ausente', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', '');
    authState = {
      user: {
        id: 'u13',
        name: 'Director Deluna',
        email: 'director@deluna.com',
        role: 'Director',
        clientId: '6c5daeb6-df37-4e61-93c4-41975bf846c6',
        budgetApprovalLimit: 0,
      },
      currentClient: {
        id: '6c5daeb6-df37-4e61-93c4-41975bf846c6',
        name: 'Deluna Transportes',
      } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Utilização MELI');
  });

  it('tenant habilitado + Driver não vê o item "Utilização MELI"', () => {
    vi.stubEnv('VITE_LAST_ROUTE_CLIENT_ID', '6c5daeb6-df37-4e61-93c4-41975bf846c6');
    authState = {
      user: {
        id: 'u14',
        name: 'Driver Deluna',
        email: 'driver@deluna.com',
        role: 'Driver',
        clientId: '6c5daeb6-df37-4e61-93c4-41975bf846c6',
        budgetApprovalLimit: 0,
      },
      currentClient: {
        id: '6c5daeb6-df37-4e61-93c4-41975bf846c6',
        name: 'Deluna Transportes',
      } as Client,
      logout: async () => {},
    };

    renderWithAct(<Sidebar isOpen={false} onClose={() => {}} />);

    expect(container.textContent).not.toContain('Utilização MELI');
  });
});
