import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FuelSupply } from '../types/fuelSupply';

const DELUNA_CLIENT_ID = '11111111-1111-1111-1111-111111111111';

const getFuelSuppliesMock = vi.fn<(clientId: string, range: { from: string; to: string }) => Promise<FuelSupply[]>>();
const triggerVeloeFuelSyncMock = vi.fn<() => Promise<unknown>>();
let accessState = { canView: true, canSync: true };

vi.mock('../services/fuelSupplyService', () => ({
  getFuelSupplies: (clientId: string, range: { from: string; to: string }) =>
    getFuelSuppliesMock(clientId, range),
  triggerVeloeFuelSync: () => triggerVeloeFuelSyncMock(),
}));

vi.mock('../hooks/useFuelSupplyAccess', () => ({
  useFuelSupplyAccess: () => accessState,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'Manager', clientId: DELUNA_CLIENT_ID },
    currentClient: { id: DELUNA_CLIENT_ID, name: 'Deluna Transportes' },
  }),
}));

// eslint-disable-next-line import/order -- vi.mock calls above are hoisted by Vitest; SUT import must follow mock registration
import FuelSupplies from './FuelSupplies';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;

function supply(overrides: Partial<FuelSupply> = {}): FuelSupply {
  return {
    id: 'fs-1',
    clientId: DELUNA_CLIENT_ID,
    vehicleId: 'v1',
    driverId: null,
    plate: 'ABC1D23',
    driverName: 'JOSE DA SILVA',
    vehicleModel: 'ONIX',
    fuelType: 'GASOLINA COMUM',
    amountLiters: 10,
    unitValue: 5,
    totalValue: 50,
    odometer: 28620,
    previousOdometer: 28000,
    kmTraveled: 100,
    transactionDate: '2026-09-01T12:00:00.000Z',
    transactionStatus: 'APROVADA',
    supplyLocation: 'AUTOPOSTO TESTE LTDA',
    network: 'POSTOS VELOE',
    costCenter: 'OO1',
    baseName: 'VELOE MARKETING',
    cardLast4: '3456',
    shipperId: 's1',
    shipperName: 'Mercado Livre',
    operationalUnitId: 'u1',
    operationalUnitName: 'Base Cajamar',
    ...overrides,
  };
}

const dataset: FuelSupply[] = [
  supply({ id: 'a' }),
  supply({
    id: 'b',
    plate: 'XYZ9K88',
    totalValue: 200,
    amountLiters: 40,
    shipperId: 's2',
    shipperName: 'Ambev',
    operationalUnitId: 'u2',
    operationalUnitName: 'Base Guarulhos',
  }),
];

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  accessState = { canView: true, canSync: true };
  getFuelSuppliesMock.mockReset();
  triggerVeloeFuelSyncMock.mockReset();
  getFuelSuppliesMock.mockResolvedValue(dataset);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
});

async function render(initialEntry = '/abastecimento') {
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <FuelSupplies />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await Promise.resolve();
  });
  // Aguarda o React Query resolver a queryFn mockada.
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (!container.textContent?.includes('Carregando abastecimentos…')) break;
  }
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
}

describe('FuelSupplies', () => {
  it('renderiza os 5 KPIs e as linhas da tabela', async () => {
    await render();

    for (const label of [
      'Valor total',
      'Litros totais',
      'Preço médio/litro',
      'Consumo médio',
      'Abastecimentos',
    ]) {
      expect(container.textContent).toContain(label);
    }
    expect(bodyRows()).toHaveLength(2);
    expect(container.textContent).toContain('ABC1D23');
    expect(container.textContent).toContain('XYZ9K88');
  });

  it('filtro de embarcador na URL reduz a tabela e recalcula os KPIs', async () => {
    await render('/abastecimento?shipper=s1');

    expect(bodyRows()).toHaveLength(1);
    expect(container.textContent).toContain('ABC1D23');
    expect(container.textContent).not.toContain('XYZ9K88');
    // Só o abastecimento de R$ 50 entra no total.
    expect(container.textContent).toContain('50,00');
    expect(container.textContent).not.toContain('250,00');
  });

  it('filtro de placa parcial na URL filtra a tabela', async () => {
    await render('/abastecimento?q=XYZ');

    expect(bodyRows()).toHaveLength(1);
    expect(container.textContent).toContain('XYZ9K88');
  });

  it('período sem dados exibe estado vazio e KPIs zerados sem NaN', async () => {
    getFuelSuppliesMock.mockResolvedValue([]);
    await render();

    expect(container.textContent).toContain('Nenhum abastecimento no período selecionado.');
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).toContain('—');
  });

  it('erro da query exibe mensagem e botão de nova tentativa', async () => {
    getFuelSuppliesMock.mockRejectedValue(new Error('falha'));
    await render();

    expect(container.textContent).toContain('Não foi possível carregar os abastecimentos.');
    expect(container.textContent).toContain('Tentar novamente');
  });

  it('segurança: sem canSync o botão "Sincronizar agora" não é renderizado', async () => {
    accessState = { canView: true, canSync: false };
    await render();

    expect(container.textContent).not.toContain('Sincronizar agora');
  });

  it('exibe o aviso de abastecimentos sem veículo identificado', async () => {
    getFuelSuppliesMock.mockResolvedValue([
      supply({ id: 'sem-veiculo', vehicleId: null, shipperId: null, operationalUnitId: null }),
    ]);
    await render();

    expect(container.textContent).toContain('1 abastecimento(s) sem veículo identificado');
  });
});
