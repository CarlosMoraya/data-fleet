import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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
  vehicles: [],
  totalVehicles: 10,
  availableVehicles: 8,
  unavailableVehicles: 2,
  availabilityRate: 80,
  totalApprovedCost: 5000,
  complianceRate: 95,
  trackerCoverageRate: 70,
  insuranceCoverageRate: 80,
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

  it('não exibe cards removidos e itens fora de escopo', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).not.toContain('OS Abertas');
    expect(text).not.toContain('OS em Atraso');
    expect(text).not.toContain('OS Aguardando Aprovação');
    expect(text).not.toContain('Veículos em Manutenção');
    expect(text).not.toContain('Veículos sem Motorista');
  });

  it('exibe os 8 rótulos executivos e o cabeçalho Mapa da Frota', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).toContain('Total de Veículos');
    expect(text).toContain('Veículos Disponíveis');
    expect(text).toContain('Veículos Indisponíveis');
    expect(text).toContain('Disponibilidade da Frota');
    expect(text).toContain('Custo do Mês Atual');
    expect(text).toContain('Conformidade de Checklist');
    expect(text).toContain('Cobertura de Rastreador');
    expect(text).toContain('Cobertura de Seguro');
    expect(text).toContain('Mapa da Frota');
  });

  it('renders current-state copy and current month cost label', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).toContain('Situação atual da frota');
    expect(text).toContain('Custo do Mês Atual');
    expect(text).not.toContain('Custo Total do Período');
  });
});
