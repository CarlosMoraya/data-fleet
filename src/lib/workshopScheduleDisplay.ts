import type { WorkshopScheduleStatus } from '../types';

export function formatScheduleDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export const SCHEDULE_STATUS_LABELS: Record<WorkshopScheduleStatus, string> = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const SCHEDULE_STATUS_BADGE_CLASS: Record<WorkshopScheduleStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
};
