import type { BudgetStatus, MaintenanceStatus } from '../types/maintenance';

export const PART_PHOTO_LIMIT = 10;
export const WORKSHOP_FILLABLE_STATUSES: MaintenanceStatus[] = ['Aguardando orçamento', 'Serviço em execução'];

export function canWorkshopFillOrder(status: MaintenanceStatus): boolean {
  return WORKSHOP_FILLABLE_STATUSES.includes(status);
}

export function canAddMorePartPhotos(currentCount: number): boolean {
  return currentCount < PART_PHOTO_LIMIT;
}

export function remainingPartPhotoSlots(currentCount: number): number {
  return Math.max(0, PART_PHOTO_LIMIT - currentCount);
}


/**
 * A oficina pode iniciar o serviço por conta própria quando o orçamento já
 * foi aprovado e a OS ainda não saiu de 'Orçamento aprovado'.
 */
export function canWorkshopStartService(
  status: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): boolean {
  return status === 'Orçamento aprovado' && budgetStatus === 'aprovado';
}
