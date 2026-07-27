import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import VehicleLoanDetail from './VehicleLoanDetail';

import type { VehicleLoan } from '../types/vehicleLoan';

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: Container;

function baseLoan(over: Partial<VehicleLoan> = {}): VehicleLoan {
  return {
    id: 'l1',
    clientId: 'c1',
    vehicleId: 'v1',
    driverId: 'd-temp',
    driverName: 'Temp Motorista',
    startedAt: '2026-07-26T10:00:00Z',
    endedAt: '2026-07-27T10:00:00Z',
    deliveryChecklistId: 'ck-del',
    returnChecklistId: null,
    status: 'completed',
    notes: 'rota extra solicitada equipe operacional',
    endedNotes: 'troca autorizada pela coordenação',
    createdBy: 'u-creator',
    createdByName: 'Ana Coordenadora',
    endedBy: 'u-ender',
    endedByName: 'Bruno Gerente',
    endedReason: 'driver_changed',
    deliveryChecklistAt: '2026-07-26T10:30:00Z',
    returnChecklistAt: null,
    createdAt: '2026-07-26T10:00:00Z',
    updatedAt: '2026-07-27T10:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  document.body.removeChild(container);
});

function renderDetail(props: Partial<React.ComponentProps<typeof VehicleLoanDetail>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(<VehicleLoanDetail loan={baseLoan()} onClose={() => {}} {...props} />);
  });
}

describe('VehicleLoanDetail', () => {
  it('exibe nomes resolvedos por RPC em "Criado por"/"Finalizado por"', () => {
    renderDetail();
    const text = container.textContent ?? '';
    expect(text).toContain('Ana Coordenadora');
    expect(text).toContain('Bruno Gerente');
  });

  it('exibe rótulo legível para o motivo da finalização (driver_changed)', () => {
    renderDetail();
    expect(container.textContent).toContain('Troca de motorista titular');
    // Não exibe o valor cru
    expect(container.textContent).not.toMatch(/\bdriver_changed\b/);
  });

  it('exibe a data do checklist de Entrega em vez do UUID; Devolução mostra "—"', () => {
    renderDetail();
    const text = container.textContent ?? '';
    expect(text).toContain('26/07/2026'); // data da entrega formatada em pt-BR
    expect(text).not.toContain('ck-del'); // UUID não aparece
    // "—" no campo de Devolução: presente porque returnChecklistAt é nulo.
    expect(text).toContain('Checklist de Devolução');
  });

  it('faz fallback ao ID quando createdByName/endedByName vierem nulos (caso Auditor/RLS)', () => {
    renderDetail({
      loan: baseLoan({ createdByName: null, endedByName: null, endedBy: 'u-ender-uuid' }),
    });
    const text = container.textContent ?? '';
    expect(text).toContain('u-creator'); // fallback ao ID
    expect(text).toContain('u-ender-uuid');
  });
});