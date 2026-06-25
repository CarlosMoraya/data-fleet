import { describe, expect, it } from 'vitest';

import { canAddMorePartPhotos, canWorkshopFillOrder, PART_PHOTO_LIMIT, remainingPartPhotoSlots } from './maintenanceWorkshop';

describe('maintenanceWorkshop helpers', () => {
  it('allows Workshop only for fillable statuses', () => {
    expect(canWorkshopFillOrder('Aguardando orçamento')).toBe(true);
    expect(canWorkshopFillOrder('Serviço em execução')).toBe(true);
    expect(canWorkshopFillOrder('Aguardando aprovação')).toBe(false);
    expect(canWorkshopFillOrder('Concluído')).toBe(false);
    expect(canWorkshopFillOrder('Cancelado')).toBe(false);
    expect(canWorkshopFillOrder('Veículo retirado')).toBe(false);
    expect(canWorkshopFillOrder('Orçamento aprovado')).toBe(false);
  });

  it('enforces part photo limit', () => {
    expect(PART_PHOTO_LIMIT).toBe(10);
    expect(canAddMorePartPhotos(0)).toBe(true);
    expect(canAddMorePartPhotos(9)).toBe(true);
    expect(canAddMorePartPhotos(10)).toBe(false);
    expect(canAddMorePartPhotos(11)).toBe(false);
  });

  it('returns remaining part photo slots without going negative', () => {
    expect(remainingPartPhotoSlots(0)).toBe(10);
    expect(remainingPartPhotoSlots(9)).toBe(1);
    expect(remainingPartPhotoSlots(10)).toBe(0);
    expect(remainingPartPhotoSlots(12)).toBe(0);
  });
});
