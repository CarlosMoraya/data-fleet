import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Checklists from './Checklists';

import type { ChecklistExportRow, ChecklistIssueDetail } from '../lib/checklistExportRows';

interface AuthValue {
  user: { id: string; role: string; clientId: string | null };
  currentClient: { id: string; name: string };
  clients: { id: string; name: string }[];
}

interface ProviderResult {
  success: boolean;
  recordsSent: number;
  blob: Blob;
}

const {
  downloadBlobFileMock,
  exportDataMock,
  fetchChecklistIssueDetailsMock,
  fromMock,
  useAuthMock,
} = vi.hoisted(() => ({
  downloadBlobFileMock: vi.fn(),
  exportDataMock: vi.fn<(...args: unknown[]) => Promise<ProviderResult>>(),
  fetchChecklistIssueDetailsMock: vi.fn<(ids: string[]) => Promise<Map<string, ChecklistIssueDetail[]>>>(),
  fromMock: vi.fn(),
  useAuthMock: vi.fn<() => AuthValue>(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

vi.mock('../components/LastKmLabel', () => ({ default: () => null }));

vi.mock('../lib/downloadBlobFile', () => ({
  downloadBlobFile: downloadBlobFileMock,
}));

vi.mock('../services/checklistExport/checklistIssueFetcher', () => ({
  fetchChecklistIssueDetails: fetchChecklistIssueDetailsMock,
}));

vi.mock('../services/checklistExport/xlsxChecklistProvider', () => ({
  XlsxChecklistProvider: class {
    exportData(...args: unknown[]) {
      return exportDataMock(...args);
    }
  },
}));

vi.mock('../services/checklistActionPlanService', () => ({
  getChecklistActionPlanStatuses: vi.fn(() => Promise.resolve(new Map())),
  getChecklistTicketTreatments: vi.fn(() => Promise.resolve(new Map())),
  unmarkChecklistTreatedByTicket: vi.fn(),
}));

vi.mock('../services/vehicleLoanService', () => ({
  getActiveVehicleLoan: vi.fn(),
  getActiveLoansForVehicles: vi.fn(() => Promise.resolve(new Map())),
  getLoanDeliveryChecklistIds: vi.fn(() => Promise.resolve(new Set())),
}));

vi.mock('../services/vehicleOdometerService', () => ({
  getVehicleLastKmMap: vi.fn(() => Promise.resolve(new Map())),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

type Container = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

interface QueryResponse {
  data?: unknown;
  error?: unknown;
}

let container: Container;
let queryClient: QueryClient;

const checklistRows = [
  {
    id: 'checklist-with-issue',
    client_id: 'client-1',
    template_id: 'template-1',
    version_number: 1,
    vehicle_id: 'vehicle-1',
    filled_by: 'user-1',
    started_at: '2026-08-20T10:00:00Z',
    completed_at: '2026-08-20T10:10:00Z',
    status: 'completed',
    latitude: null,
    longitude: null,
    location_status: null,
    device_info: null,
    notes: null,
    workshop_id: null,
    odometer_km: null,
    odometer_photo_url: null,
    driver_id: null,
    cnh_photo_url: null,
    signature_url: null,
    vehicle_link_divergence_reasons: null,
    vehicle_link_assigned_driver_id: null,
    vehicle_link_executor_vehicle_id: null,
    checklist_templates: { name: 'Com problema', context: 'Rotina' },
    vehicles: {
      license_plate: 'AAA1A11',
      driver: { name: 'Motorista A' },
      shippers: { name: 'Embarcador A' },
      operational_units: { name: 'Unidade A' },
    },
    profiles: { name: 'Preenchedor A' },
  },
  {
    id: 'checklist-without-issue',
    client_id: 'client-1',
    template_id: 'template-2',
    version_number: 1,
    vehicle_id: 'vehicle-2',
    filled_by: 'user-1',
    started_at: '2026-08-20T11:00:00Z',
    completed_at: '2026-08-20T11:10:00Z',
    status: 'completed',
    latitude: null,
    longitude: null,
    location_status: null,
    device_info: null,
    notes: null,
    workshop_id: null,
    odometer_km: null,
    odometer_photo_url: null,
    driver_id: null,
    cnh_photo_url: null,
    signature_url: null,
    vehicle_link_divergence_reasons: null,
    vehicle_link_assigned_driver_id: null,
    vehicle_link_executor_vehicle_id: null,
    checklist_templates: { name: 'Sem problema', context: 'Rotina' },
    vehicles: {
      license_plate: 'BBB2B22',
      driver: { name: 'Motorista B' },
      shippers: { name: 'Embarcador B' },
      operational_units: { name: 'Unidade B' },
    },
    profiles: { name: 'Preenchedor B' },
  },
];

function chain(response: QueryResponse) {
  const resolved = { data: response.data ?? [], error: response.error ?? null };
  const self = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    not: vi.fn(() => self),
    order: vi.fn(() => self),
    limit: vi.fn(() => self),
    delete: vi.fn(() => self),
    maybeSingle: vi.fn(() => Promise.resolve(resolved)),
    then: (
      onFulfilled: (value: typeof resolved) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolved).then(onFulfilled, onRejected),
  };
  return self;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  container = document.createElement('div') as Container;
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(window, 'alert').mockImplementation(() => {});

  useAuthMock.mockReturnValue({
    user: { id: 'admin-1', role: 'Admin Master', clientId: null },
    currentClient: { id: 'client-1', name: 'Cliente Teste' },
    clients: [{ id: 'client-1', name: 'Cliente Teste' }],
  });

  fromMock.mockImplementation((table: string) => {
    if (table === 'checklists') return chain({ data: checklistRows });
    if (table === 'checklist_responses') {
      return chain({ data: [{ checklist_id: 'checklist-with-issue' }] });
    }
    if (table === 'checklist_day_intervals') return chain({ data: null });
    return chain({ data: [] });
  });
  fetchChecklistIssueDetailsMock.mockResolvedValue(new Map());
  exportDataMock.mockResolvedValue({
    success: true,
    recordsSent: 2,
    blob: new Blob(['xlsx']),
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) act(() => root.unmount());
  queryClient.clear();
  document.body.removeChild(container);
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function render() {
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
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
}

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.includes(label));
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Botão não encontrado: ${label}`);
  return button;
}

describe('Checklists — exportação XLSX', () => {
  it('o botão Baixar XLSX aparece na sub-aba Checklists para Admin Master', async () => {
    render();
    await waitForSettle();

    expect(findButton('Baixar XLSX')).toBeTruthy();
  });

  it('o botão fica desabilitado enquanto a exportação está em andamento', async () => {
    let resolveExport: ((value: ProviderResult) => void) | undefined;
    exportDataMock.mockImplementation(() => new Promise<ProviderResult>((resolve) => {
      resolveExport = resolve;
    }));
    render();
    await waitForSettle();

    const exportButton = findButton('Baixar XLSX');
    await act(async () => {
      exportButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(exportButton.disabled).toBe(true);

    await act(async () => {
      resolveExport?.({ success: true, recordsSent: 2, blob: new Blob(['xlsx']) });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('a exportação recebe apenas os checklists visíveis após o filtro Com inconformidades', async () => {
    render();
    await waitForSettle();

    act(() => {
      findButton('Com inconformidades').click();
    });
    await act(async () => {
      findButton('Baixar XLSX').click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(exportDataMock).toHaveBeenCalledTimes(1);
    const exportRows = exportDataMock.mock.calls[0][1] as ChecklistExportRow[];
    expect(exportRows).toHaveLength(1);
    expect(exportRows[0].licensePlate).toBe('AAA1A11');
  });
});
