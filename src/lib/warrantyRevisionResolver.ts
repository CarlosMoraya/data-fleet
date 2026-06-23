import type {
  WarrantyRevisionEvent,
  WarrantyRevisionStatus,
  WarrantyRegime,
} from '../types/warrantyRevision';

export interface ResolveInput {
  currentKm: number | null;
  today: string;
  warrantyActive: boolean;
  pendingEvents: WarrantyRevisionEvent[];
  lastRevisionKm: number | null;
  kmInterval: number | null;
}

export interface NextRevisionResult {
  regime: WarrantyRegime;
  nextRevisionKm: number | null;
  nextRevisionDate: string | null;
  status: WarrantyRevisionStatus;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Classifica o status de uma revisão alvo com base em KM e/ou data.
 * `currentKm = null` nunca classifica como vencida/a_vencer por KM.
 */
export function classifyStatus(
  currentKm: number | null,
  today: string,
  targetKm: number,
  kmTolerance: number,
  targetDate: string | null,
  daysTolerance: number,
): WarrantyRevisionStatus {
  // ── Vencida ──
  if (currentKm != null && currentKm > targetKm + kmTolerance) return 'vencida';
  if (targetDate) {
    const overdueOn = daysBetween(targetDate, today); // >0 se today depois de target
    if (overdueOn > daysTolerance) return 'vencida';
  }

  // ── A vencer ──
  if (currentKm != null && currentKm >= targetKm - kmTolerance) return 'a_vencer';
  if (targetDate) {
    const daysLeft = daysBetween(today, targetDate); // dias até vencer (>=0 se alvo no futuro)
    if (daysLeft >= 0 && daysLeft <= daysTolerance) return 'a_vencer';
  }

  return 'em_dia';
}

/**
 * Resolvedor único de "próxima revisão".
 * Precedência: garantia ativa (com eventos) > preventiva (km_interval) > nenhuma.
 */
export function resolveNextRevision(input: ResolveInput): NextRevisionResult {
  const { currentKm, today, warrantyActive, pendingEvents, lastRevisionKm, kmInterval } = input;

  if (warrantyActive) {
    if (pendingEvents.length > 0) {
      const event = [...pendingEvents].sort((a, b) => a.sequence - b.sequence)[0];
      const status = classifyStatus(
        currentKm,
        today,
        event.targetKm,
        0,
        event.targetDate ?? null,
        0,
      );
      return {
        regime: 'warranty',
        nextRevisionKm: event.targetKm,
        nextRevisionDate: event.targetDate ?? null,
        status,
      };
    }
    return {
      regime: 'warranty',
      nextRevisionKm: null,
      nextRevisionDate: null,
      status: 'aguardando_proxima',
    };
  }

  if (typeof kmInterval === 'number' && kmInterval > 0) {
    const targetKm = (lastRevisionKm ?? 0) + kmInterval;
    const status = classifyStatus(currentKm, today, targetKm, 0, null, 0);
    return {
      regime: 'preventive',
      nextRevisionKm: targetKm,
      nextRevisionDate: null,
      status,
    };
  }

  return {
    regime: 'none',
    nextRevisionKm: null,
    nextRevisionDate: null,
    status: 'em_dia',
  };
}