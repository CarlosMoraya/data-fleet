import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockAuth {
  user: { id: string; role: string };
  currentClient: { id: string };
}

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn<() => MockAuth>() }));

vi.mock('../context/AuthContext', () => ({
  useAuth: (): MockAuth => authMock(),
}));

vi.mock('./BudgetApprovals', () => ({
  default: () => <div data-testid="budget-approvals">BudgetApprovals</div>,
}));
vi.mock('../components/financeiro/PaymentsTab', () => ({
  default: () => <div data-testid="payments-tab">PaymentsTab</div>,
}));
vi.mock('../components/financeiro/ApprovalsTab', () => ({
  default: () => <div data-testid="approvals-tab">ApprovalsTab</div>,
}));
vi.mock('../components/financeiro/ExtraPaymentsTab', () => ({
  default: () => <div data-testid="extras-tab">ExtraPaymentsTab</div>,
}));

import Financeiro from './Financeiro';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;

function setUser(role: string) {
  authMock.mockReturnValue({ user: { id: 'u1', role }, currentClient: { id: 'client-1' } });
}

async function waitForAssertion(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

function renderFinanceiro(initialEntries: string[] = ['/financeiro']) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Financeiro />
      </MemoryRouter>,
    );
  });
  return root;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => root.unmount());
  }
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('Financeiro — shell de quatro abas', () => {
  it('Admin Master vê as quatro abas na ordem definida', async () => {
    setUser('Admin Master');
    renderFinanceiro();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).toEqual(['Aprovação de Orçamentos', 'Pagamentos', 'Aprovações', 'Pagamentos Extras']);
    });
  });

  it('Financeiro vê somente Pagamentos e Pagamentos Extras', async () => {
    setUser('Financeiro');
    renderFinanceiro();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).toEqual(['Pagamentos', 'Pagamentos Extras']);
    });
  });

  it('Workshop vê somente Pagamentos', async () => {
    setUser('Workshop');
    renderFinanceiro();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).toEqual(['Pagamentos']);
    });
  });

  it('Fleet Assistant vê Orçamentos/Pagamentos/Extras, sem Aprovações', async () => {
    setUser('Fleet Assistant');
    renderFinanceiro();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).toEqual(['Aprovação de Orçamentos', 'Pagamentos', 'Pagamentos Extras']);
    });
  });

  it('Coordinator vê as quatro abas, incluindo Aprovações', async () => {
    setUser('Coordinator');
    renderFinanceiro();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).toEqual(['Aprovação de Orçamentos', 'Pagamentos', 'Aprovações', 'Pagamentos Extras']);
    });
  });

  it('não exibe os labels antigos das abas', async () => {
    setUser('Admin Master');
    renderFinanceiro();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).not.toContain('Orçamento');
      expect(tabs).not.toContain('Aprovação de Pagamentos');
      expect(tabs).not.toContain('Aprovação de Extras');
    });
  });

  it('?tab=budget prevalece e abre Aprovação de Orçamentos sem header duplicado', async () => {
    setUser('Admin Master');
    renderFinanceiro(['/financeiro?tab=budget']);

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="budget-approvals"]')).not.toBeNull();
    });
    expect(container.textContent).toContain('Aprovação de Orçamentos');
  });
});
