import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VehicleKmHistoryTab from './VehicleKmHistoryTab';

import type { OdometerReading } from '../types/odometerCorrection';

const { listVehicleOdometerHistoryMock } = vi.hoisted(() => ({
  listVehicleOdometerHistoryMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'Coordinator' } }),
}));

vi.mock('../services/odometerCorrectionService', () => ({
  createOdometerCorrection: vi.fn(),
  listVehicleOdometerHistory: listVehicleOdometerHistoryMock,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

const reading: OdometerReading = {
  checklistId: 'checklist-1',
  vehicleId: 'vehicle-1',
  clientId: 'client-1',
  readingAt: '2026-08-18T10:00:00Z',
  originalKm: 214000,
  effectiveKm: 214500,
  isCorrected: true,
  correctionReason: 'Ajuste validado',
  correctedBy: 'Coordenador',
  correctedAt: '2026-08-18T11:00:00Z',
  sourceContext: 'Rotina',
  hasEvidence: false,
};

let container: Container;
let queryClient: QueryClient;

beforeEach(() => {
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

function renderTab(initialKm?: number) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <VehicleKmHistoryTab vehicleId="vehicle-1" initialKm={initialKm} />
      </QueryClientProvider>,
    );
  });
}

async function waitForSettle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('VehicleKmHistoryTab', () => {
  it('explica o Km Inicial quando não existem leituras de checklist', async () => {
    listVehicleOdometerHistoryMock.mockResolvedValue([]);

    renderTab(215606);
    await waitForSettle();

    expect(container.textContent).toContain('215.606 km');
    expect(container.textContent).toContain('Km Inicial (cadastro)');
    expect(container.textContent).toContain(
      'Este veículo ainda não tem leitura de KM vinda de checklist. Para ajustar o valor, use Editar → Km Inicial.',
    );
    expect(container.textContent).not.toContain('Corrigir KM');
  });

  it('preserva a mensagem original sem leituras e sem Km Inicial', async () => {
    listVehicleOdometerHistoryMock.mockResolvedValue([]);

    renderTab();
    await waitForSettle();

    expect(container.textContent).toBe('Nenhuma leitura de KM registrada para este veículo.');
  });

  it('mantém a tabela quando existem leituras de checklist', async () => {
    listVehicleOdometerHistoryMock.mockResolvedValue([reading]);

    renderTab(215606);
    await waitForSettle();

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.textContent).toContain('Rotina');
    expect(container.textContent).toContain('214.500');
    expect(container.textContent).toContain('Corrigir KM');
    expect(container.textContent).not.toContain('Km Inicial (cadastro)');
  });
});
