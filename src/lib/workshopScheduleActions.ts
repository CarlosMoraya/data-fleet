import type { WorkshopSchedule, WorkshopScheduleStatus } from '../types';

export type ScheduleActionKey = 'edit' | 'complete' | 'cancel' | 'generateMaintenance' | 'delete';

export interface ScheduleActionPermissions {
  canWriteSchedules: boolean;
  canDelete: boolean;
}

export function isScheduleActionAvailable(
  action: ScheduleActionKey,
  status: WorkshopScheduleStatus,
  permissions: ScheduleActionPermissions,
): boolean {
  if (!permissions.canWriteSchedules) return false;

  switch (action) {
    case 'edit':
    case 'complete':
    case 'cancel':
      return status === 'scheduled';
    case 'generateMaintenance':
      return status !== 'cancelled';
    case 'delete':
      return permissions.canDelete && status !== 'scheduled';
  }
}

export function buildScheduleConfirmMessage(
  action: 'complete' | 'cancel' | 'delete',
  schedule: WorkshopSchedule,
): string {
  const plate = schedule.vehicleLicensePlate ?? 'sem placa';
  const workshop = schedule.workshopName ?? 'sem oficina';
  const subject = `o agendamento do veículo ${plate} na oficina ${workshop}`;

  switch (action) {
    case 'complete':
      return `Marcar como concluído ${subject}?`;
    case 'cancel':
      return `Cancelar ${subject}? Esta ação não pode ser desfeita.`;
    case 'delete':
      return `Excluir ${subject}? Esta ação não pode ser desfeita.`;
  }
}
