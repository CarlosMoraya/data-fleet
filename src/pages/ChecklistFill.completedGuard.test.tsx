import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChecklistFill from './ChecklistFill';

import type { Checklist, ChecklistItem } from '../types';

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

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../hooks/usePendingSyncCount', () => ({ usePendingSyncCount: () => 0 }));

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
  enqueueOperation: vi.fn(),
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

const checklistItem: ChecklistItem = {
  id: 'item-1',
  templateId: 'template-1',
  versionNumber: 1,
  title: 'Freios',
  isMandatory: true,
  requirePhotoIfIssue: false,
  canBlockVehicle: false,
  orderNumber: 1,
};

function makeChecklist(status: Checklist['status']): Checklist {
  return {
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
    completedAt: status === 'completed' ? '2026-08-18T10:30:00' : undefined,
    status,
    odometerKm: 120000,
  };
}

let container: Container;
let queryClient: QueryClient;

beforeEach(() => {
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

function primeQueries(checklist: Checklist) {
  queryClient.setQueryData(['checklist', checklist.id], checklist);
  queryClient.setQueryData(['checklistItems', checklist.templateId, checklist.versionNumber], [checklistItem]);
  queryClient.setQueryData(['checklistResponses', checklist.id], [{
    checklist_id: checklist.id,
    item_id: checklistItem.id,
    status: 'ok',
    observation: null,
    photo_url: null,
  }]);
  queryClient.setQueryData(['vehicleInitialKm', checklist.vehicleId], 100000);
  queryClient.setQueryData(['lastOdometerKm', checklist.vehicleId], 110000);
}

function renderPage(checklist: Checklist) {
  primeQueries(checklist);
  const root = createRoot(container);
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

describe('ChecklistFill — guarda de checklist concluído', () => {
  it('bloqueia a edição e não renderiza itens nem finalização quando concluído', async () => {
    renderPage(makeChecklist('completed'));
    await waitForSettle();

    expect(container.textContent).toContain(
      'Este checklist já foi concluído em 18/08/2026, 10:30 e não pode mais ser editado.',
    );
    expect(container.textContent).toContain('AAA1A11');
    expect(container.textContent).toContain('Voltar');
    expect(container.textContent).not.toContain('Freios');
    expect(container.textContent).not.toContain('Finalizar Checklist');
  });

  it('renderiza normalmente o formulário quando o checklist está em andamento', async () => {
    renderPage(makeChecklist('in_progress'));
    await waitForSettle();

    expect(container.textContent).toContain('Freios');
    expect(container.textContent).toContain('Finalizar Checklist');
    expect(container.textContent).not.toContain('não pode mais ser editado');
  });
});
