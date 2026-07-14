import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canCreateExtraPayments } from '../../lib/rolePermissions';

import {
  resolveDriverVehiclePrefill,
  resolveVehicleDriverPrefill,
} from './ExtraPaymentFormModal';

import type { ExtraPaymentDriverOption, ExtraPaymentVehicleOption } from '../../types/serviceExpense';

const { useQueryMock, useQueryClientMock, createExtraPaymentRequestMock, createExtraPaymentInstallmentsBatchMock } =
  vi.hoisted(() => ({
    useQueryMock: vi.fn(),
    useQueryClientMock: vi.fn(),
    createExtraPaymentRequestMock: vi.fn(),
    createExtraPaymentInstallmentsBatchMock: vi.fn(),
  }));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: useQueryClientMock,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../../services/serviceExpenseService', () => ({
  createExtraPaymentRequest: createExtraPaymentRequestMock,
  listExtraPaymentDrivers: vi.fn(),
  listExtraPaymentVehicles: vi.fn(),
}));

vi.mock('../../services/paymentInstallmentService', () => ({
  createExtraPaymentInstallmentsBatch: createExtraPaymentInstallmentsBatchMock,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

import ExtraPaymentFormModal from './ExtraPaymentFormModal';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

function mockQueries(vehicles: ExtraPaymentVehicleOption[], drivers: ExtraPaymentDriverOption[]) {
  useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
    const key = options.queryKey[0];
    if (key === 'extraPaymentVehicles') return { data: vehicles, isLoading: false, error: null };
    if (key === 'extraPaymentDrivers') return { data: drivers, isLoading: false, error: null };
    return { data: undefined, isLoading: false, error: null };
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  useQueryClientMock.mockReturnValue({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  });
  createExtraPaymentRequestMock.mockReset().mockResolvedValue('epr-1');
  createExtraPaymentInstallmentsBatchMock.mockReset().mockResolvedValue(undefined);
  useQueryMock.mockReset();
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
  vi.restoreAllMocks();
});

function renderModal() {
  const root = createRoot(container);
  (container as RootedDiv).__reactRoot = root;
  act(() => {
    root.render(<ExtraPaymentFormModal open onClose={() => {}} />);
  });
  return root;
}

describe('resolveVehicleDriverPrefill', () => {
  it('encontra o motorista vinculado ao veículo selecionado', () => {
    const vehicles: ExtraPaymentVehicleOption[] = [
      { id: 'v1', licensePlate: 'ABC1D23', driverId: 'd1', driverName: 'João Motorista' },
    ];

    expect(resolveVehicleDriverPrefill('v1', vehicles)).toEqual({
      driverId: 'd1',
      driverName: 'João Motorista',
    });
  });

  it('retorna null quando o veículo não tem motorista vinculado', () => {
    const vehicles: ExtraPaymentVehicleOption[] = [{ id: 'v1', licensePlate: 'ABC1D23' }];
    expect(resolveVehicleDriverPrefill('v1', vehicles)).toBeNull();
  });
});

describe('resolveDriverVehiclePrefill', () => {
  it('encontra o veículo vinculado ao motorista selecionado', () => {
    const drivers: ExtraPaymentDriverOption[] = [
      { id: 'd1', name: 'João Motorista', vehicleId: 'v1', vehicleLicensePlate: 'ABC1D23' },
    ];

    expect(resolveDriverVehiclePrefill('d1', drivers)).toEqual({
      vehicleId: 'v1',
      licensePlate: 'ABC1D23',
    });
  });

  it('retorna null quando o motorista não tem veículo vinculado', () => {
    const drivers: ExtraPaymentDriverOption[] = [{ id: 'd1', name: 'João Motorista' }];
    expect(resolveDriverVehiclePrefill('d1', drivers)).toBeNull();
  });
});

describe('ExtraPaymentFormModal', () => {
  it('selecionar veículo com motorista vinculado preenche o motorista', () => {
    mockQueries(
      [{ id: 'v1', licensePlate: 'ABC1D23', driverId: 'd1', driverName: 'João Motorista' }],
      [{ id: 'd1', name: 'João Motorista', vehicleId: 'v1', vehicleLicensePlate: 'ABC1D23' }],
    );

    renderModal();

    const vehicleSelect = container.querySelectorAll('select')[1] as HTMLSelectElement;
    act(() => {
      vehicleSelect.value = 'v1';
      vehicleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const driverSelect = container.querySelectorAll('select')[2] as HTMLSelectElement;
    expect(driverSelect.value).toBe('d1');
  });

  it('selecionar motorista com veículo vinculado preenche o veículo', () => {
    mockQueries(
      [{ id: 'v1', licensePlate: 'ABC1D23', driverId: 'd1', driverName: 'João Motorista' }],
      [{ id: 'd1', name: 'João Motorista', vehicleId: 'v1', vehicleLicensePlate: 'ABC1D23' }],
    );

    renderModal();

    const driverSelect = container.querySelectorAll('select')[2] as HTMLSelectElement;
    act(() => {
      driverSelect.value = 'd1';
      driverSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const vehicleSelect = container.querySelectorAll('select')[1] as HTMLSelectElement;
    expect(vehicleSelect.value).toBe('v1');
  });

  it('salvar cria o request e as parcelas extras', async () => {
    mockQueries([], []);
    renderModal();

    const setNativeValue = (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const supplierInput = container.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const serviceDateInput = dateInputs[0] as HTMLInputElement;
    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement;

    act(() => {
      setNativeValue(serviceDateInput, '2026-07-10');
      setNativeValue(supplierInput, 'Guincho Rápido LTDA');
      setNativeValue(amountInput, '350');
    });

    const firstDueDateInput = container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    act(() => {
      setNativeValue(firstDueDateInput, '2026-08-01');
    });

    const generateButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gerar parcelas'),
    );
    act(() => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Salvar'),
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createExtraPaymentRequestMock).toHaveBeenCalled();
    expect(createExtraPaymentInstallmentsBatchMock).toHaveBeenCalled();
  });

  it('preenche Centro de Custo e envia o valor em createExtraPaymentInstallmentsBatch', async () => {
    mockQueries([], []);
    renderModal();

    const setNativeValue = (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const textInputs = container.querySelectorAll('input[type="text"]');
    const supplierInput = textInputs[0] as HTMLInputElement;
    const centroCustoLabel = Array.from(container.querySelectorAll('label')).find((l) =>
      l.textContent === 'Centro de Custo',
    );
    const centroCustoInput = centroCustoLabel?.nextElementSibling as HTMLInputElement;
    const dateInputs = container.querySelectorAll('input[type="date"]');
    const serviceDateInput = dateInputs[0] as HTMLInputElement;
    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement;

    act(() => {
      setNativeValue(serviceDateInput, '2026-07-10');
      setNativeValue(supplierInput, 'Guincho Rápido LTDA');
      setNativeValue(centroCustoInput, 'Frota SP');
      setNativeValue(amountInput, '350');
    });

    const firstDueDateInput = container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    act(() => {
      setNativeValue(firstDueDateInput, '2026-08-01');
    });

    const generateButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gerar parcelas'),
    );
    act(() => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Salvar'),
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createExtraPaymentInstallmentsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ centroCusto: 'Frota SP' }),
    );
  });
});

describe('permissão de criação (Financeiro não cria Pagamento Extra)', () => {
  it('canCreateExtraPayments bloqueia Financeiro — o botão de abrir este modal não deve renderizar para esse papel', () => {
    expect(canCreateExtraPayments('Financeiro')).toBe(false);
  });
});
