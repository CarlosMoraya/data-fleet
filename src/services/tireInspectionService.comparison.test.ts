import { describe, it, expect, vi, beforeEach } from 'vitest';

import { fetchTireInspectionComparison } from './tireInspectionService';

import type { TireInspection } from '../types';
import type { AxleConfigEntry } from '../types/tire';

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const simpleAxleConfig: AxleConfigEntry[] = [
  { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
  { order: 2, type: 'simples', rodagem: 'simples', physicalAxles: 1 },
];

const currentInspection: TireInspection = {
  id: 'insp-current',
  clientId: 'client-1',
  vehicleId: 'veh-1',
  filledBy: 'user-1',
  startedAt: '2026-06-12T12:00:00Z',
  status: 'completed',
  axleConfigSnapshot: simpleAxleConfig,
  stepsCountSnapshot: 0,
};

function makeInspectionsChain(returnValue: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(returnValue),
  };
}

function makeResponsesChain(returnValue: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn((_column: string, values: string[]) => {
      if (
        returnValue
        && typeof returnValue === 'object'
        && 'data' in returnValue
        && Array.isArray((returnValue).data)
      ) {
        return Promise.resolve({
          ...(returnValue as { data: Array<{ inspection_id: string }> }),
          data: (returnValue as { data: Array<{ inspection_id: string }> }).data.filter(row => values.includes(row.inspection_id)),
        });
      }
      return Promise.resolve(returnValue);
    }),
  };
}

function makeResponseRow(inspectionId: string, positionCode: string, status: 'conforme' | 'nao_conforme' = 'conforme') {
  return {
    id: `${inspectionId}-${positionCode}`,
    inspection_id: inspectionId,
    tire_id: null,
    position_code: positionCode,
    position_label: positionCode,
    dot: null,
    fire_marking: null,
    manufacturer: 'Michelin',
    brand: 'X Line',
    photo_url: `https://storage.example.com/${inspectionId}/${positionCode}.jpg`,
    photo_timestamp: '2026-06-12T12:01:00Z',
    status,
    observation: null,
    responded_at: '2026-06-12T12:02:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchTireInspectionComparison', () => {
  it('retorna 3 fotos por posição, ordenadas da atual para a mais antiga', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tire_inspections') {
        return makeInspectionsChain({
          data: [
            { id: 'insp-current', started_at: '2026-06-12T12:00:00Z', completed_at: '2026-06-12T12:10:00Z' },
            { id: 'insp-prev-1', started_at: '2026-06-10T12:00:00Z', completed_at: '2026-06-10T12:10:00Z' },
            { id: 'insp-prev-2', started_at: '2026-06-08T12:00:00Z', completed_at: '2026-06-08T12:10:00Z' },
          ],
          error: null,
        });
      }
      return makeResponsesChain({
        data: [
          makeResponseRow('insp-prev-2', 'E1'),
          makeResponseRow('insp-prev-1', 'E1', 'nao_conforme'),
          makeResponseRow('insp-current', 'E1'),
          makeResponseRow('insp-prev-2', 'D1'),
          makeResponseRow('insp-prev-1', 'D1'),
          makeResponseRow('insp-current', 'D1', 'nao_conforme'),
        ],
        error: null,
      });
    });

    const result = await fetchTireInspectionComparison('veh-1', currentInspection);

    expect(result).toHaveLength(2);
    expect(result[0].positionCode).toBe('E1');
    expect(result[0].photos.map(photo => photo.inspectionId)).toEqual(['insp-current', 'insp-prev-1', 'insp-prev-2']);
    expect(result[0].photos.map(photo => photo.isCurrent)).toEqual([true, false, false]);
    expect(result[1].positionCode).toBe('D1');
    expect(result[1].photos).toHaveLength(3);
  });

  it('retorna apenas a foto atual quando não há inspeções anteriores', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tire_inspections') {
        return makeInspectionsChain({
          data: [
            { id: 'insp-current', started_at: '2026-06-12T12:00:00Z', completed_at: '2026-06-12T12:10:00Z' },
          ],
          error: null,
        });
      }
      return makeResponsesChain({
        data: [makeResponseRow('insp-current', 'E1'), makeResponseRow('insp-current', 'D1')],
        error: null,
      });
    });

    const result = await fetchTireInspectionComparison('veh-1', currentInspection);

    expect(result).toHaveLength(2);
    expect(result.every(comparison => comparison.photos.length === 1)).toBe(true);
    expect(result.every(comparison => comparison.photos[0].isCurrent)).toBe(true);
  });

  it('omite posições sem foto e mantém posição presente só na inspeção atual', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tire_inspections') {
        return makeInspectionsChain({
          data: [
            { id: 'insp-current', started_at: '2026-06-12T12:00:00Z', completed_at: '2026-06-12T12:10:00Z' },
            { id: 'insp-prev-1', started_at: '2026-06-10T12:00:00Z', completed_at: '2026-06-10T12:10:00Z' },
          ],
          error: null,
        });
      }
      return makeResponsesChain({
        data: [makeResponseRow('insp-current', 'E1')],
        error: null,
      });
    });

    const result = await fetchTireInspectionComparison('veh-1', currentInspection);

    expect(result).toHaveLength(1);
    expect(result[0].positionCode).toBe('E1');
    expect(result[0].photos).toHaveLength(1);
    expect(result[0].photos[0].isCurrent).toBe(true);
  });

  it('ranqueia inspeções retomadas pela data efetiva de conclusão', async () => {
    const resumedInspection: TireInspection = {
      ...currentInspection,
      id: 'A',
      startedAt: '2026-06-08T22:41:00Z',
    };
    const laterStartedInspection: TireInspection = {
      ...currentInspection,
      id: 'C',
      startedAt: '2026-06-08T23:05:00Z',
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tire_inspections') {
        return makeInspectionsChain({
          data: [
            { id: 'A', started_at: '2026-06-08T22:41:00Z', completed_at: '2026-06-12T22:10:00Z' },
            { id: 'C', started_at: '2026-06-08T23:05:00Z', completed_at: '2026-06-08T23:07:00Z' },
          ],
          error: null,
        });
      }
      return makeResponsesChain({
        data: [
          makeResponseRow('A', 'E1'),
          makeResponseRow('C', 'E1'),
        ],
        error: null,
      });
    });

    const resultA = await fetchTireInspectionComparison('veh-1', resumedInspection);

    expect(resultA).toHaveLength(1);
    expect(resultA[0].photos.map(photo => photo.inspectionId)).toEqual(['A', 'C']);
    expect(resultA[0].photos.map(photo => photo.isCurrent)).toEqual([true, false]);

    const resultC = await fetchTireInspectionComparison('veh-1', laterStartedInspection);

    expect(resultC).toHaveLength(1);
    expect(resultC[0].photos.map(photo => photo.inspectionId)).toEqual(['C']);
    expect(resultC[0].photos.map(photo => photo.isCurrent)).toEqual([true]);
  });
});
