import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import OperationalPanel from './OperationalPanel';

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
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

function findCardValueByLabel(label: string): string | null {
  const allP = container.querySelectorAll('p');
  for (const p of allP) {
    if (p.textContent === label) {
      return p.nextElementSibling?.textContent ?? null;
    }
  }
  return null;
}

const baseProps = {
  unavailableVehiclesCount: 1,
  vehiclesWithoutDriverCount: 2,
  openOrdersCount: 3,
  overdueOrdersCount: 4,
  exitByEndOfWeekCount: 5,
  pendingApprovalCount: 6,
  overdueChecklistsCount: 7,
  openActionPlansCount: 8,
  actionItems: [],
};

describe('OperationalPanel', () => {
  it('renderiza exatamente os 8 cards com rótulos e ordem especificados', () => {
    renderWithAct(<OperationalPanel {...baseProps} />);

    const labels = Array.from(container.querySelectorAll('p'))
      .map((node) => node.textContent)
      .filter((text): text is string => text != null)
      .filter((text) => [
        'Veículos Indisponíveis',
        'Veículos sem Motorista',
        'OS Abertas',
        'OS com Prazo Vencido',
        'Saída Prevista até Fim da Semana',
        'OS Aguardando Aprovação',
        'Checklists Vencidos',
        'Planos de Ação Abertos',
      ].includes(text));

    expect(labels).toEqual([
      'Veículos Indisponíveis',
      'Veículos sem Motorista',
      'OS Abertas',
      'OS com Prazo Vencido',
      'Saída Prevista até Fim da Semana',
      'OS Aguardando Aprovação',
      'Checklists Vencidos',
      'Planos de Ação Abertos',
    ]);
  });

  it('cada card reflete o valor da prop correspondente', () => {
    renderWithAct(<OperationalPanel {...baseProps} />);

    expect(findCardValueByLabel('Veículos Indisponíveis')).toBe('1');
    expect(findCardValueByLabel('Veículos sem Motorista')).toBe('2');
    expect(findCardValueByLabel('OS Abertas')).toBe('3');
    expect(findCardValueByLabel('OS com Prazo Vencido')).toBe('4');
    expect(findCardValueByLabel('Saída Prevista até Fim da Semana')).toBe('5');
    expect(findCardValueByLabel('OS Aguardando Aprovação')).toBe('6');
    expect(findCardValueByLabel('Checklists Vencidos')).toBe('7');
    expect(findCardValueByLabel('Planos de Ação Abertos')).toBe('8');
  });

  it('não renderiza rótulos e gráficos proibidos', () => {
    renderWithAct(<OperationalPanel {...baseProps} />);

    expect(container.textContent).not.toContain('CRLV');
    expect(container.textContent).not.toContain('CNH');
    expect(container.textContent).not.toContain('Documento');
    expect(container.textContent).not.toContain('Seguro');
    expect(container.textContent).not.toContain('Total de Veículos');
    expect(container.textContent).not.toContain('Em Manutenção');
    expect(container.querySelector('[data-testid="vehicle-type-chart"]')).toBeNull();
    expect(container.querySelector('[data-testid="maintenance-type-chart"]')).toBeNull();
  });

  it('clicar em card chama onActionClick com a categoria correta', () => {
    const onActionClick = vi.fn();
    renderWithAct(<OperationalPanel {...baseProps} onActionClick={onActionClick} />);

    const overdueCard = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('OS com Prazo Vencido')
    );
    const noDriverCard = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Veículos sem Motorista')
    );

    act(() => {
      overdueCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      noDriverCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onActionClick).toHaveBeenCalledWith('os_overdue');
    expect(onActionClick).toHaveBeenCalledWith('vehicles_no_driver');
  });

  it('renderiza a fila operacional com título e labels recebidos', () => {
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        actionItems={[
          {
            category: 'os_pending_budget',
            label: 'OS aguardando orçamento',
            count: 1,
            severity: 'medium',
            details: ['ABC1D23'],
          },
        ]}
      />
    );

    expect(container.textContent).toContain('Fila de Ação Operacional');
    expect(container.textContent).toContain('OS aguardando orçamento');
  });

  it('clicar em item da fila chama onActionClick com a categoria', () => {
    const onActionClick = vi.fn();
    renderWithAct(
      <OperationalPanel
        {...baseProps}
        onActionClick={onActionClick}
        actionItems={[
          {
            category: 'action_plans_open',
            label: 'Planos de ação de checklist abertos',
            count: 1,
            severity: 'medium',
            details: ['ABC1D23'],
          },
        ]}
      />
    );

    const queueButton = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Planos de ação de checklist abertos')
    );

    act(() => {
      queueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onActionClick).toHaveBeenCalledWith('action_plans_open');
  });

  it('renderiza o estado vazio da fila quando actionItems é vazio', () => {
    renderWithAct(<OperationalPanel {...baseProps} actionItems={[]} />);

    expect(container.textContent).toContain('Nenhuma ação crítica pendente. Frota em dia.');
  });
});
