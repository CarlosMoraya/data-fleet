import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockAuth {
  user: { id: string; role: string };
  currentClient: { id: string };
}

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn<() => MockAuth>() }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: (): MockAuth => authMock(),
}));

vi.mock('../../pages/BudgetApprovals', () => ({
  default: () => <div data-testid="budget-approvals">BudgetApprovals</div>,
}));
vi.mock('./BudgetHistoryTab', () => ({
  default: () => <div data-testid="budget-history">BudgetHistoryTab</div>,
}));

import BudgetApprovalsTab from './BudgetApprovalsTab';

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

function renderBudgetApprovalsTab(initialEntries: string[] = ['/financeiro']) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <BudgetApprovalsTab />
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
  setUser('Admin Master');
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => root.unmount());
  }
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('BudgetApprovalsTab', () => {
  it('exibe os dois segmentos, com Pendentes ativo por padrão', async () => {
    renderBudgetApprovalsTab();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
      expect(tabs.map((el) => el.textContent)).toEqual(['Pendentes', 'Histórico']);
      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
    });
    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="budget-approvals"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="budget-history"]')).toBeNull();
  });

  it('clicar em Histórico troca o aria-selected e monta o conteúdo do histórico', async () => {
    renderBudgetApprovalsTab();

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="budget-approvals"]')).not.toBeNull();
    });

    const historyTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === 'Histórico',
    ) as HTMLButtonElement;
    act(() => {
      historyTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="budget-history"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="budget-approvals"]')).toBeNull();
    });
    const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('false');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('persiste o segmento escolhido em sessionStorage sob a convenção bf:v1:ui', async () => {
    renderBudgetApprovalsTab();

    await waitForAssertion(() => {
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    });

    const historyTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === 'Histórico',
    ) as HTMLButtonElement;
    act(() => {
      historyTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      const keys = Object.keys(window.sessionStorage).filter((k) => k.includes('budgetSegment'));
      expect(keys.length).toBeGreaterThan(0);
      expect(window.sessionStorage.getItem(keys[0]!)).toContain('history');
    });
  });

  it('?segment=history na URL prevalece sobre o valor persistido', async () => {
    // Primeiro persiste "pending" clicando no segmento Pendentes.
    renderBudgetApprovalsTab();
    await waitForAssertion(() => {
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    });
    const pendingTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === 'Pendentes',
    ) as HTMLButtonElement;
    act(() => {
      pendingTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitForAssertion(() => {
      const keys = Object.keys(window.sessionStorage).filter((k) => k.includes('budgetSegment'));
      expect(window.sessionStorage.getItem(keys[0]!)).toContain('pending');
    });
    // Desmonta para re-renderizar com URL de histórico.
    act(() => container.__reactRoot?.unmount());

    renderBudgetApprovalsTab(['/financeiro?tab=budget&segment=history']);
    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="budget-history"]')).not.toBeNull();
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('segmento inválido na URL faz fallback para Pendentes', async () => {
    renderBudgetApprovalsTab(['/financeiro?tab=budget&segment=xpto']);

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="budget-approvals"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="budget-history"]')).toBeNull();
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    });
  });
});