import type { OdometerReading } from '../types/odometerCorrection';

export function mapOdometerReadingRow(row: Record<string, unknown>): OdometerReading {
  type StrVal = string | number | boolean | null | undefined;
  const r = row as Record<string, StrVal>;
  return {
    checklistId: String(r.checklist_id),
    vehicleId: String(r.vehicle_id),
    clientId: String(r.client_id),
    readingAt: r.reading_at ? String(r.reading_at) : null,
    originalKm: Number(r.original_km),
    effectiveKm: Number(r.effective_km),
    isCorrected: Boolean(r.is_corrected),
    correctionReason: r.correction_reason ? String(r.correction_reason) : null,
    correctedBy: r.corrected_by ? String(r.corrected_by) : null,
    correctedAt: r.corrected_at ? String(r.corrected_at) : null,
    sourceContext: r.source_context ? String(r.source_context) : null,
    hasEvidence: Boolean(r.has_evidence),
  };
}
