import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChecklistFill from './ChecklistFill';

import type { Checklist } from '../types';

const { enqueueOperationMock, hookState } = vi.hoisted(() => ({
  enqueueOperationMock: vi.fn(),
  hookState: { isOnline: true, pendingCount: 0 },
}));

vi.mock('../components/CameraCapture', () => ({ default: () => null }));
vi.mock('../components/HandoverEvidenceSection', () => ({ default: () => null }));
vi.mock('../components/OfflineBanner', () => ({ default: () => null }));
vi.mock('../components/VehicleKmGuidance', () => ({ default: () => null }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'driver-1', role: 'Driver', clientId: 'client-1' },
    currentClient: { id: 'client-1', name: 'Cliente Teste' },
  }),
}));

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => hookState.isOnline }));
vi.mock('../hooks/usePendingSyncCount', () => ({ usePendingSyncCount: () => hookState.pendingCount }));

vi.mock('../lib/geolocation', () => ({ capturePosition: vi.fn() }));
vi.mock('../lib/offline/offlineDb', () => ({
  offlineDb: {
    couplingDrafts: {
      delete: vi.fn(() => Promise.resolve()),
      get: vi.fn(() => Promise.resolve(undefined)),
    },
  },
}));
vi.mock('../lib/offline/syncService', () => ({
  enqueueOperation: enqueueOperationMock,
  enqueuePhoto: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../services/vehicleLoanService', () => ({
  completeVehicleLoan: vi.fn(),
  createVehicleLoan: vi.fn(),
  getActiveVehicleLoan: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

const checklist: Checklist = {
  id: 'checklist-1',
  clientId: 'client-1',
  templateId: 'template-1',
  templateName: 'Checklist diário',
  templateContext: 'Rotina',
  versionNumber: 1,
  vehicleId: 'vehicle-1',
  vehicleLicensePlate: 'AAA1A11',
  filledBy: 'driver-1',
  startedAt: '2026-08-18T09:00:00',
  status: 'in_progress',
  odometerKm: 120000,
};

let container: Container;
let queryClient: QueryClient;

beforeEach(() => {
  hookState.isOnline = true;
  hookState.pendingCount = 0;
  enqueueOperationMock.mockResolvedValue(undefined);
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);

  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  queryClient.setQueryData(['checklist', checklist.id], checklist);
  queryClient.setQueryData(['checklistItems', checklist.templateId, checklist.versionNumber], []);
  queryClient.setQueryData(['checklistResponses', checklist.id], []);
  queryClient.setQueryData(['vehicleInitialKm', checklist.vehicleId], 100000);
  queryClient.setQueryData(['lastOdometerKm', checklist.vehicleId], 110000);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function renderPage() {
  const root = container.__reactRoot ?? createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/checklists/preencher/${checklist.id}`]}>
          <Routes>
            <Route path="/checklists/preencher/:checklistId" element={<ChecklistFill />} />
            <Route path="/checklists" element={<div>Lista de checklists</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

async function waitForSettle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function finishButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes('Finalizar Checklist'));
  if (!(button instanceof HTMLButtonElement)) throw new Error('Botão Finalizar Checklist não encontrado.');
  return button;
}

describe('ChecklistFill — finalização e fila offline', () => {
  it('desabilita a finalização e informa a quantidade enquanto sincroniza respostas', async () => {
    hookState.pendingCount = 3;
    renderPage();
    await waitForSettle();

    expect(finishButton().disabled).toBe(true);
    expect(container.textContent).toContain(
      'Aguarde: 3 respostas ainda estão sendo sincronizadas. O checklist poderá ser finalizado assim que a sincronização terminar.',
    );
  });

  it('mantém a finalização habilitada e sem aviso quando a fila está vazia', async () => {
    renderPage();
    await waitForSettle();

    expect(finishButton().disabled).toBe(false);
    expect(container.textContent).not.toContain('respostas ainda estão sendo sincronizadas');
  });

  it('reabilita a finalização quando pendingCount passa de 3 para 0', async () => {
    hookState.pendingCount = 3;
    renderPage();
    await waitForSettle();
    expect(finishButton().disabled).toBe(true);

    hookState.pendingCount = 0;
    renderPage();
    await waitForSettle();

    expect(finishButton().disabled).toBe(false);
    expect(container.textContent).not.toContain('respostas ainda estão sendo sincronizadas');
  });

  it('limpa openChecklist também ao finalizar offline', async () => {
    hookState.isOnline = false;
    hookState.pendingCount = 2;
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const setQueriesDataSpy = vi.spyOn(queryClient, 'setQueriesData');

    renderPage();
    await waitForSettle();
    expect(finishButton().disabled).toBe(false);

    await act(async () => {
      finishButton().click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(enqueueOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'finish_checklist' }),
      checklist.id,
    );
    expect(setQueriesDataSpy).toHaveBeenCalledWith({ queryKey: ['openChecklist'] }, null);
  });
});
