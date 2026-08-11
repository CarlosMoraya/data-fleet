import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VehicleDetailModal from './VehicleDetailModal';

import type { Vehicle } from '../types/vehicle';

type ReactContainer = HTMLDivElement & { __reactRoot?: ReturnType<typeof createRoot> };

let container: ReactContainer;
let queryClient: QueryClient;

const vehicle: Vehicle = {
  id: 'vehicle-1',
  clientId: 'client-1',
  active: true,
  type: 'Truck',
  energySource: 'Combustão',
  coolingEquipment: false,
  licensePlate: 'ABC1D23',
  renavam: '123456789',
  chassi: '9BWZZZ377VT004251',
  detranUF: 'SP',
  brand: 'Volvo',
  model: 'FH',
  year: 2024,
  color: 'Branco',
  acquisition: 'Owned',
  fipePrice: 100000,
  tracker: 'Tracker',
  antt: 'ANTT',
  owner: 'BetaFleet',
  autonomy: 10,
  category: 'Pesado',
};

beforeEach(() => {
  container = document.createElement('div') as ReactContainer;
  document.body.appendChild(container);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderModal(props: Partial<React.ComponentProps<typeof VehicleDetailModal>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <VehicleDetailModal
          vehicle={vehicle}
          onClose={() => {}}
          {...props}
        />
      </QueryClientProvider>,
    );
  });
}

describe('VehicleDetailModal', () => {
  it('exibe o botão Editar e chama o callback ao clicar', () => {
    const onEdit = vi.fn();
    renderModal({ onEdit });

    const editButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Editar'),
    );

    expect(editButton).not.toBeUndefined();

    act(() => {
      editButton?.click();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('não exibe o botão Editar sem onEdit', () => {
    renderModal();

    const editButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Editar'),
    );

    expect(editButton).toBeUndefined();
  });

  it('mantém o botão Fechar e chama onClose sem onEdit', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const closeButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Fechar'),
    );

    expect(closeButton).not.toBeUndefined();

    act(() => {
      closeButton?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exibe a data de início na operação formatada', () => {
    renderModal({ vehicle: { ...vehicle, operationStartDate: '2026-03-15' } });

    const label = [...container.querySelectorAll('p')].find((item) => item.textContent === 'Início na Operação');
    expect(label?.parentElement?.textContent).toContain('15/03/2026');
  });

  it('exibe travessão quando a data de início na operação não está preenchida', () => {
    renderModal();

    const label = [...container.querySelectorAll('p')].find((item) => item.textContent === 'Início na Operação');
    expect(label?.parentElement?.textContent).toContain('—');
  });
});
