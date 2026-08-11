import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    currentClient: null,
  }),
}));

import { defaultFieldSettings } from '../lib/fieldSettingsMappers';
import { OPERATION_START_BEFORE_ACQUISITION_WARNING } from '../lib/vehicleOperationStartDate';

import VehicleForm from './VehicleForm';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as { __reactRoot?: ReturnType<typeof createRoot> }).__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- native setter is required for this controlled-input DOM test.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function fieldSettingsWithOperationStartDate(operationStartDateOptional: boolean) {
  return {
    ...defaultFieldSettings('client-1'),
    operationStartDateOptional,
  };
}

describe('VehicleForm', () => {
  it('updates the selected type to a valid option when category changes', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={null}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const categorySelect = container.querySelector('select[name="category"]');
    const typeSelect = container.querySelector('select[name="type"]');

    expect(categorySelect).toBeInstanceOf(HTMLSelectElement);
    expect(typeSelect).toBeInstanceOf(HTMLSelectElement);

    act(() => {
      if (!(categorySelect instanceof HTMLSelectElement)) {
        throw new Error('Category select not found');
      }
      categorySelect.value = 'Médio';
      categorySelect?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect((typeSelect as HTMLSelectElement).value).toBe('Van');
  });

  it('hides implement-only restricted fields and keeps pbt/eixos visible', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={null}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const categorySelect = container.querySelector('select[name="category"]');

    act(() => {
      if (!(categorySelect instanceof HTMLSelectElement)) {
        throw new Error('Category select not found');
      }
      categorySelect.value = 'Semi-reboque/Implemento';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect((container.querySelector('select[name="type"]') as HTMLSelectElement).value).toBe('Semirreboque');
    expect(container.querySelector('select[name="energySource"]')).toBeNull();
    expect(container.querySelector('input[name="fuelType"]')).toBeNull();
    expect(container.querySelector('input[name="tankCapacity"]')).toBeNull();
    expect(container.querySelector('input[name="avgConsumption"]')).toBeNull();
    expect(container.querySelector('input[name="cmt"]')).toBeNull();
    expect(container.textContent).not.toContain('Motorista Responsável');
    expect(container.querySelector('input[name="pbt"]')).toBeInstanceOf(HTMLInputElement);
    expect(container.querySelector('input[name="eixos"]')).toBeInstanceOf(HTMLInputElement);
  });

  it('shows cavalo axle help and deprecation note', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={null}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const categorySelect = container.querySelector('select[name="category"]');
    const typeSelect = container.querySelector('select[name="type"]');

    act(() => {
      if (!(categorySelect instanceof HTMLSelectElement) || !(typeSelect instanceof HTMLSelectElement)) {
        throw new Error('Vehicle selects not found');
      }
      categorySelect.value = 'Pesado';
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
      typeSelect.value = 'Cavalo';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Informe apenas os eixos do cavalo mecânico; os do semi-reboque são cadastrados no próprio semi-reboque.');
    expect(container.textContent).toContain('Campo em descontinuação: em breve o semi-reboque será um cadastro próprio (ativo) vinculado por engate. Continue preenchendo por ora.');
  });

  it('renderiza o campo Data de Início na Operação sem asterisco quando o tenant não o exige', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={fieldSettingsWithOperationStartDate(true)}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const label = [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith('Data de Início na Operação'));
    expect(label?.textContent).toBe('Data de Início na Operação');
  });

  it('marca o campo como obrigatório quando o tenant exige', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={fieldSettingsWithOperationStartDate(false)}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const input = container.querySelector('input[name="operationStartDate"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).required).toBe(true);
  });

  it('exibe aviso quando o início na operação é anterior à aquisição', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={fieldSettingsWithOperationStartDate(true)}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const acquisitionInput = container.querySelector('input[name="acquisitionDate"]') as HTMLInputElement;
    const operationStartInput = container.querySelector('input[name="operationStartDate"]') as HTMLInputElement;
    setInputValue(acquisitionInput, '2026-03-10');
    setInputValue(operationStartInput, '2026-01-05');

    expect(container.textContent).toContain(OPERATION_START_BEFORE_ACQUISITION_WARNING);
    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Salvar Veículo')) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('não exibe aviso quando as datas são coerentes', () => {
    renderWithAct(
      <VehicleForm
        vehicle={null}
        fieldSettings={fieldSettingsWithOperationStartDate(true)}
        availableDrivers={[]}
        availableShippers={[]}
        availableOperationalUnits={[]}
        restoreFiles={false}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );

    const acquisitionInput = container.querySelector('input[name="acquisitionDate"]') as HTMLInputElement;
    const operationStartInput = container.querySelector('input[name="operationStartDate"]') as HTMLInputElement;
    setInputValue(acquisitionInput, '2026-01-05');
    setInputValue(operationStartInput, '2026-03-10');

    expect(container.textContent).not.toContain(OPERATION_START_BEFORE_ACQUISITION_WARNING);
  });
});
