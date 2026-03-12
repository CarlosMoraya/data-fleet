// ─────────────────────────────────────────────────────────────
// Filtros de input em tempo real (aplicados no handleChange)
// Removem caracteres inválidos enquanto o usuário digita
// ─────────────────────────────────────────────────────────────

/** Somente dígitos (0-9). Usado em: year, renavam, antt */
export function filterDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Dígitos e no máximo uma vírgula (separador decimal).
 * Usado em: fipePrice, autonomy, tankCapacity, avgConsumption
 */
export function filterNumericComma(value: string): string {
  // Remove tudo que não seja dígito ou vírgula
  const cleaned = value.replace(/[^\d,]/g, '');
  // Garante no máximo uma vírgula
  const parts = cleaned.split(',');
  if (parts.length > 2) return parts[0] + ',' + parts.slice(1).join('');
  return cleaned;
}

/**
 * Letras, números, espaços, pontos e parênteses.
 * Usado em: brand, model, color, owner, coolingBrand, fuelType, tracker
 */
export function filterText(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s.()]/gu, '');
}

/**
 * Somente letras e números (sem espaços ou especiais).
 * Usado em: licensePlate, placaSemiReboque
 * Remove traços, barras, espaços — o usuário pode digitar ABC-1234, fica ABC1234
 */
export function filterPlate(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Somente letras (sem acentos), limitado a maxLength.
 * Usado em: detranUF (max 2)
 */
export function filterAlpha(value: string, maxLength?: number): string {
  const cleaned = value.replace(/[^A-Za-z]/g, '').toUpperCase();
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Letras e números apenas, limitado a maxLength.
 * Usado em: chassi (max 17)
 */
export function filterAlphanumeric(value: string, maxLength?: number): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

// ─────────────────────────────────────────────────────────────
// Normalizadores (aplicados no save, em vehicleToRow e forms)
// ─────────────────────────────────────────────────────────────

/** Trim + uppercase. Usado em: licensePlate, chassi, detranUF, brand, model */
export function normalizeUpper(value: string | undefined | null): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * Trim + primeira letra maiúscula de cada palavra.
 * Usado em: color, owner, fuelType, coolingBrand, tracker, name de usuário/cliente
 */
export function capitalizeWords(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/**
 * Converte vírgula como separador decimal para ponto e faz parseFloat.
 * "1500,50" → 1500.5 | "1500" → 1500 | "" → 0
 */
export function commaToFloat(value: string | number | undefined | null): number {
  if (value == null || value === '') return 0;
  const str = String(value).replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

/** Trim simples. Usado em: renavam, antt */
export function normalizeTrim(value: string | undefined | null): string {
  return (value ?? '').trim();
}

/** Somente dígitos, limitado a 11 caracteres. Usado em: CPF */
export function filterCPF(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/** Somente letras A-E, uppercase, max 5 chars. Usado em: categoria CNH (A, B, AB, AE, ABCDE...) */
export function filterCNHCategory(value: string): string {
  return value.replace(/[^A-Ea-e]/g, '').toUpperCase().slice(0, 5);
}
