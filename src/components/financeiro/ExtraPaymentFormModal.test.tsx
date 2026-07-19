import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canCreateExtraPayments } from '../../lib/rolePermissions';

import {
  resolveDriverVehiclePrefill,
  resolveVehicleDriverPrefill,
} from './ExtraPaymentFormModal';

import type { ExtraPaymentDriverOption, ExtraPaymentVehicleOption } from '../../types/serviceExpense';

const {
  useQueryMock,
  useQueryClientMock,
  createExtraPaymentRequestMock,
  createExtraPaymentInstallmentsBatchMock,
  uploadFinancialDocumentMock,
  supabaseUpdateMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  createExtraPaymentRequestMock: vi.fn(),
  createExtraPaymentInstallmentsBatchMock: vi.fn(),
  uploadFinancialDocumentMock: vi.fn(),
  supabaseUpdateMock: vi.fn(),
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

vi.mock('../../lib/storageHelpers', async () => {
  const actual = await vi.importActual<typeof import('../../lib/storageHelpers')>('../../lib/storageHelpers');
  return {
    ...actual,
    uploadFinancialDocument: uploadFinancialDocumentMock,
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: supabaseUpdateMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
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
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });

  useQueryClientMock.mockReturnValue({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  });
  createExtraPaymentRequestMock.mockReset().mockResolvedValue('epr-1');
  createExtraPaymentInstallmentsBatchMock.mockReset().mockResolvedValue(undefined);
  uploadFinancialDocumentMock.mockReset();
  supabaseUpdateMock.mockClear();
  useQueryMock.mockReset();
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
  vi.unstubAllGlobals();
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

describe('ExtraPaymentFormModal — boleto único', () => {
  function pickFile(input: HTMLInputElement, file: File) {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findSharedBoletoInput(): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find(
      (l) => l.textContent === 'Boleto único (opcional)',
    );
    return label?.nextElementSibling as HTMLInputElement;
  }

  it('renderiza o rótulo "Boleto único (opcional)" com o modal aberto', () => {
    mockQueries([], []);
    renderModal();
    expect(
      Array.from(container.querySelectorAll('label')).some((l) => l.textContent === 'Boleto único (opcional)'),
    ).toBe(true);
  });

  it('após anexar o boleto único, a tabela de parcelas exibe "Boleto único" e não oferece anexo individual', async () => {
    mockQueries([], []);
    uploadFinancialDocumentMock.mockResolvedValue('client-1/payments/extra/boleto-1.pdf');
    renderModal();

    const setNativeValue = (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const firstDueDateInput = container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    act(() => {
      setNativeValue(amountInput, '350');
      setNativeValue(firstDueDateInput, '2026-08-01');
    });

    const generateButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gerar parcelas'),
    );
    act(() => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sharedBoletoInput = findSharedBoletoInput();
    await act(async () => {
      pickFile(sharedBoletoInput, new File(['x'], 'boleto.pdf', { type: 'application/pdf' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const table = container.querySelector('table');
    expect(table?.textContent).toContain('Boleto único');
    expect(table?.querySelector('input[type=file]')).toBeNull();
  });

  it('clicar em "Remover" reabilita o "+ Boleto" individual', async () => {
    mockQueries([], []);
    uploadFinancialDocumentMock.mockResolvedValue('client-1/payments/extra/boleto-1.pdf');
    renderModal();

    const setNativeValue = (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const firstDueDateInput = container.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    act(() => {
      setNativeValue(amountInput, '350');
      setNativeValue(firstDueDateInput, '2026-08-01');
    });

    const generateButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gerar parcelas'),
    );
    act(() => {
      generateButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sharedBoletoInput = findSharedBoletoInput();
    await act(async () => {
      pickFile(sharedBoletoInput, new File(['x'], 'boleto.pdf', { type: 'application/pdf' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const removeButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Remover',
    );
    act(() => {
      removeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const table = container.querySelector('table');
    expect(table?.querySelector('input[type=file]')).not.toBeNull();
    expect(table?.textContent).not.toContain('Boleto único');
  });

  it('erro no upload: a mensagem entra no bloco de avisos e sharedBoletoPath permanece vazio', async () => {
    mockQueries([], []);
    uploadFinancialDocumentMock.mockRejectedValue(new Error('Falha de rede.'));
    renderModal();

    const sharedBoletoInput = findSharedBoletoInput();
    await act(async () => {
      pickFile(sharedBoletoInput, new File(['x'], 'boleto.pdf', { type: 'application/pdf' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Falha de rede.');
    expect(container.textContent).toContain('Boleto único (opcional)');
    expect(container.textContent).not.toContain('Boleto único anexado');
  });
});

describe('ExtraPaymentFormModal — fotos de evidência', () => {
  function fillMinimalAndSave() {
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
    return saveButton;
  }

  function evidenceFileInput(): HTMLInputElement {
    return container.querySelectorAll('input[type=file][accept="image/*"]')[0] as HTMLInputElement;
  }

  function pickFiles(input: HTMLInputElement, files: File[]) {
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('o bloco "Fotos de evidência (opcional)" é renderizado com o modal aberto', () => {
    mockQueries([], []);
    renderModal();
    expect(container.textContent).toContain('Fotos de evidência (opcional)');
  });

  it('salvar com 2 fotos chama uploadFinancialDocument 2 vezes com kind = evidencia', async () => {
    mockQueries([], []);
    uploadFinancialDocumentMock.mockResolvedValue('client-1/payments/epr-1/evidencia-1.jpg');
    renderModal();

    act(() => {
      pickFiles(evidenceFileInput(), [
        new File([new Uint8Array(1024)], 'a.jpg', { type: 'image/jpeg' }),
        new File([new Uint8Array(1024)], 'b.jpg', { type: 'image/jpeg' }),
      ]);
    });

    const saveButton = fillMinimalAndSave();
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const evidenciaCalls = uploadFinancialDocumentMock.mock.calls.filter((c) => c[3] === 'evidencia');
    expect(evidenciaCalls).toHaveLength(2);
  });

  it('salvar sem foto nenhuma não chama uploadFinancialDocument com evidencia; pagamento é criado normalmente', async () => {
    mockQueries([], []);
    renderModal();

    const saveButton = fillMinimalAndSave();
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const evidenciaCalls = uploadFinancialDocumentMock.mock.calls.filter((c) => c[3] === 'evidencia');
    expect(evidenciaCalls).toHaveLength(0);
    expect(createExtraPaymentRequestMock).toHaveBeenCalled();
    expect(createExtraPaymentInstallmentsBatchMock).toHaveBeenCalled();
  });

  it('1 das 2 fotos falha: o pagamento é criado, o aviso aparece, e o update grava só o caminho que subiu', async () => {
    mockQueries([], []);
    uploadFinancialDocumentMock
      .mockResolvedValueOnce('client-1/payments/epr-1/evidencia-1.jpg')
      .mockRejectedValueOnce(new Error('Falha ao anexar foto 2.'));

    // invalidateQueries fica pendente propositalmente: permite inspecionar o
    // estado de "avisos" antes do reset() final, que os limpa ao concluir o salvamento.
    let resolveInvalidate!: () => void;
    useQueryClientMock.mockReturnValue({
      invalidateQueries: vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveInvalidate = resolve; })),
    });

    renderModal();

    act(() => {
      pickFiles(evidenceFileInput(), [
        new File([new Uint8Array(1024)], 'a.jpg', { type: 'image/jpeg' }),
        new File([new Uint8Array(1024)], 'b.jpg', { type: 'image/jpeg' }),
      ]);
    });

    const saveButton = fillMinimalAndSave();
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createExtraPaymentRequestMock).toHaveBeenCalled();
    expect(container.textContent).toContain('Falha ao anexar foto 2.');
    expect(supabaseUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ evidence_urls: ['client-1/payments/epr-1/evidencia-1.jpg'] }),
    );

    await act(async () => {
      resolveInvalidate();
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});

describe('permissão de criação (Financeiro não cria Pagamento Extra)', () => {
  it('canCreateExtraPayments bloqueia Financeiro — o botão de abrir este modal não deve renderizar para esse papel', () => {
    expect(canCreateExtraPayments('Financeiro')).toBe(false);
  });
});
