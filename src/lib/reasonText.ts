/**
 * Fonte única da regra de formato dos textos de justificativa do produto:
 * trim antes da medida, vazio vira null, acima do teto vira null.
 */

export function normalizeReasonText(raw: string, maxLength: number): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}
