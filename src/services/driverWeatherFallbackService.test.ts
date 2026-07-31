import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, geocodeCityStateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  geocodeCityStateMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('./weatherService', () => ({ geocodeCityState: geocodeCityStateMock }));

import { resolveDriverWeatherFallbackCoordinates } from './driverWeatherFallbackService';

function queryMock(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

describe('driverWeatherFallbackService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    geocodeCityStateMock.mockReset();
  });

  it('retorna coordenadas quando driver, veículo e unidade têm cidade/UF', async () => {
    const driverQuery = queryMock({ data: { id: 'driver-1', client_id: 'client-1' }, error: null });
    const vehicleQuery = queryMock({
      data: {
        id: 'vehicle-1',
        operational_unit_id: 'unit-1',
        operational_units: { city: 'São Paulo', state: 'SP' },
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(driverQuery).mockReturnValueOnce(vehicleQuery);
    geocodeCityStateMock.mockResolvedValue({ latitude: -23.55, longitude: -46.63 });

    await expect(
      resolveDriverWeatherFallbackCoordinates({ profileId: 'profile-1', clientId: 'client-1' }),
    ).resolves.toEqual({
      coordinates: { latitude: -23.55, longitude: -46.63 },
      locationLabel: 'São Paulo/SP',
    });
    expect(geocodeCityStateMock).toHaveBeenCalledWith({ city: 'São Paulo', state: 'SP' });
  });

  it('retorna null quando não há driver', async () => {
    fromMock.mockReturnValueOnce(queryMock({ data: null, error: null }));

    await expect(
      resolveDriverWeatherFallbackCoordinates({ profileId: 'profile-1', clientId: 'client-1' }),
    ).resolves.toBeNull();
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('retorna null quando não há veículo titular', async () => {
    fromMock
      .mockReturnValueOnce(queryMock({ data: { id: 'driver-1', client_id: 'client-1' }, error: null }))
      .mockReturnValueOnce(queryMock({ data: null, error: null }));

    await expect(
      resolveDriverWeatherFallbackCoordinates({ profileId: 'profile-1', clientId: 'client-1' }),
    ).resolves.toBeNull();
  });

  it('retorna null quando a unidade não tem cidade', async () => {
    fromMock
      .mockReturnValueOnce(queryMock({ data: { id: 'driver-1', client_id: 'client-1' }, error: null }))
      .mockReturnValueOnce(
        queryMock({ data: { id: 'vehicle-1', operational_units: { city: null, state: 'SP' } }, error: null }),
      );

    await expect(
      resolveDriverWeatherFallbackCoordinates({ profileId: 'profile-1', clientId: 'client-1' }),
    ).resolves.toBeNull();
    expect(geocodeCityStateMock).not.toHaveBeenCalled();
  });

  it('retorna null quando o geocoding falha', async () => {
    fromMock
      .mockReturnValueOnce(queryMock({ data: { id: 'driver-1', client_id: 'client-1' }, error: null }))
      .mockReturnValueOnce(
        queryMock({ data: { id: 'vehicle-1', operational_units: { city: 'São Paulo', state: 'SP' } }, error: null }),
      );
    geocodeCityStateMock.mockResolvedValue(null);

    await expect(
      resolveDriverWeatherFallbackCoordinates({ profileId: 'profile-1', clientId: 'client-1' }),
    ).resolves.toBeNull();
  });
});
