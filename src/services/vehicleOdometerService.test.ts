import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { buildLastKmDisplayParts, getVehicleLastKmMap } from './vehicleOdometerService';

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
      data: [{ vehicle_id: 'v1', effective_km: 12345, is_corrected: false }],
      error: null,
    });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.get('v1')).toEqual({ value: 12345, isCorrected: false });
  });

  it('omite veículo sem leitura do mapa', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.has('v1')).toBe(false);
  });

  it('escolhe o maior effective_km quando há múltiplas linhas para o mesmo veículo', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { vehicle_id: 'v1', effective_km: 1000, is_corrected: false },
        { vehicle_id: 'v1', effective_km: 5000, is_corrected: true },
        { vehicle_id: 'v1', effective_km: 2000, is_corrected: false },
      ],
      error: null,
    });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.get('v1')).toEqual({ value: 5000, isCorrected: true });
  });

  it('propaga isCorrected: true quando a linha de maior effective_km for corrigida', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { vehicle_id: 'v1', effective_km: 5000, is_corrected: true },
        { vehicle_id: 'v1', effective_km: 1000, is_corrected: false },
      ],
      error: null,
    });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.get('v1')).toEqual({ value: 5000, isCorrected: true });
  });

  it('omite veículo cujo effective_km vem nulo do banco (sem checklist e sem Km Inicial)', async () => {
    rpcMock.mockResolvedValue({
      data: [{ vehicle_id: 'v1', effective_km: null, is_corrected: false }],
      error: null,
    });

    const map = await getVehicleLastKmMap(['v1']);

    expect(map.has('v1')).toBe(false);
  });

  it('deduplica vehicleIds repetidos antes de chamar o RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await getVehicleLastKmMap(['v1', 'v1', 'v2']);

    expect(rpcMock).toHaveBeenCalledWith('get_vehicle_odometer_readings_batch', {
      p_vehicle_ids: ['v1', 'v2'],
    });
  });
});

describe('buildLastKmDisplayParts', () => {
  it('retorna fallback quando não há leitura', () => {
    expect(buildLastKmDisplayParts(null)).toEqual({
      prefix: 'Último Km:',
      valueText: null,
      suffix: null,
      fullText: 'Último Km: sem leitura',
    });
    expect(buildLastKmDisplayParts(undefined)).toEqual({
      prefix: 'Último Km:',
      valueText: null,
      suffix: null,
      fullText: 'Último Km: sem leitura',
    });
  });

  it('formata leitura normal sem sufixo', () => {
    const parts = buildLastKmDisplayParts({ value: 38001, isCorrected: false });

    expect(parts.suffix).toBeNull();
    expect(parts.fullText).toBe('Último Km: 38.001 km');
  });

  it('formata leitura corrigida com sufixo (Editado)', () => {
    const parts = buildLastKmDisplayParts({ value: 38001, isCorrected: true });

    expect(parts.suffix).toBe('(Editado)');
    expect(parts.fullText).toBe('Último Km: 38.001 km (Editado)');
  });
});
