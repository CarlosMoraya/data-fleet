import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, selectMock, eqTemplateMock, eqVersionMock, orderMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqTemplateMock: vi.fn(),
  eqVersionMock: vi.fn(),
  orderMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import ChecklistTemplateDetailModal from './ChecklistTemplateDetailModal';

import type { ChecklistItemRow } from '../lib/checklistTemplateMappers';
import type { ChecklistTemplate } from '../types';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;
let queryClient: QueryClient;

const publishedTemplate: ChecklistTemplate = {
  id: 'template-published-1',
  clientId: 'client-1',
  vehicleCategory: 'Pesado',
  context: 'Auditoria',
  name: 'Checklist Pesado Auditoria',
  description: 'Inspeção de auditoria do conjunto pesado.',
  currentVersion: 5,
  status: 'published',
};

const itemPneusRow: ChecklistItemRow = {
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

const itemFreiosRow: ChecklistItemRow = {
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

const itemOpcionalRow: ChecklistItemRow = {
  id: 'item-opcional',
  template_id: 'template-published-1',
  version_number: 5,
  title: 'Limpeza do sistema de filtro',
  description: null,
  is_mandatory: false,
  require_photo_if_issue: false,
  can_block_vehicle: false,
  default_action: null,
  order_number: 1,
};

function seedItems(rows: ChecklistItemRow[]): void {
  orderMock.mockResolvedValue({ data: rows, error: null });
}

function seedError(message: string): void {
  orderMock.mockResolvedValue({ data: null, error: { message } });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  seedItems([]);
  eqVersionMock.mockReturnValue({ order: orderMock });
  eqTemplateMock.mockReturnValue({ eq: eqVersionMock });
  selectMock.mockReturnValue({ eq: eqTemplateMock });
  fromMock.mockReturnValue({ select: selectMock });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

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
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError;
}

async function renderModal(
  overrideTemplate: ChecklistTemplate = publishedTemplate,
  onClose: () => void = () => {},
): Promise<void> {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ChecklistTemplateDetailModal template={overrideTemplate} onClose={onClose} />
      </QueryClientProvider>,
    );
  });

  await waitForAssertion(() => {
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Carregando estrutura do checklist...');
  });
}

describe('ChecklistTemplateDetailModal', () => {
  it('exibe um dialog acessível com título, selo Publicado, versão v5 e botão Fechar, sem controles de edição', async () => {
    seedItems([itemPneusRow, itemFreiosRow]);
    await renderModal();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('checklist-template-detail-title');

    const dialogText = dialog?.textContent ?? '';
    expect(dialogText).toContain('Detalhes do Template');
    expect(dialogText).toContain('Publicado');
    expect(dialogText).toContain('v5');

    const closeButton = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Fechar',
    );
    expect(closeButton).not.toBeUndefined();

    expect(dialogText).not.toContain('Editar');
    expect(dialogText).not.toContain('Salvar alterações');
  });

  it('consulta os itens de checklist_items pela combinação exata de template e versão, ordenados por order_number', async () => {
    seedItems([itemPneusRow, itemFreiosRow]);
    await renderModal();

    expect(eqTemplateMock).toHaveBeenCalledWith('template_id', 'template-published-1');
    expect(eqVersionMock).toHaveBeenCalledWith('version_number', 5);
    expect(orderMock).toHaveBeenCalledWith('order_number', { ascending: true });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const dialogText = dialog?.textContent ?? '';
    expect(dialogText.indexOf('Pneus')).toBeLessThan(dialogText.indexOf('Freios dianteiros'));
  });

  it('exibe categoria, contexto e descrição do template, além do contador de itens', async () => {
    seedItems([itemPneusRow, itemFreiosRow]);
    await renderModal();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const metadataChips = [...container.querySelectorAll('span')].map((span) => span.textContent);
    expect(metadataChips).toContain('Pesado');
    expect(metadataChips).toContain('Auditoria');

    const dialogText = dialog?.textContent ?? '';
    expect(dialogText).toContain('Inspeção de auditoria do conjunto pesado.');
    expect(dialogText).toContain('Itens do checklist (2)');
  });

  it('numera os itens na ordem renderizada e coloca o item de ordem 1 antes de Freios dianteiros', async () => {
    seedItems([itemPneusRow, itemFreiosRow]);
    await renderModal();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const markers = [...container.querySelectorAll('span')].map((span) => span.textContent);
    expect(markers).toContain('1');
    expect(markers).toContain('2');

    const dialogText = dialog?.textContent ?? '';
    expect(dialogText.indexOf('Pneus')).toBeLessThan(dialogText.indexOf('Freios dianteiros'));
  });

  it('exibe todas as três flags verdadeiras e a ação sugerida do item completo', async () => {
    seedItems([itemFreiosRow]);
    await renderModal();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const dialogText = dialog?.textContent ?? '';

    expect(dialogText).toContain('Freios dianteiros');
    expect(dialogText).toContain('Obrigatório');
    expect(dialogText).toContain('Exigir foto se Problema');
    expect(dialogText).toContain('Bloqueia veículo se reprovado');
    expect(dialogText).toContain('Ação sugerida:');
    expect(dialogText).toContain('Abrir ordem de manutenção');
  });

  it('exibe Opcional para item opcional e omite as flags falsas e a ação ausente', async () => {
    seedItems([itemOpcionalRow]);
    await renderModal();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const dialogText = dialog?.textContent ?? '';

    expect(dialogText).toContain('Limpeza do sistema de filtro');
    expect(dialogText).toContain('Opcional');
    expect(dialogText).not.toContain('Obrigatório');
    expect(dialogText).not.toContain('Exigir foto se Problema');
    expect(dialogText).not.toContain('Bloqueia veículo se reprovado');
    expect(dialogText).not.toContain('Ação sugerida');
  });

  it('mostra a mensagem específica do contexto de hodômetro quando a versão não possui itens', async () => {
    seedItems([]);
    await renderModal({ ...publishedTemplate, context: 'Atualização de Hodômetro' });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const dialogText = dialog?.textContent ?? '';

    expect(dialogText).toContain(
      'Este contexto registra apenas o KM atual do veículo e não possui itens de checklist.',
    );
    expect(dialogText).not.toContain('Nenhum item cadastrado nesta versão.');
  });

  it('mostra a mensagem genérica de versão sem itens para contextos comuns', async () => {
    seedItems([]);
    await renderModal({ ...publishedTemplate, context: 'Rotina' });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const dialogText = dialog?.textContent ?? '';

    expect(dialogText).toContain('Nenhum item cadastrado nesta versão.');
    expect(dialogText).not.toContain(
      'Este contexto registra apenas o KM atual do veículo e não possui itens de checklist.',
    );
  });

  it('exibe a mensagem genérica de erro sem expor permission denied, o objeto bruto ou stack trace', async () => {
    seedError('permission denied for table checklist_items');
    await renderModal();

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const dialogText = dialog?.textContent ?? '';

    expect(dialogText).toContain(
      'Não foi possível carregar a estrutura do checklist. Tente fechar e abrir novamente.',
    );
    expect(dialogText).not.toContain('permission denied');
    expect(dialogText).not.toContain('Error:');
    expect(dialogText).not.toContain('at fetchChecklistTemplateItems');
  });

  it('chama onClose uma vez ao clicar em Fechar e uma vez ao pressionar Escape em montagens separadas', async () => {
    seedItems([itemFreiosRow]);
    const onCloseClick = vi.fn();
    await renderModal(publishedTemplate, onCloseClick);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const fecharButton = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Fechar',
    );
    expect(fecharButton).not.toBeUndefined();
    act(() => {
      fecharButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCloseClick).toHaveBeenCalledTimes(1);

    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    const onCloseEscape = vi.fn();
    const secondRoot = createRoot(secondContainer);
    act(() => {
      secondRoot.render(
        <QueryClientProvider client={queryClient}>
          <ChecklistTemplateDetailModal template={publishedTemplate} onClose={onCloseEscape} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCloseEscape).toHaveBeenCalledTimes(1);
    act(() => {
      secondRoot.unmount();
    });
    document.body.removeChild(secondContainer);
  });
});
