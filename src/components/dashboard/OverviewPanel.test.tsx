import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import OverviewPanel from './OverviewPanel';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as any).__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as any).__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

const baseProps = {
  totalVehicles: 10,
  vehiclesInMaintenance: 2,
  availabilityRate: 80,
  openOrdersCount: 3,
  overdueOrdersCount: 1,
  pendingApprovalCount: 0,
  totalApprovedCost: 5000,
  complianceRate: 95,
  isLoading: false,
};

describe('OverviewPanel — regressão de conteúdo removido', () => {
  it('não exibe Documentos Vencidos nem Documentos a Vencer (30d)', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).not.toContain('Documentos a Vencer (30d)');
    expect(text).not.toContain('Documentos Vencidos');
  });

  it('não exibe Fila de Ação', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).not.toContain('Fila de Ação');
  });

  it('renders current-state copy and current month cost label', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).toContain('Situação atual da frota');
    expect(text).toContain('Custo do Mês Atual');
    expect(text).not.toContain('Custo Total do Período');
  });
});