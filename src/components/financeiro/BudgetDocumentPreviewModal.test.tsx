import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDetailsMock } = vi.hoisted(() => ({ getDetailsMock: vi.fn() }));

vi.mock('../../services/maintenanceService', () => ({
  getMaintenanceBudgetApprovalDetails: getDetailsMock,
}));

import BudgetDocumentPreviewModal from './BudgetDocumentPreviewModal';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };
let container: ReactContainer;
let queryClient: QueryClient;

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

function render(props: Partial<React.ComponentProps<typeof BudgetDocumentPreviewModal>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <BudgetDocumentPreviewModal
          open
          maintenanceOrderId="mo-1"
          osNumber="OS-0001"
          pendingInstallmentCount={2}
          pendingInstallmentTotal={500}
          onClose={vi.fn()}
          {...props}
        />
      </QueryClientProvider>,
    );
  });
  return root;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  getDetailsMock.mockReset();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

describe('BudgetDocumentPreviewModal', () => {
  it('possui role=dialog, aria-modal e título acessível', () => {
    getDetailsMock.mockReturnValue(new Promise(() => {}));
    render();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.hasAttribute('aria-labelledby')).toBe(true);
  });

  it('exibe itens via BudgetItemsTable (readOnly) quando há itens', async () => {
    getDetailsMock.mockResolvedValue({
      maintenanceOrderId: 'mo-1',
      osNumber: 'OS-0001',
      approvedCost: 1000,
      budgetDiscount: 100,
      budgetPdfUrl: 'https://budget.pdf',
      workshopName: 'Oficina A',
      items: [
        { itemName: 'Pastilha', system: 'freios', quantity: 2, value: 100, discount: 0, sortOrder: 0 },
      ],
    });
    render();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Pastilha');
    });
  });

  it('mostra estado amigável quando não há itens', async () => {
    getDetailsMock.mockResolvedValue({
      maintenanceOrderId: 'mo-1',
      osNumber: 'OS-0001',
      approvedCost: 0,
      budgetDiscount: 0,
      workshopName: '—',
      items: [],
    });
    render();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Nenhum item cadastrado no orçamento.');
    });
  });

  it('erro ao buscar itens mostra estado de erro na aba Itens', async () => {
    getDetailsMock.mockRejectedValue(new Error('fail'));
    render();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Não foi possível carregar os itens do orçamento.');
    });
  });

  it('PDF ausente mostra estado amigável na aba PDF, sem bloquear Itens', async () => {
    getDetailsMock.mockResolvedValue({
      maintenanceOrderId: 'mo-1',
      osNumber: 'OS-0001',
      approvedCost: 0,
      budgetDiscount: 0,
      workshopName: '—',
      items: [{ itemName: 'Pastilha', system: 'freios', quantity: 1, value: 10, discount: 0, sortOrder: 0 }],
    });
    render();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Pastilha');
    });

    const pdfTab = Array.from(container.querySelectorAll('[role="tab"]')).find((el) => el.textContent === 'PDF');
    act(() => { pdfTab?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(container.textContent).toContain('Nenhum PDF de orçamento anexado.');
  });

  it('Escape fecha o modal', () => {
    const onClose = vi.fn();
    getDetailsMock.mockReturnValue(new Promise(() => {}));
    render({ onClose });

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
