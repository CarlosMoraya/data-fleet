import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = 'client-1';

const { fromMock, mockAuthState, mockTableData } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  mockAuthState: {
    value: {
      user: { id: 'user-1', role: 'Fleet Analyst' as const, clientId: 'client-1' },
      currentClient: { id: 'client-1', name: 'Cliente Teste' },
      clients: [{ id: 'client-1', name: 'Cliente Teste' }],
    },
  },
  mockTableData: {
    templates: [] as unknown[],
    items: [] as unknown[],
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState.value,
}));

import ChecklistTemplates from './ChecklistTemplates';

import type { ChecklistTemplateRow, ChecklistItemRow } from '../lib/checklistTemplateMappers';

type TemplateRow = ChecklistTemplateRow;
type ItemRow = ChecklistItemRow;

const publishedTemplateRow: TemplateRow = {
  id: 'template-published-1',
  client_id: CLIENT_ID,
  vehicle_category: 'Pesado',
  context: 'Auditoria',
  name: 'Checklist Pesado Auditoria',
  description: 'Inspeção de auditoria do conjunto pesado.',
  current_version: 5,
  status: 'published',
  created_by: 'user-1',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const draftTemplateRow: TemplateRow = {
  id: 'template-draft-1',
  client_id: CLIENT_ID,
  vehicle_category: 'Médio',
  context: 'Auditoria',
  name: 'Checklist Médio Auditoria',
  description: null,
  current_version: 1,
  status: 'draft',
  created_by: 'user-1',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const freiosItemRow: ItemRow = {
  id: 'item-1',
  template_id: 'template-published-1',
  version_number: 5,
  title: 'Freios dianteiros',
  description: 'Verificar desgaste e vazamentos.',
  is_mandatory: true,
  require_photo_if_issue: true,
  can_block_vehicle: true,
  default_action: 'Abrir ordem de manutenção',
  order_number: 2,
};

const pneusItemRow: ItemRow = {
  id: 'item-pneus',
  template_id: 'template-published-1',
  version_number: 5,
  title: 'Pneus',
  description: 'Verificar calibragem.',
  is_mandatory: true,
  require_photo_if_issue: false,
  can_block_vehicle: false,
  default_action: null,
  order_number: 1,
};

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;
let queryClient: QueryClient;

function createChain(data: unknown): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
  return chain;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => {
    if (table === 'checklist_templates') {
      return createChain(mockTableData.templates) as never;
    }
    if (table === 'checklist_items') {
      return createChain(mockTableData.items) as never;
    }
    return createChain([]) as never;
  });
  sessionStorage.clear();
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  queryClient.clear();
  if (container.parentNode) document.body.removeChild(container);
  vi.clearAllMocks();
  sessionStorage.clear();
});

async function waitForAssertion(assertion: () => void): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < 2000) {
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

async function renderTemplates(): Promise<void> {
  const root = createRoot(container);
  container.__reactRoot = root;
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ChecklistTemplates />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
  await waitForAssertion(() => {
    const text = container.textContent ?? '';
    const hasData = text.includes('Checklist Pesado Auditoria') || text.includes('Checklist Médio Auditoria');
    if (!hasData && text.includes('Carregando templates')) throw new Error('still loading');
    if (!hasData) throw new Error('templates not rendered yet: ' + text.slice(0, 500));
  });
}

function findRowByName(name: string): HTMLTableRowElement | null {
  const rows = container.querySelectorAll('tbody tr');
  for (const row of rows) {
    if ((row.textContent ?? '').includes(name)) return row as HTMLTableRowElement;
  }
  return null;
}

describe('ChecklistTemplates.detailModal', () => {
  it('usuário Fleet Analyst vê o olho apenas na linha publicada, dentro da respectiva linha', async () => {
    mockAuthState.value = {
      user: { id: 'user-1', role: 'Fleet Analyst' as unknown as string, clientId: CLIENT_ID } as never,
      currentClient: { id: CLIENT_ID, name: 'Cliente Teste' },
      clients: [{ id: CLIENT_ID, name: 'Cliente Teste' }],
    };
    mockTableData.templates = [publishedTemplateRow, draftTemplateRow];
    mockTableData.items = [];

    await renderTemplates();

    const publishedRow = findRowByName('Checklist Pesado Auditoria');
    expect(publishedRow).not.toBeNull();
    const eyeInPublished = publishedRow?.querySelector('button[title="Visualizar"]');
    expect(eyeInPublished).not.toBeNull();
    expect(eyeInPublished?.getAttribute('aria-label')).toBe('Visualizar template');

    const draftRow = findRowByName('Checklist Médio Auditoria');
    expect(draftRow).not.toBeNull();
    const eyeInDraft = draftRow?.querySelector('button[title="Visualizar"]');
    expect(eyeInDraft).toBeNull();
  });

  it('Manager abre o detalhe da linha publicada e o dialog exibe Freios dianteiros e Publicado, sem controles de escrita no dialog', async () => {
    mockAuthState.value = {
      user: { id: 'user-manager', role: 'Manager', clientId: CLIENT_ID } as never,
      currentClient: { id: CLIENT_ID, name: 'Cliente Teste' },
      clients: [{ id: CLIENT_ID, name: 'Cliente Teste' }],
    };
    mockTableData.templates = [publishedTemplateRow];
    mockTableData.items = [pneusItemRow, freiosItemRow];

    await renderTemplates();

    const row = findRowByName('Checklist Pesado Auditoria');
    expect(row).not.toBeNull();
    const eye = row?.querySelector('button[title="Visualizar"]') as HTMLElement;
    expect(eye).not.toBeNull();

    await act(async () => {
      eye.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      const dialogText = dialog?.textContent ?? '';
      expect(dialogText).toContain('Detalhes do Template');
      expect(dialogText).toContain('Freios dianteiros');
      expect(dialogText).toContain('Publicado');
    });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const dialogText = dialog.textContent ?? '';
    // âncoras já provadas acima; agora negativas dentro do dialog
    expect(dialogText).not.toContain('Editar');
    expect(dialogText).not.toContain('Salvar alterações');
    expect(dialogText).not.toContain('Nova versão');

    // linha ainda possui ações de escrita
    const rowAfter = findRowByName('Checklist Pesado Auditoria');
    expect(rowAfter?.querySelector('button[title="Duplicar"]')).not.toBeNull();
    expect(rowAfter?.querySelector('button[title="Nova versão"]')).not.toBeNull();
    expect(rowAfter?.querySelector('button[title="Descontinuar"]')).not.toBeNull();
  });

  it('fechar o modal remove o dialog e limpa o estado selecionado', async () => {
    mockAuthState.value = {
      user: { id: 'user-manager', role: 'Manager', clientId: CLIENT_ID } as never,
      currentClient: { id: CLIENT_ID, name: 'Cliente Teste' },
      clients: [{ id: CLIENT_ID, name: 'Cliente Teste' }],
    };
    mockTableData.templates = [publishedTemplateRow];
    mockTableData.items = [freiosItemRow];

    await renderTemplates();

    const row = findRowByName('Checklist Pesado Auditoria');
    const eye = row?.querySelector('button[title="Visualizar"]') as HTMLElement;
    expect(eye).not.toBeNull();

    await act(async () => {
      eye.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    // provar presença inicial antes de verificar ausência
    const dialogBefore = document.body.querySelector('[role="dialog"]');
    expect(dialogBefore).not.toBeNull();
    expect(dialogBefore?.textContent).toContain('Detalhes do Template');

    const closeBtn = [...(document.body.querySelectorAll('button') as unknown as HTMLElement[])].find(
      (b) => b.textContent === 'Fechar',
    ) as HTMLElement;
    expect(closeBtn).not.toBeUndefined();

    await act(async () => {
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it('Admin Master sem cliente selecionado vê o olho na linha publicada, sem ações de escrita por causa do cliente não selecionado', async () => {
    mockAuthState.value = {
      user: { id: 'user-admin', role: 'Admin Master', clientId: null } as never,
      currentClient: null,
      clients: [{ id: CLIENT_ID, name: 'Cliente Teste' }],
    };
    mockTableData.templates = [publishedTemplateRow];
    mockTableData.items = [];

    await renderTemplates();

    // tabela agregada deve existir mesmo com blockWrite; cabeçalho inclui Cliente
    expect(container.textContent).toContain('Cliente');
    expect(container.textContent).toContain('Checklist Pesado Auditoria');

    const row = findRowByName('Checklist Pesado Auditoria');
    expect(row).not.toBeNull();
    const eye = row?.querySelector('button[title="Visualizar"]');
    expect(eye).not.toBeNull();
    expect(eye?.getAttribute('title')).toBe('Visualizar');

    // ações de escrita não devem aparecer quando Admin Master está sem cliente
    expect(row?.querySelector('button[title="Duplicar"]')).toBeNull();
    expect(row?.querySelector('button[title="Nova versão"]')).toBeNull();
    expect(row?.querySelector('button[title="Descontinuar"]')).toBeNull();
    expect(row?.querySelector('button[title="Excluir"]')).toBeNull();
  });
});
