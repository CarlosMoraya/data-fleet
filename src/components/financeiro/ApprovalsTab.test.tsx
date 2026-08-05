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

vi.mock('./PaymentApprovalsTab', () => ({
  default: () => <div data-testid="payment-approvals">PaymentApprovalsTab</div>,
}));
vi.mock('./ExtraPaymentApprovalsTab', () => ({
  default: () => <div data-testid="extra-approvals">ExtraPaymentApprovalsTab</div>,
}));

import ApprovalsTab from './ApprovalsTab';

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

function renderApprovalsTab(initialEntries: string[] = ['/financeiro']) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <ApprovalsTab />
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

describe('ApprovalsTab', () => {
  it('sem permissão de aprovação não renderiza nenhum segmento', async () => {
    setUser('Fleet Assistant');
    renderApprovalsTab();

    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it('com as duas permissões exibe os segmentos Pagamentos e Extras', async () => {
    setUser('Coordinator');
    renderApprovalsTab();

    await waitForAssertion(() => {
      const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((el) => el.textContent);
      expect(tabs).toEqual(['Pagamentos', 'Extras']);
    });
  });

  it('persiste o segmento selecionado em sessionStorage', async () => {
    setUser('Coordinator');
    renderApprovalsTab();

    await waitForAssertion(() => {
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    });

    const extrasTabButton = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === 'Extras',
    ) as HTMLButtonElement;
    act(() => {
      extrasTabButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      const keys = Object.keys(window.sessionStorage).filter((k) => k.includes('approvalSegment'));
      expect(keys.length).toBeGreaterThan(0);
      expect(window.sessionStorage.getItem(keys[0])).toContain('extras');
    });
  });

  it('parâmetro de URL segment válido prevalece e monta apenas o segmento ativo', async () => {
    setUser('Coordinator');
    renderApprovalsTab(['/financeiro?tab=approvals&segment=extras']);

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="extra-approvals"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="payment-approvals"]')).toBeNull();
  });

  it('segmento inválido na URL faz fallback para o primeiro permitido', async () => {
    setUser('Coordinator');
    renderApprovalsTab(['/financeiro?tab=approvals&segment=inexistente']);

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="payment-approvals"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="extra-approvals"]')).toBeNull();
  });
});
