import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { formatLastKmLabel, getVehicleLastKmMap } from './vehicleOdometerService';

describe('getVehicleLastKmMap', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('retorna mapa vazio para lote vazio, sem chamar o RPC', async () => {
    const map = await getVehicleLastKmMap([]);

    expect(map.size).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('inclui veículo com leitura no mapa', async () => {
    rpcMock.mockResolvedValue({
      data: [{ vehicle_id: 'v1', effective_km: 12345 }],
      error: null,
    });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.get('v1')).toBe(12345);
  });

  it('omite veículo sem leitura do mapa', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.has('v1')).toBe(false);
  });

  it('escolhe o maior effective_km quando há múltiplas linhas para o mesmo veículo', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { vehicle_id: 'v1', effective_km: 1000 },
        { vehicle_id: 'v1', effective_km: 5000 },
        { vehicle_id: 'v1', effective_km: 2000 },
      ],
      error: null,
    });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.get('v1')).toBe(5000);
  });

  it('deduplica vehicleIds repetidos antes de chamar o RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await getVehicleLastKmMap(['v1', 'v1', 'v2']);

    expect(rpcMock).toHaveBeenCalledWith('get_vehicle_odometer_readings_batch', {
      p_vehicle_ids: ['v1', 'v2'],
    });
  });
});

describe('formatLastKmLabel', () => {
  it('formata km com separador pt-BR', () => {
    expect(formatLastKmLabel(123456)).toBe('Último Km: 123.456 km');
  });

  it('exibe fallback quando não há leitura', () => {
    expect(formatLastKmLabel(null)).toBe('Último Km: sem leitura');
    expect(formatLastKmLabel(undefined)).toBe('Último Km: sem leitura');
  });
});
