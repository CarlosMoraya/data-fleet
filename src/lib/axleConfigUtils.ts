import { AxleType, RodagemType, AxleConfigEntry } from '../types';

// ─── Slots consumed per axle type ─────────────────────────────────────────────

export function getPhysicalAxles(type: AxleType): number {
  if (type === 'duplo' || type === 'duplo_tandem') return 2;
  if (type === 'triplo_tandem') return 3;
  return 1; // direcional | simples | elevacao
}

// ─── Available options per position ───────────────────────────────────────────

export function getAvailableAxleTypes(remainingSlots: number, isFirst: boolean): AxleType[] {
  if (isFirst) return ['direcional'];
  const types: AxleType[] = ['direcional', 'simples', 'elevacao'];
  if (remainingSlots >= 2) types.push('duplo', 'duplo_tandem');
  if (remainingSlots >= 3) types.push('triplo_tandem');
  return types;
}

export function getAvailableRodagem(isFirst: boolean): RodagemType[] {
  if (isFirst) return ['simples', 'dupla']; // Primeiro eixo: sem rodagem tripla
  return ['simples', 'dupla', 'tripla'];
}

// ─── Tire count calculation ────────────────────────────────────────────────────

export function tiresPerPhysicalAxle(rodagem: RodagemType): number {
  if (rodagem === 'dupla') return 4;
  if (rodagem === 'tripla') return 6;
  return 2; // simples
}

export function calculateTotalTires(entries: AxleConfigEntry[], stepsCount: number): number {
  const axleTires = entries.reduce((sum, entry) => {
    return sum + entry.physicalAxles * tiresPerPhysicalAxle(entry.rodagem);
  }, 0);
  return axleTires + stepsCount;
}

// ─── Config completeness ───────────────────────────────────────────────────────

export function totalPhysicalAxles(entries: AxleConfigEntry[]): number {
  return entries.reduce((sum, e) => sum + e.physicalAxles, 0);
}

export function isConfigComplete(entries: AxleConfigEntry[], targetAxles: number): boolean {
  return totalPhysicalAxles(entries) === targetAxles;
}

// ─── Label helpers ─────────────────────────────────────────────────────────────

export const AXLE_TYPE_LABELS: Record<AxleType, string> = {
  direcional: 'Direcional',
  simples: 'Simples',
  duplo: 'Duplo',
  duplo_tandem: 'Duplo Tandem',
  triplo_tandem: 'Triplo Tandem',
  elevacao: 'Elevação',
};

export const RODAGEM_LABELS: Record<RodagemType, string> = {
  simples: 'Simples (1 pneu/lado)',
  dupla: 'Dupla (2 pneus/lado)',
  tripla: 'Tripla (3 pneus/lado)',
};
