import { validateChecklistOdometerKm } from './checklistKmValidation';

export interface OdometerToleranceInput {
  rawValue: string;
  lastValidKm: number | null;
  lastReadingAt: string | null;
  initialKm: number | null;
  tolerancePerDay: number | null;
  dayInterval: number | null;
  now?: Date;
  /**
   * Forwarded to `validateChecklistOdometerKm`. When true, equal values are
   * rejected (checklist context). Default `false` keeps existing behavior.
   */
  mustExceed?: boolean;
}

export type OdometerToleranceResult =
  | { ok: false; message: string }
  | { ok: true; value: number; requiresPhoto: false }
  | { ok: true; value: number; requiresPhoto: true; expectedMaxKm: number; exceededBy: number };

export function evaluateOdometerTolerance(input: OdometerToleranceInput): OdometerToleranceResult {
  void input.dayInterval;
  const validation = validateChecklistOdometerKm({
    rawValue: input.rawValue,
    referenceKm: input.lastValidKm ?? input.initialKm ?? null,
    mustExceed: input.mustExceed,
  });

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const parsed = validation.value;
  if (input.lastValidKm === null || input.lastReadingAt === null || input.tolerancePerDay == null) {
    return { ok: true, value: parsed, requiresPhoto: false };
  }

  const now = input.now ?? new Date();
  const days = Math.max(1, Math.ceil((now.getTime() - new Date(input.lastReadingAt).getTime()) / 86400000));
  const expectedMaxKm = input.lastValidKm + input.tolerancePerDay * days;

  if (parsed <= expectedMaxKm) {
    return { ok: true, value: parsed, requiresPhoto: false };
  }

  return {
    ok: true,
    value: parsed,
    requiresPhoto: true,
    expectedMaxKm,
    exceededBy: parsed - expectedMaxKm,
  };
}
