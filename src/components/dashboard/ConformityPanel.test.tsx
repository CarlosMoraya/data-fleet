import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import ConformityPanel from './ConformityPanel';

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
  documentaryComplianceRate: 82,
  pjContractComplianceRate: 91,
  expiredDocumentsCount: 4,
  expiringDocumentsCount: 3,
  missingDocumentsCount: 5,
  irregularVehiclesCount: 2,
  irregularDriversCount: 1,
  criticalItemsCount: 9,
  actionItems: [],
};

describe('ConformityPanel', () => {
  it('renderiza os 8 títulos de card e os respectivos valores', () => {
    renderWithAct(<ConformityPanel {...baseProps} />);

    expect(container.textContent).toContain('Conformidade Documental');
    expect(container.textContent).toContain('Contratos PJ Anexados');
    expect(container.textContent).toContain('Documentos Vencidos');
    expect(container.textContent).toContain('Documentos a Vencer em 30 dias');
    expect(container.textContent).toContain('Documentos Ausentes');
    expect(container.textContent).toContain('Veículos Irregulares');
    expect(container.textContent).toContain('Motoristas Irregulares');
    expect(container.textContent).toContain('Itens Críticos');

    expect(findCardValueByLabel('Conformidade Documental')).toBe('82%');
    expect(findCardValueByLabel('Contratos PJ Anexados')).toBe('91%');
    expect(findCardValueByLabel('Documentos Vencidos')).toBe('4');
    expect(findCardValueByLabel('Documentos a Vencer em 30 dias')).toBe('3');
    expect(findCardValueByLabel('Documentos Ausentes')).toBe('5');
    expect(findCardValueByLabel('Veículos Irregulares')).toBe('2');
    expect(findCardValueByLabel('Motoristas Irregulares')).toBe('1');
    expect(findCardValueByLabel('Itens Críticos')).toBe('9');
  });

  it('renderiza labels da fila e chama onActionClick com a category correta', () => {
    const onActionClick = vi.fn();
    renderWithAct(
      <ConformityPanel
        {...baseProps}
        onActionClick={onActionClick}
        actionItems={[
          {
            category: 'gr_vehicle_missing',
            label: 'Veículos sem GR',
            count: 2,
            severity: 'high',
            details: ['ABC1D23', 'DEF4G56'],
          },
          {
            category: 'pj_contract_missing',
            label: 'Motoristas PJ sem Contrato Anexado',
            count: 1,
            severity: 'high',
            details: ['Ana'],
          },
        ]}
      />
    );

    expect(container.textContent).toContain('Fila de Ação Documental');
    expect(container.textContent).toContain('Veículos sem GR');

    const queueButton = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Veículos sem GR')
    );

    act(() => {
      queueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onActionClick).toHaveBeenCalledWith('gr_vehicle_missing');

    const contractQueueButton = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Motoristas PJ sem Contrato Anexado')
    );

    act(() => {
      contractQueueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onActionClick).toHaveBeenCalledWith('pj_contract_missing');
  });

  it('renderiza o estado vazio da fila quando actionItems é vazio', () => {
    renderWithAct(<ConformityPanel {...baseProps} actionItems={[]} />);

    expect(container.textContent).toContain('Nenhuma ação crítica pendente. Frota em dia.');
  });

  it('com isLoading renderiza spinner e não os cards', () => {
    renderWithAct(<ConformityPanel {...baseProps} isLoading />);

    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
    expect(container.textContent).not.toContain('Conformidade Documental');
  });
});
