import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VehicleLoanChangeTitularModal from './VehicleLoanChangeTitularModal';

import type { VehicleLoan } from '../types/vehicleLoan';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: ReactContainer;

const loan: VehicleLoan = {
  id: 'l1',
  clientId: 'c1',
  vehicleId: 'v1',
  driverId: 'd-temp',
  driverName: 'Temporário',
  startedAt: '2026-07-26T10:00:00Z',
  endedAt: null,
  deliveryChecklistId: null,
  returnChecklistId: null,
  status: 'active',
  notes: 'rota extra solicitada',
  endedNotes: null,
  createdBy: 'u1',
  endedBy: null,
  endedReason: null,
  createdAt: '2026-07-26T10:00:00Z',
  updatedAt: '2026-07-26T10:00:00Z',
};

beforeEach(() => {
  container = document.createElement('div') as ReactContainer;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  document.body.removeChild(container);
});

function renderModal(props: Partial<React.ComponentProps<typeof VehicleLoanChangeTitularModal>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <VehicleLoanChangeTitularModal
        loan={loan}
        newTitularName="Novo Titular"
        onConfirm={async () => {}}
        onCancel={() => {}}
        {...props}
      />,
    );
  });
}

describe('VehicleLoanChangeTitularModal', () => {
  it('renderiza dados do empréstimo e do motorista temporário', () => {
    renderModal();
    expect(container.textContent).toContain('Temporário');
    expect(container.textContent).toContain('rota extra solicitada');
  });

  it('mostra o destaque quando o novo titular é o temporário', () => {
    renderModal({ newTitularName: 'Novo Titular' });
    // O destaque azul contém a frase específica
    expect(container.textContent).toContain('é o mesmo que está com o veículo em empréstimo');
  });

  it('não mostra o destaque quando não há newTitularName', () => {
    renderModal({ newTitularName: undefined });
    expect(container.textContent).not.toContain('é o mesmo que está com o veículo em empréstimo');
  });

  it('bloqueia confirmar sem justificativa >= 10', () => {
    renderModal();
    const confirmBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Confirmar e finalizar'),
    );
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn?.disabled).toBe(true);

    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    act(() => {
      setter?.call(ta, 'abc');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const confirmBtn2 = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Confirmar e finalizar'),
    );
    expect(confirmBtn2?.disabled).toBe(true);

    act(() => {
      setter?.call(ta, 'Troca autorizada pela coordenação regional');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const confirmBtn3 = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Confirmar e finalizar'),
    );
    expect(confirmBtn3?.disabled).toBe(false);
  });

  it('chama onCancel ao clicar em Cancelar', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    const cancelBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Cancelar',
    );
    act(() => cancelBtn?.click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});