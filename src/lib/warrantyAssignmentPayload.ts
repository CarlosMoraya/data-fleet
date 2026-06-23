import type { Vehicle } from '../types';
import type { WarrantyRevisionPlanItem } from '../types/warrantyRevision';

export interface AssignmentEventRow {
  sequence: number;
  label: string;
  targetKm: number;
  targetDate: string | null;
  presumedCompleted: boolean;
}

export interface AssignmentPayload {
  events: AssignmentEventRow[];
  setWarrantyTrue: boolean;
}

/** Soma meses a uma data ISO (YYYY-MM-DD) usando aritmética de calendário UTC. */
export function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().split('T')[0];
}

/**
 * Monta o payload de eventos materializados para um veículo a partir dos itens
 * do plano. Snapshot de `target_km` e `target_date` (aquisição + meses).
 * Marca `presumedCompleted` quando `presumeCompleted` é verdadeiro e o
 * `currentKm` ultrapassa o `target_km` do evento.
 */
export function buildAssignmentPayload(
  vehicle: Pick<Vehicle, 'acquisitionDate'>,
  items: WarrantyRevisionPlanItem[],
  currentKm: number | null,
  options: { presumeCompleted: boolean; setWarrantyTrue: boolean },
): AssignmentPayload {
  const acquisitionDate = vehicle.acquisitionDate;

  const events = items.map((item) => {
    const targetDate =
      acquisitionDate && item.monthsFromAcquisition != null
        ? addMonthsToDate(acquisitionDate, item.monthsFromAcquisition)
        : null;

    const presumedCompleted =
      options.presumeCompleted &&
      currentKm != null &&
      item.targetKm <= currentKm;

    return {
      sequence: item.sequence,
      label: item.label,
      targetKm: item.targetKm,
      targetDate,
      presumedCompleted,
    };
  });

  return {
    events,
    setWarrantyTrue: options.setWarrantyTrue,
  };
}