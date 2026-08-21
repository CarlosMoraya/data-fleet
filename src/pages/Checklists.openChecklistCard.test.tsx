import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Checklists from './Checklists';

import type { Checklist, ChecklistTemplate } from '../types';

const { getActiveVehicleLoanMock, rpcMock, useAuthMock } = vi.hoisted(() => ({
  getActiveVehicleLoanMock: vi.fn(),
  rpcMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: rpcMock,
  },
}));

vi.mock('../components/DriverLoanNotifications', () => ({ default: () => null }));
vi.mock('../components/LastKmLabel', () => ({ default: () => null }));

vi.mock('../services/checklistActionPlanService', () => ({
  getChecklistActionPlanStatuses: vi.fn(() => Promise.resolve(new Map())),
  getChecklistTicketTreatments: vi.fn(() => Promise.resolve(new Map())),
  unmarkChecklistTreatedByTicket: vi.fn(),
}));

vi.mock('../services/tireInspectionService', () => ({
  createTireInspection: vi.fn(),
  findOpenTireInspection: vi.fn(),
  validateTireInspectionEligibility: vi.fn(),
}));

vi.mock('../services/vehicleLoanService', () => ({
  getActiveVehicleLoan: getActiveVehicleLoanMock,
  getActiveLoansForVehicles: vi.fn(() => Promise.resolve(new Map())),
  getLoanDeliveryChecklistIds: vi.fn(() => Promise.resolve(new Set())),
}));

vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: vi.fn(() => Promise.resolve(new Map())),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

const userId = 'driver-1';
const clientId = 'client-1';
const vehicles = [
  {
    id: 'vehicle-a',
    license_plate: 'AAA1A11',
    category: 'Pesado',
    status: 'In Use',
    is_assigned_to_me: true,
    has_other_driver: false,
  },
  {
    id: 'vehicle-b',
    license_plate: 'BBB2B22',
    category: 'Pesado',
    status: 'Available',
    is_assigned_to_me: false,
    has_other_driver: false,
  },
];

const template: ChecklistTemplate = {
  id: 'template-1',
  clientId,
  vehicleCategory: 'Pesado',
  context: 'Rotina',
  name: 'Checklist diário',
  currentVersion: 1,
  status: 'published',
};

const openChecklist: Checklist = {
  id: 'checklist-a',
  clientId,
  templateId: template.id,
  templateName: template.name,
  templateContext: template.context,
  versionNumber: 1,
  vehicleId: 'vehicle-a',
  vehicleLicensePlate: 'AAA1A11',
  filledBy: userId,
  startedAt: '2026-08-19T10:00:00Z',
  status: 'in_progress',
};

let container: Container;
let queryClient: QueryClient;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });

  useAuthMock.mockReturnValue({
    user: { id: userId, role: 'Driver', clientId },
    currentClient: { id: clientId, name: 'Cliente Teste' },
    clients: [{ id: clientId, name: 'Cliente Teste' }],
  });
  getActiveVehicleLoanMock.mockResolvedValue(null);
  rpcMock.mockImplementation((name: string) => Promise.resolve({
    data: name === 'list_vehicles_for_checklist_selection' ? vehicles : [],
    error: null,
  }));
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

function primeQueries(checklist: Checklist | null) {
  queryClient.setQueryData(['driverVehicle', userId, clientId], {
    id: 'vehicle-a',
    plate: 'AAA1A11',
    category: 'Pesado',
  });
  queryClient.setQueryData(['publishedTemplates', 'Pesado', clientId], [template]);
  queryClient.setQueryData(['enforceDriverVehicleLink', clientId], false);
  queryClient.setQueryData(['openChecklist', userId, clientId], checklist);
  queryClient.setQueryData(['pneusDayInterval', clientId], 7);
}

function renderPage() {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Checklists />
        </BrowserRouter>
      </QueryClientProvider>,
    );
  });
}

async function waitForSettle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

describe('Checklists — cartão de checklist em andamento', () => {
  it('exibe no cartão a placa do checklist aberto', async () => {
    primeQueries(openChecklist);
    renderPage();
    await waitForSettle();

    expect(container.textContent).toContain('Checklist em andamento · AAA1A11');
  });

  it('cita a placa do checklist aberto após selecionar outro veículo', async () => {
    primeQueries(openChecklist);
    renderPage();
    await waitForSettle();

    const vehicleSelect = container.querySelector('select');
    if (!(vehicleSelect instanceof HTMLSelectElement)) throw new Error('Dropdown de veículo não encontrado.');

    act(() => {
      vehicleSelect.value = 'vehicle-b';
      vehicleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(vehicleSelect.value).toBe('vehicle-b');
    expect(container.textContent).toContain(
      'Você tem um checklist em andamento na placa AAA1A11. Finalize ou cancele esse checklist antes de iniciar um novo — inclusive para outro veículo.',
    );
  });

  it('não renderiza cartão nem aviso sem checklist aberto', async () => {
    primeQueries(null);
    renderPage();
    await waitForSettle();

    expect(container.textContent).not.toContain('Checklist em andamento');
    expect(container.textContent).not.toContain('Você tem um checklist em andamento na placa');
  });
});
