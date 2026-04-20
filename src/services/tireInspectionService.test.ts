import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const { mockFrom, mockStorage } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockStorage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/photo.jpg' } }),
    }),
  };
  return { mockFrom, mockStorage };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: mockStorage,
  },
}));

import {
  fetchDistinctManufacturers,
  fetchDistinctBrands,
  validateTireInspectionEligibility,
  createTireInspection,
  saveInspectionResponse,
  completeTireInspection,
} from './tireInspectionService';
import type { AxleConfigEntry } from '../types/tire';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const simpleAxleConfig: AxleConfigEntry[] = [
  { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
  { order: 2, type: 'simples', rodagem: 'simples', physicalAxles: 1 },
];

function makeChain(returnValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    then: undefined as unknown,
  };
  // Make it thenable so await works
  Object.defineProperty(chain, 'then', { get: () => undefined });
  return { ...chain, resolvedValue: returnValue };
}

function makeSelectChain(returnValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
  };
  // Make the chain itself awaitable
  (chain as Record<string | symbol, unknown>)[Symbol.for('nodejs.util.promisify.custom')] = undefined;
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── fetchDistinctManufacturers ───────────────────────────────────────────────

describe('fetchDistinctManufacturers', () => {
  it('retorna fabricantes únicos + opção "Outros"', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({
        data: [{ manufacturer: 'Michelin' }, { manufacturer: 'Michelin' }, { manufacturer: 'Bridgestone' }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await fetchDistinctManufacturers('veh-1');

    expect(result).toEqual(['Michelin', 'Bridgestone', 'Outros / Não é possível identificar']);
  });

  it('retorna apenas "Outros" quando não há fabricantes cadastrados', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await fetchDistinctManufacturers('veh-1');

    expect(result).toEqual(['Outros / Não é possível identificar']);
  });

  it('lança erro quando Supabase retorna error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(fetchDistinctManufacturers('veh-1')).rejects.toThrow('DB error');
  });
});

// ─── fetchDistinctBrands ──────────────────────────────────────────────────────

describe('fetchDistinctBrands', () => {
  it('retorna marcas únicas + opção "Outros"', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({
        data: [{ brand: 'X Line Energy' }, { brand: 'R168' }, { brand: 'X Line Energy' }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await fetchDistinctBrands('veh-1');

    expect(result).toEqual(['X Line Energy', 'R168', 'Outros / Não é possível identificar']);
  });
});

// ─── validateTireInspectionEligibility ───────────────────────────────────────

describe('validateTireInspectionEligibility', () => {
  it('lança erro quando pneus não estão todos cadastrados', async () => {
    // 2 eixos simples = 4 pneus + 1 estepe = 5 total, mas só 3 cadastrados
    const tiresChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      resolvedValue: { data: [{ current_position: 'E1' }, { current_position: 'D1' }, { current_position: 'E2' }], error: null },
    };
    (tiresChain as Record<string | symbol, unknown>)[Symbol.iterator] = undefined;

    // First call: tires, Second call: last inspection
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          resolvedValue: { data: [{ current_position: 'E1' }, { current_position: 'D1' }], error: null },
          then: (resolve: (v: unknown) => void) => resolve({ data: [{ current_position: 'E1' }, { current_position: 'D1' }], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await expect(
      validateTireInspectionEligibility('veh-1', simpleAxleConfig, 1, 'Truck', 7),
    ).rejects.toThrow('É necessário cadastrar todos os pneus');
  });

  it('lança erro quando inspeção foi feita recentemente', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // tires: todas as 5 posições cadastradas
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => void) => resolve({
            data: [
              { current_position: 'E1' }, { current_position: 'D1' },
              { current_position: 'E2' }, { current_position: 'D2' },
              { current_position: 'Step 1' },
            ],
            error: null,
          }),
        };
      }
      // last inspection: completed yesterday (< 7 days)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { completed_at: yesterday }, error: null }),
      };
    });

    await expect(
      validateTireInspectionEligibility('veh-1', simpleAxleConfig, 1, 'Truck', 7),
    ).rejects.toThrow('Próxima inspeção disponível a partir de');
  });
});

// ─── createTireInspection ─────────────────────────────────────────────────────

describe('createTireInspection', () => {
  it('cria inspeção e retorna o id gerado', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-insp-id' }, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const id = await createTireInspection({
      clientId: 'client-1',
      vehicleId: 'veh-1',
      filledBy: 'user-1',
      axleConfig: simpleAxleConfig,
      stepsCount: 1,
    });

    expect(id).toBe('new-insp-id');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-1',
        vehicle_id: 'veh-1',
        filled_by: 'user-1',
        axle_config_snapshot: simpleAxleConfig,
        steps_count_snapshot: 1,
      }),
    );
  });

  it('lança erro se Supabase retorna error', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('insert failed') }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(
      createTireInspection({ clientId: 'c', vehicleId: 'v', filledBy: 'u', axleConfig: [], stepsCount: 0 }),
    ).rejects.toThrow('insert failed');
  });
});

// ─── saveInspectionResponse ───────────────────────────────────────────────────

describe('saveInspectionResponse', () => {
  it('faz upsert com photo_url retornado pelo storage', async () => {
    const savedRow = {
      id: 'resp-new',
      inspection_id: 'insp-1',
      tire_id: null,
      position_code: 'E1',
      position_label: 'Eixo 1 Esquerdo',
      dot: null,
      fire_marking: null,
      manufacturer: 'Michelin',
      brand: 'X Line',
      photo_url: 'https://storage.example.com/photo.jpg',
      photo_timestamp: '2026-04-12T10:00:00Z',
      status: 'conforme',
      observation: null,
      responded_at: '2026-04-12T10:00:30Z',
    };
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: savedRow, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await saveInspectionResponse({
      inspectionId: 'insp-1',
      clientId: 'client-1',
      response: {
        inspectionId: 'insp-1',
        positionCode: 'E1',
        positionLabel: 'Eixo 1 Esquerdo',
        manufacturer: 'Michelin',
        brand: 'X Line',
        photoUrl: '',
        photoTimestamp: '2026-04-12T10:00:00Z',
        status: 'conforme',
        respondedAt: '2026-04-12T10:00:30Z',
      },
      photoBlob: new Blob(['fake'], { type: 'image/jpeg' }),
      photoFilename: 'E1_photo.jpg',
    });

    expect(result.positionCode).toBe('E1');
    expect(result.photoUrl).toBe('https://storage.example.com/photo.jpg');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ inspection_id: 'insp-1', position_code: 'E1' }),
      { onConflict: 'inspection_id,position_code' },
    );
  });
});

// ─── completeTireInspection ───────────────────────────────────────────────────

describe('completeTireInspection', () => {
  it('lança erro se alguma posição não foi respondida', async () => {
    // fetchTireInspection → inspection com 2 eixos simples + 1 estepe = 5 posições
    const inspRow = {
      id: 'insp-1',
      client_id: 'client-1',
      vehicle_id: 'veh-1',
      filled_by: 'user-1',
      started_at: '2026-04-12T10:00:00Z',
      completed_at: null,
      status: 'in_progress',
      odometer_km: null,
      latitude: null,
      longitude: null,
      device_info: null,
      notes: null,
      axle_config_snapshot: simpleAxleConfig,
      steps_count_snapshot: 1,
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // fetchTireInspection
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: inspRow, error: null }),
        };
      }
      // fetchTireInspectionResponses: apenas 3 respostas das 5 esperadas
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ position_code: 'E1' }, { position_code: 'D1' }, { position_code: 'E2' }],
          error: null,
        }),
      };
    });

    await expect(completeTireInspection('insp-1', 125000)).rejects.toThrow('pneu(s) ainda sem resposta');
  });
});
