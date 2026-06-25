import type { MaintenanceStatus } from '../types/maintenance';

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
