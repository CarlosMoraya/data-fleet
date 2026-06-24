import { describe, it, expect } from 'vitest';

import { resolveNextRevision, classifyStatus } from './warrantyRevisionResolver';

import type { WarrantyRevisionEvent } from '../types/warrantyRevision';

function makeEvent(over: Partial<WarrantyRevisionEvent>): WarrantyRevisionEvent {
  return {
    id: over.id ?? 'ev-1',
    assignmentId: over.assignmentId ?? 'asg-1',
    clientId: over.clientId ?? 'cli-1',
    vehicleId: over.vehicleId ?? 'veh-1',
    planItemId: over.planItemId ?? null,
    sequence: over.sequence ?? 1,
    label: over.label ?? '1ª revisão',
    targetKm: over.targetKm ?? 10000,
    targetDate: over.targetDate ?? null,
    status: over.status ?? 'pending',
    executedKm: over.executedKm ?? null,
    executedDate: over.executedDate ?? null,
    maintenanceOrderId: over.maintenanceOrderId ?? null,
    evidenceUrl: over.evidenceUrl ?? null,
    notes: over.notes ?? null,
    createdAt: over.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: over.updatedAt ?? '2026-01-01T00:00:00Z',
  };
}

describe('resolveNextRevision', () => {
  it('precedence: warranty active with pending event uses warranty regime even with kmInterval', () => {
    const result = resolveNextRevision({
      currentKm: 5000,
      today: '2026-06-22',
      warrantyActive: true,
      pendingEvents: [makeEvent({ sequence: 1, targetKm: 10000 })],
      lastRevisionKm: 20000,
      kmInterval: 10000,
    });
    expect(result.regime).toBe('warranty');
    expect(result.nextRevisionKm).toBe(10000);
  });

  it('aguardando_proxima: warranty active, no pending events', () => {
    const result = resolveNextRevision({
      currentKm: 5000,
      today: '2026-06-22',
      warrantyActive: true,
      pendingEvents: [],
      lastRevisionKm: null,
      kmInterval: 10000,
    });
    expect(result.regime).toBe('warranty');
    expect(result.status).toBe('aguardando_proxima');
    expect(result.nextRevisionKm).toBeNull();
  });

  it('preventive: no warranty, kmInterval=10000, lastRevisionKm=20000, currentKm=25000', () => {
    const result = resolveNextRevision({
      currentKm: 25000,
      today: '2026-06-22',
      warrantyActive: false,
      pendingEvents: [],
      lastRevisionKm: 20000,
      kmInterval: 10000,
    });
    expect(result.regime).toBe('preventive');
    expect(result.nextRevisionKm).toBe(30000);
    expect(result.status).toBe('em_dia');
  });

  it('none: no warranty and no kmInterval', () => {
    const result = resolveNextRevision({
      currentKm: 1000,
      today: '2026-06-22',
      warrantyActive: false,
      pendingEvents: [],
      lastRevisionKm: null,
      kmInterval: null,
    });
    expect(result.regime).toBe('none');
    expect(result.nextRevisionKm).toBeNull();
    expect(result.status).toBe('em_dia');
  });

  it('picks the event with the lowest sequence', () => {
    const result = resolveNextRevision({
      currentKm: 5000,
      today: '2026-06-22',
      warrantyActive: true,
      pendingEvents: [
        makeEvent({ id: 'a', sequence: 3, targetKm: 30000 }),
        makeEvent({ id: 'b', sequence: 1, targetKm: 10000 }),
        makeEvent({ id: 'c', sequence: 2, targetKm: 20000 }),
      ],
      lastRevisionKm: null,
      kmInterval: null,
    });
    expect(result.nextRevisionKm).toBe(10000);
  });
});

describe('classifyStatus', () => {
  it('vencida por KM', () => {
    expect(classifyStatus(12000, '2026-06-22', 10000, 0, null, 0)).toBe('vencida');
  });

  it('vencida por data (today depois de targetDate + daysTolerance)', () => {
    expect(classifyStatus(1000, '2026-06-25', 100000, 0, '2026-06-22', 2)).toBe('vencida');
  });

  it('a_vencer por KM na janela de tolerância', () => {
    expect(classifyStatus(9500, '2026-06-22', 10000, 1000, null, 0)).toBe('a_vencer');
  });

  it('a_vencer por data (faltam <= daysTolerance)', () => {
    // today 2026-06-20, target 2026-06-22, tolerance 5 → faltam 2 dias <= 5
    expect(classifyStatus(1000, '2026-06-20', 100000, 0, '2026-06-22', 5)).toBe('a_vencer');
  });

  it('em_dia quando bem abaixo do alvo', () => {
    expect(classifyStatus(1000, '2026-06-22', 10000, 1000, null, 0)).toBe('em_dia');
  });

  it('em_dia por data quando fora da janela', () => {
    // today 2026-06-01, target 2026-06-22, tolerance 5 → faltam 21 dias > 5
    expect(classifyStatus(1000, '2026-06-01', 100000, 0, '2026-06-22', 5)).toBe('em_dia');
  });

  it('currentKm=null não marca vencida por KM', () => {
    expect(classifyStatus(null, '2026-06-22', 10000, 0, null, 0)).toBe('em_dia');
  });

  it('currentKm=null ainda classifica por data', () => {
    expect(classifyStatus(null, '2026-06-25', 100000, 0, '2026-06-22', 0)).toBe('vencida');
  });
});