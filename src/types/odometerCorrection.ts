export interface OdometerReading {
  checklistId: string;
  vehicleId: string;
  clientId: string;
  readingAt: string | null;
  originalKm: number;
  effectiveKm: number;
  isCorrected: boolean;
  correctionReason: string | null;
  correctedBy: string | null;
  correctedAt: string | null;
  sourceContext: string | null;
  hasEvidence: boolean;
}

export interface OdometerCorrectionInput {
  checklistId: string;
  correctedKm: number;
  reason: string;
}
