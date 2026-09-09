import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ScheduleDetailModal from './ScheduleDetailModal';

import type { WorkshopSchedule } from '../types';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

const baseSchedule: WorkshopSchedule = {
  id: 'sch-1',
  clientId: 'cli-1',
  vehicleId: 'veh-1',
  vehicleLicensePlate: 'TXS8A77',
  workshopId: 'wks-1',
  workshopName: 'VAMOS',
  workshopAddressStreet: 'R. André Narciso Rodrigo',
  workshopAddressNumber: '50',
  workshopAddressComplement: undefined,
  workshopAddressNeighborhood: 'Ipiranga',
  workshopAddressCity: 'Pouso Alegre',
  workshopAddressState: 'MG',
  workshopAddressZip: '37549-000',
  scheduledDate: '2026-09-16',
  status: 'scheduled',
  completedAt: undefined,
  checklistId: undefined,
  notes: 'Agendado para 10h. Procurar o mecânico Tião.',
  createdBy: 'usr-1',
  createdByName: 'Maria Souza',
  createdAt: '2026-09-01T12:00:00.000Z',
};

function makeActions() {
  return {
    canWriteSchedules: true,
    canDelete: true,
    onEdit: vi.fn(),
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onGenerateMaintenance: vi.fn(),
  };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderModal(props: Partial<React.ComponentProps<typeof ScheduleDetailModal>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(<ScheduleDetailModal schedule={baseSchedule} onClose={() => {}} {...props} />);
  });
}

function buttonLabels(): string[] {
  return Array.from(container.querySelectorAll('button'))
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => t.length > 0);
}

describe('ScheduleDetailModal actions', () => {
  it('sem a prop actions, o rodapé exibe apenas Fechar', () => {
    renderModal();
    expect(buttonLabels()).toEqual(['Fechar']);
  });

  it('agendamento agendado com permissão total exibe os cinco botões esperados', () => {
    renderModal({ schedule: { ...baseSchedule, status: 'scheduled' }, actions: makeActions() });
    expect(buttonLabels().sort()).toEqual(['Cancelar agendamento', 'Concluir', 'Editar', 'Fechar', 'Gerar OS']);
  });

  it('agendamento concluído troca as ações de agendado por Excluir', () => {
    renderModal({ schedule: { ...baseSchedule, status: 'completed' }, actions: makeActions() });
    expect(buttonLabels().sort()).toEqual(['Excluir', 'Fechar', 'Gerar OS']);
  });

  it('agendamento cancelado exibe apenas Excluir e Fechar', () => {
    renderModal({ schedule: { ...baseSchedule, status: 'cancelled' }, actions: makeActions() });
    expect(buttonLabels().sort()).toEqual(['Excluir', 'Fechar']);
  });

  it('quem não pode excluir não vê o botão Excluir', () => {
    renderModal({
      schedule: { ...baseSchedule, status: 'completed' },
      actions: { ...makeActions(), canDelete: false },
    });
    expect(buttonLabels().sort()).toEqual(['Fechar', 'Gerar OS']);
  });

  it('quem não pode escrever não vê nenhuma ação, mesmo passando actions', () => {
    renderModal({ actions: { ...makeActions(), canWriteSchedules: false } });
    expect(buttonLabels()).toEqual(['Fechar']);
  });

  it('cada botão chama exatamente o seu callback', () => {
    const a = makeActions();
    renderModal({ schedule: { ...baseSchedule, status: 'scheduled' }, actions: a });

    const concluir = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Concluir')!;
    act(() => {
      concluir.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(a.onComplete).toHaveBeenCalledTimes(1);
    expect(a.onCancel).not.toHaveBeenCalled();

    const cancelar = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancelar agendamento',
    )!;
    act(() => {
      cancelar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(a.onCancel).toHaveBeenCalledTimes(1);

    const editar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Editar')!;
    act(() => {
      editar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(a.onEdit).toHaveBeenCalledTimes(1);

    const gerarOs = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Gerar OS')!;
    act(() => {
      gerarOs.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(a.onGenerateMaintenance).toHaveBeenCalledTimes(1);
  });

  it('o botão Fechar do rodapé não dispara nenhuma ação', () => {
    const a = makeActions();
    const onClose = vi.fn();
    renderModal({ schedule: { ...baseSchedule, status: 'scheduled' }, actions: a, onClose });

    const fechar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Fechar')!;
    act(() => {
      fechar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(a.onComplete).not.toHaveBeenCalled();
    expect(a.onCancel).not.toHaveBeenCalled();
    expect(a.onDelete).not.toHaveBeenCalled();
  });
  it('o botão Excluir chama onDelete e nenhum outro callback', () => {
    const a = makeActions();
    renderModal({ schedule: { ...baseSchedule, status: 'completed' }, actions: a });

    const excluir = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Excluir')!;
    act(() => {
      excluir.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(a.onDelete).toHaveBeenCalledTimes(1);
    expect(a.onCancel).not.toHaveBeenCalled();
    expect(a.onGenerateMaintenance).not.toHaveBeenCalled();
  });
});
