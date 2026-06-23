import { validateChecklistOdometerKm } from './checklistKmValidation';

export function validateMaintenanceCurrentKm(input: {
  currentKm: number | null | undefined;
  referenceKm: number | null;
}) {
  if (input.currentKm === null || input.currentKm === undefined) {
    return { ok: true as const };
  }
  const result = validateChecklistOdometerKm({
    rawValue: String(input.currentKm),
    referenceKm: input.referenceKm,
  });
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}