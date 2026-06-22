export function validateChecklistOdometerKm(input: { rawValue: string; referenceKm: number | null }) {
  const normalized = input.rawValue.trim();
  const parsed = Number.parseInt(normalized, 10);

  if (!normalized || Number.isNaN(parsed)) {
    return { ok: false as const, message: 'Informe o Km atual do veículo.' };
  }

  if (input.referenceKm !== null && parsed < input.referenceKm) {
    return {
      ok: false as const,
      message: `O Km informado (${parsed.toLocaleString('pt-BR')}) é menor que o último registrado (${input.referenceKm.toLocaleString('pt-BR')} km).`,
    };
  }

  return { ok: true as const, value: parsed };
}
