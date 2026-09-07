import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invokeEdgeFunction } from '../lib/invokeEdgeFn';

import { getMeliRouteHistory } from './meliUtilizationService';

vi.mock('../lib/invokeEdgeFn', () => ({
  invokeEdgeFunction: vi.fn(),
}));

const mockedInvokeEdgeFunction = vi.mocked(invokeEdgeFunction);

const validRoute = {
  plate: 'ABC1D23',
  routeDate: '2026-09-06',
  routeId: '123',
  driverName: 'Maria Souza',
  serviceCenter: 'SRJ1',
  cycle: 'AM',
  odometerDistanceKm: 41.2,
};

beforeEach(() => {
  mockedInvokeEdgeFunction.mockReset();
});

describe('getMeliRouteHistory', () => {
  it('chama o modo history e devolve uma resposta bem formada', async () => {
    mockedInvokeEdgeFunction.mockResolvedValue({ routes: [validRoute] });

    await expect(
      getMeliRouteHistory({ from: '2026-09-01', to: '2026-09-06' }),
    ).resolves.toEqual([validRoute]);
    expect(mockedInvokeEdgeFunction).toHaveBeenCalledWith('vehicle-last-routes', {
      mode: 'history',
      from: '2026-09-01',
      to: '2026-09-06',
    });
  });

  it('devolve lista vazia quando routes está ausente', async () => {
    mockedInvokeEdgeFunction.mockResolvedValue({ other: [] });

    await expect(
      getMeliRouteHistory({ from: '2026-09-01', to: '2026-09-06' }),
    ).resolves.toEqual([]);
  });

  it('descarta routeId numérico e preserva as entradas válidas', async () => {
    mockedInvokeEdgeFunction.mockResolvedValue({
      routes: [{ ...validRoute, routeId: 123 }, validRoute],
    });

    await expect(
      getMeliRouteHistory({ from: '2026-09-01', to: '2026-09-06' }),
    ).resolves.toEqual([validRoute]);
  });
});
