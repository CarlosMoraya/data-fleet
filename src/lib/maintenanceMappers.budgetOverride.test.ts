import { describe, expect, it } from 'vitest';

import { maintenanceFromRow } from './maintenanceMappers';

import type { MaintenanceOrderRow } from '../types/maintenance';

/** Helper to build a minimal maintenance order row with sensible defaults. */
function makeOrderRow(overrides: Partial<MaintenanceOrderRow> = {}): MaintenanceOrderRow {
  return {
    id: 'os-1',
    client_id: 'client-1',
    vehicle_id: 'veh-1',
    workshop_id: 'ws-1',
    os_number: 'OS-0001',
    entry_date: '2026-09-01',
    expected_exit_date: null,
    actual_exit_date: null,
    type: 'Corretiva',
    status: 'Serviço em execução',
    description: null,
    mechanic_name: null,
    estimated_cost: 0,
    approved_cost: null,
    created_by_id: 'p-1',
    notes: null,
    workshop_os_number: null,
    current_km: null,
    budget_pdf_url: null,
    budget_status: 'sem_orcamento',
    budget_discount: 0,
    budget_reviewed_by: null,
    budget_reviewed_at: null,
    budget_rejection_reason: null,
    cancelled_at: null,
    cancelled_by_id: null,
    cancellation_reason: null,
    budget_override_reason: null,
    budget_override_by_id: null,
    budget_override_at: null,
    warranty_revision_event_id: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('maintenanceFromRow — exceção de orçamento', () => {
  it('mapeia os quatro campos quando há exceção registrada', () => {
    const order = maintenanceFromRow(makeOrderRow({
      budget_override_reason: 'peça de segurança',
      budget_override_by_id: 'p-7',
      budget_override_at: '2026-09-20T12:00:00Z',
      budget_override_by: { name: 'Mariana' },
    }));

    expect(order.budgetOverrideReason).toBe('peça de segurança');
    expect(order.budgetOverrideById).toBe('p-7');
    expect(order.budgetOverrideAt).toBe('2026-09-20T12:00:00Z');
    expect(order.budgetOverrideByName).toBe('Mariana');
  });

  it('converte nulos em undefined quando não há exceção', () => {
    const order = maintenanceFromRow(makeOrderRow({
      budget_override_reason: null,
      budget_override_by_id: null,
      budget_override_at: null,
      budget_override_by: null,
    }));

    expect(order.budgetOverrideReason).toBeUndefined();
    expect(order.budgetOverrideById).toBeUndefined();
    expect(order.budgetOverrideAt).toBeUndefined();
    expect(order.budgetOverrideByName).toBeUndefined();
  });

  it('não quebra quando o embed do autor está ausente (papel Workshop)', () => {
    const order = maintenanceFromRow(makeOrderRow({
      budget_override_reason: 'urgência',
      budget_override_by_id: 'p-7',
      budget_override_at: '2026-09-20T12:00:00Z',
    }));

    expect(order.budgetOverrideByName).toBeUndefined();
    expect(order.budgetOverrideReason).toBe('urgência');
  });
});
