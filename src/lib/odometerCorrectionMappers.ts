import type { OdometerReading } from '../types/odometerCorrection';

export function mapOdometerReadingRow(row: Record<string, unknown>): OdometerReading {
  return {
    checklistId: String(row.checklist_id),
    vehicleId: String(row.vehicle_id),
    clientId: String(row.client_id),
    readingAt: row.reading_at ? String(row.reading_at) : null,
    originalKm: Number(row.original_km),
    effectiveKm: Number(row.effective_km),
    isCorrected: Boolean(row.is_corrected),
    correctionReason: row.correction_reason ? String(row.correction_reason) : null,
    correctedBy: row.corrected_by ? String(row.corrected_by) : null,
    correctedAt: row.corrected_at ? String(row.corrected_at) : null,
    sourceContext: row.source_context ? String(row.source_context) : null,
    hasEvidence: Boolean(row.has_evidence),
  };
}
