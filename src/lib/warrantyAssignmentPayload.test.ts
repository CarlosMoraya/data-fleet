import { describe, it, expect } from 'vitest';
import { buildAssignmentPayload, addMonthsToDate } from './warrantyAssignmentPayload';
import type { WarrantyRevisionPlanItem } from '../types/warrantyRevision';

function makeItem(over: Partial<WarrantyRevisionPlanItem>): WarrantyRevisionPlanItem {
  return {
    id: over.id ?? 'pi-1',
    planId: over.planId ?? 'pl-1',
    clientId: over.clientId ?? 'cli-1',
    sequence: over.sequence ?? 1,
    label: over.label ?? '1ª revisão',
    targetKm: over.targetKm ?? 10000,
    kmTolerance: over.kmTolerance ?? 0,
    monthsFromAcquisition: over.monthsFromAcquisition ?? null,
    daysTolerance: over.daysTolerance ?? 0,
    createdAt: over.createdAt ?? '2026-01-01T00:00:00Z',
  };
}

describe('addMonthsToDate', () => {
  it('soma meses preservando o dia', () => {
    expect(addMonthsToDate('2024-01-15', 10)).toBe('2024-11-15');
  });

  it('transborda para o ano seguinte', () => {
    expect(addMonthsToDate('2024-11-15', 3)).toBe('2025-02-15');
  });
});

describe('buildAssignmentPayload', () => {
  it('snapshot de target_date a partir de acquisitionDate + months', () => {
    const items = [
      makeItem({ sequence: 1, targetKm: 10000, monthsFromAcquisition: 12 }),
      makeItem({ sequence: 2, targetKm: 20000, monthsFromAcquisition: 24 }),
    ];
    const payload = buildAssignmentPayload(
      { acquisitionDate: '2024-03-10' },
      items,
      0,
      { presumeCompleted: false, setWarrantyTrue: false },
    );
    expect(payload.events[0].targetDate).toBe('2025-03-10');
    expect(payload.events[1].targetDate).toBe('2026-03-10');
  });

  it('targetDate null quando não há months ou acquisitionDate', () => {
    const items = [makeItem({ sequence: 1, targetKm: 5000, monthsFromAcquisition: null })];
    const payload = buildAssignmentPayload(
      { acquisitionDate: '2024-03-10' },
      items,
      null,
      { presumeCompleted: false, setWarrantyTrue: false },
    );
    expect(payload.events[0].targetDate).toBeNull();
  });

  it('marca presumedCompleted para eventos cujo target_km <= currentKm', () => {
    const items = [
      makeItem({ sequence: 1, targetKm: 10000 }),
      makeItem({ sequence: 2, targetKm: 20000 }),
      makeItem({ sequence: 3, targetKm: 30000 }),
    ];
    const payload = buildAssignmentPayload(
      { acquisitionDate: '2024-01-01' },
      items,
      25000,
      { presumeCompleted: true, setWarrantyTrue: false },
    );
    expect(payload.events[0].presumedCompleted).toBe(true);
    expect(payload.events[1].presumedCompleted).toBe(true);
    expect(payload.events[2].presumedCompleted).toBe(false);
  });

  it('não marca presumedCompleted quando presumeCompleted=false', () => {
    const items = [makeItem({ sequence: 1, targetKm: 10000 })];
    const payload = buildAssignmentPayload(
      { acquisitionDate: '2024-01-01' },
      items,
      50000,
      { presumeCompleted: false, setWarrantyTrue: true },
    );
    expect(payload.events[0].presumedCompleted).toBe(false);
    expect(payload.setWarrantyTrue).toBe(true);
  });

  it('propaga a flag setWarrantyTrue', () => {
    const payload = buildAssignmentPayload(
      { acquisitionDate: '2024-01-01' },
      [makeItem({ sequence: 1, targetKm: 10000 })],
      null,
      { presumeCompleted: false, setWarrantyTrue: true },
    );
    expect(payload.setWarrantyTrue).toBe(true);
  });
});