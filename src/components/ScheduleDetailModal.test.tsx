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
    root.render(
      <ScheduleDetailModal
        schedule={baseSchedule}
        onClose={() => {}}
        {...props}
      />,
    );
  });
}

describe('ScheduleDetailModal', () => {
  it('exibe placa, data formatada, status, criador, nome da oficina, endereço completo e observações', () => {
    renderModal();

    expect(container.textContent).toContain('TXS8A77');
    expect(container.textContent).toContain('16/09/2026');
    expect(container.textContent).toContain('Agendado');
    expect(container.textContent).toContain('Maria Souza');
    // O badge é verificado pelo próprio elemento, e não por toContain: a string
    // 'Agendado' também é prefixo das observações do fixture, então a busca no
    // texto inteiro passaria mesmo com o badge ausente.
    expect(container.querySelector('.rounded-full')?.textContent).toBe('Agendado');
    expect(container.textContent).toContain('VAMOS');
    expect(container.textContent).toContain('R. André Narciso Rodrigo, 50');
    expect(container.textContent).toContain('Ipiranga, Pouso Alegre - MG, 37549-000');
    expect(container.textContent).toContain('Agendado para 10h. Procurar o mecânico Tião.');
  });

  it('não renderiza nenhum controle de edição', () => {
    renderModal();

    expect(container.querySelectorAll('input').length).toBe(0);
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(container.querySelectorAll('form').length).toBe(0);
    expect(container.textContent).not.toContain('Salvar');
  });

  it('o link do Google Maps aponta para o endereço da oficina', () => {
    renderModal();

    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=R.%20Andr%C3%A9%20Narciso%20Rodrigo%2C%2050%2C%20Ipiranga%2C%20Pouso%20Alegre%2C%20MG%2C%2037549-000',
    );
  });

  it('oficina sem endereço exibe aviso e não renderiza link', () => {
    renderModal({
      schedule: {
        ...baseSchedule,
        workshopAddressStreet: undefined,
        workshopAddressNumber: undefined,
        workshopAddressComplement: undefined,
        workshopAddressNeighborhood: undefined,
        workshopAddressCity: undefined,
        workshopAddressState: undefined,
        workshopAddressZip: undefined,
      },
    });

    expect(container.textContent).toContain('Endereço não cadastrado');
    expect(container.querySelectorAll('a').length).toBe(0);
  });

  it('agendamento sem observação exibe aviso', () => {
    renderModal({ schedule: { ...baseSchedule, notes: undefined } });

    expect(container.textContent).toContain('Nenhuma observação registrada.');
  });

  it('o X do cabeçalho chama onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    act(() => {
      container.querySelector('[aria-label="Fechar"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('o botão Fechar do rodapé chama onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const footerButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Fechar',
    );

    act(() => {
      footerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});