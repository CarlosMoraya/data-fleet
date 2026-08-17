import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeEdgeFunctionMock } = vi.hoisted(() => ({
  invokeEdgeFunctionMock: vi.fn(),
}));

vi.mock('../lib/invokeEdgeFn', () => ({
  invokeEdgeFunction: invokeEdgeFunctionMock,
}));

import {
  buildLastRouteText,
  getVehicleLastRouteMap,
  normalizeFleetPlate,
} from './vehicleLastRouteService';

beforeEach(() => {
  invokeEdgeFunctionMock.mockReset();
});

describe('normalizeFleetPlate', () => {
  it('normaliza placas da frota e placas com prefixo', () => {
    expect(normalizeFleetPlate('TEV8C85')).toBe('TEV8C85');
    expect(normalizeFleetPlate('SDD-TEV8C85')).toBe('TEV8C85');
    expect(normalizeFleetPlate('abc-1d23')).toBe('ABC1D23');
  });

  it('devolve vazio para entrada vazia', () => {
    expect(normalizeFleetPlate(null)).toBe('');
    expect(normalizeFleetPlate('')).toBe('');
  });
});

describe('buildLastRouteText', () => {
  it('monta o texto da última rota', () => {
    expect(buildLastRouteText({
      lastRouteDate: '2026-08-15',
      routeId: '425129405',
    })).toBe('Últ. rota 15/08/2026 · #425129405');
  });

  it('devolve null quando não há rota', () => {
    expect(buildLastRouteText(undefined)).toBeNull();
    expect(buildLastRouteText(null)).toBeNull();
  });
});

describe('getVehicleLastRouteMap', () => {
  it('indexa as rotas pela placa normalizada', async () => {
    invokeEdgeFunctionMock.mockResolvedValue({
      routes: [
        { plate: 'TEV8C85', lastRouteDate: '2026-08-15', routeId: '425129405' },
        { plate: 'abc-1d23', lastRouteDate: '2026-08-14', routeId: '425129404' },
      ],
    });

    const result = await getVehicleLastRouteMap();

    expect(invokeEdgeFunctionMock).toHaveBeenCalledWith('vehicle-last-routes', {});
    expect(result).toEqual(new Map([
      ['TEV8C85', { lastRouteDate: '2026-08-15', routeId: '425129405' }],
      ['ABC1D23', { lastRouteDate: '2026-08-14', routeId: '425129404' }],
    ]));
  });

  it('propaga a rejeição da Edge Function', async () => {
    const error = new Error('indisponível');
    invokeEdgeFunctionMock.mockRejectedValue(error);

    await expect(getVehicleLastRouteMap()).rejects.toBe(error);
  });

  it('devolve Map vazio para lista vazia ou resposta sem routes', async () => {
    invokeEdgeFunctionMock.mockResolvedValueOnce({ routes: [] });
    await expect(getVehicleLastRouteMap()).resolves.toEqual(new Map());

    invokeEdgeFunctionMock.mockResolvedValueOnce({});
    await expect(getVehicleLastRouteMap()).resolves.toEqual(new Map());
  });
});
