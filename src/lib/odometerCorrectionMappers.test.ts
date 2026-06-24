import { describe, expect, it } from 'vitest';

import { mapOdometerReadingRow } from './odometerCorrectionMappers';

describe('mapOdometerReadingRow', () => {
  it('mapeia leitura corrigida', () => {
    expect(mapOdometerReadingRow({
      checklist_id: 'checklist-1',
      vehicle_id: 'vehicle-1',
      client_id: 'client-1',
      reading_at: '2026-06-22T10:00:00Z',
      original_km: '100000',
      effective_km: '10000',
      is_corrected: true,
      correction_reason: 'Erro de digitação',
      corrected_by: 'user-1',
      corrected_at: '2026-06-22T11:00:00Z',
      source_context: 'Atualização de Hodômetro',
      has_evidence: true,
    })).toEqual({
      checklistId: 'checklist-1',
      vehicleId: 'vehicle-1',
      clientId: 'client-1',
      readingAt: '2026-06-22T10:00:00Z',
      originalKm: 100000,
      effectiveKm: 10000,
      isCorrected: true,
      correctionReason: 'Erro de digitação',
      correctedBy: 'user-1',
      correctedAt: '2026-06-22T11:00:00Z',
      sourceContext: 'Atualização de Hodômetro',
      hasEvidence: true,
    });
  });

  it('mapeia leitura sem correcao', () => {
    expect(mapOdometerReadingRow({
      checklist_id: 'checklist-2',
      vehicle_id: 'vehicle-1',
      client_id: 'client-1',
      reading_at: null,
      original_km: 5000,
      effective_km: 5000,
      is_corrected: false,
      correction_reason: null,
      corrected_by: null,
      corrected_at: null,
    })).toMatchObject({
      checklistId: 'checklist-2',
      originalKm: 5000,
      effectiveKm: 5000,
      isCorrected: false,
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      sourceContext: null,
      hasEvidence: false,
    });
  });
});
