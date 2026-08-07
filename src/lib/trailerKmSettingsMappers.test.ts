import { describe, expect, it } from 'vitest';

import { trailerKmSettingsFromRow, trailerKmSettingsToRow } from './trailerKmSettingsMappers';

describe('trailerKmSettingsFromRow', () => {
  it('converte snake_case do banco para camelCase', () => {
    const result = trailerKmSettingsFromRow({
      id: 'id-1',
      client_id: 'client-1',
      trailer_km_mode: 'hubodometer',
      updated_at: '2026-07-18T00:00:00Z',
      updated_by: 'user-1',
    });

    expect(result).toEqual({
      id: 'id-1',
      clientId: 'client-1',
      trailerKmMode: 'hubodometer',
      updatedAt: '2026-07-18T00:00:00Z',
      updatedBy: 'user-1',
    });
  });

  it('mantém updatedBy null e omite updatedAt quando ausente', () => {
    const result = trailerKmSettingsFromRow({
      id: 'id-1',
      client_id: 'client-1',
      trailer_km_mode: 'coupling_accumulated',
      updated_at: null,
      updated_by: null,
    });

    expect(result.updatedAt).toBeUndefined();
    expect(result.updatedBy).toBeNull();
  });
});

describe('trailerKmSettingsToRow', () => {
  it('converte camelCase para o payload snake_case de escrita', () => {
    const result = trailerKmSettingsToRow('client-1', 'coupling_accumulated', 'user-1');

    expect(result).toEqual({
      client_id: 'client-1',
      trailer_km_mode: 'coupling_accumulated',
      updated_by: 'user-1',
    });
  });
});
