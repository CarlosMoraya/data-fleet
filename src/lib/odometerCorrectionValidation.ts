export function validateOdometerCorrection(input: { rawValue: string; reason: string }):
  | { ok: true; correctedKm: number }
  | { ok: false; message: string } {
  const reason = input.reason.trim();
  const normalized = input.rawValue.trim();
  const correctedKm = Number.parseInt(normalized, 10);

  if (!reason) {
    return { ok: false, message: 'Informe o motivo da correção.' };
  }

  if (!normalized || Number.isNaN(correctedKm)) {
    return { ok: false, message: 'Informe o Km corrigido.' };
  }

  if (correctedKm < 0) {
    return { ok: false, message: 'O Km corrigido não pode ser negativo.' };
  }

  return { ok: true, correctedKm };
}
