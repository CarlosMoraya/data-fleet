/**
 * budgetSystems.ts — Single Source of Truth for budget item systems.
 *
 * Centralizes the official system list, keyword-based inference,
 * and normalization logic used by OCR, mappers, UI and persistence.
 */

// ─── Official list ────────────────────────────────────────────────────────────

export const OTHER_BUDGET_SYSTEM = 'Outros' as const;

export const BUDGET_SYSTEM_OPTIONS: readonly string[] = [
  'Sistema de Freio',
  'Motor',
  'Suspensão',
  'Transmissão',
  'Sistema Elétrico',
  'Arrefecimento',
  'Direção',
  'Ar Condicionado',
  'Pneus e Rodas',
  'Sistema de Combustível',
  'Carroceria',
  'Mão de Obra',
  OTHER_BUDGET_SYSTEM,
] as const;

// ─── Keyword patterns for inference ───────────────────────────────────────────

const SYSTEM_PATTERNS: readonly [RegExp, string][] = [
  [/freio|pastilha|disco|lonas?|tambor|abs/i, 'Sistema de Freio'],
  [/motor|cabeçote|virabrequim|biela|pistão|válvula|filtro de óleo/i, 'Motor'],
  [/suspensão|amortecedor|mola|pivô|bandeja|barra estabilizadora/i, 'Suspensão'],
  [/câmbio|embreagem|transmissão|caixa de câmbio/i, 'Transmissão'],
  [/elétric|alternador|bateria|motor de partida|fusível|relé/i, 'Sistema Elétrico'],
  [/arrefecimento|radiador|termostato|bomba d[ae] água|ventoinha/i, 'Arrefecimento'],
  [/direção|caixa de direção|bomba hidráulica|terminal|bieleta/i, 'Direção'],
  [/ar.condicionado|compressor|evaporador|condensador|gás/i, 'Ar Condicionado'],
  [/pneu|rodas?|aro|alinhamento|balanceamento/i, 'Pneus e Rodas'],
  [/combustível|injetor|bico|bomba de combustível|filtro de combustível/i, 'Sistema de Combustível'],
  [/carroceria|lataria|funilaria|pintura|para.choque|espelho/i, 'Carroceria'],
  [/mão.de.obra|revisão|inspeção|troca de óleo|lubrificação/i, 'Mão de Obra'],
] as const;

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns true when `system` matches one of the official options. */
export function isKnownBudgetSystem(system: string | null | undefined): boolean {
  if (!system) return false;
  return BUDGET_SYSTEM_OPTIONS.includes(system);
}

/**
 * Returns the canonical system name.
 * Known values are kept as-is; empty / null / unknown values become `Outros`.
 */
export function normalizeBudgetSystem(system: string | null | undefined): string {
  if (isKnownBudgetSystem(system)) return system;
  return OTHER_BUDGET_SYSTEM;
}

/**
 * Infers the system from an item name using keyword patterns.
 * Falls back to `Outros` when no pattern matches.
 */
export function inferBudgetSystem(itemName: string): string {
  for (const [pattern, label] of SYSTEM_PATTERNS) {
    if (pattern.test(itemName)) return label;
  }
  return OTHER_BUDGET_SYSTEM;
}