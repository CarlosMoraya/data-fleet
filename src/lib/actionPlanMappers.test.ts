import { describe, expect, it } from 'vitest';

import { actionPlanFromRow, actionPlanToRow, actionStatusLabel } from './actionPlanMappers';

import type { ActionPlanRow } from './actionPlanMappers';

const baseRow: ActionPlanRow = {
  id: 'plan-1',
  client_id: 'client-1',
  checklist_id: null,
  fleet_ticket_id: null,
  checklist_response_id: null,
  vehicle_id: null,
  reported_by: null,
  suggested_action: 'Ação',
  observed_issue: null,
  photo_url: null,
  status: 'pending',
  name: null,
  responsible_id: null,
  responsible_updated_by: null,
  responsible_updated_at: null,
  due_date: null,
  assigned_by: null,
  claimed_by: null,
  claimed_at: null,
  conclusion_evidence_url: null,
  work_order_number: null,
  completion_notes: null,
  completed_by: null,
  completed_at: null,
  latitude: null,
  longitude: null,
  created_at: '2026-08-07T00:00:00Z',
  updated_at: '2026-08-07T00:00:00Z',
};

describe('actionPlanFromRow', () => {
  it('mapeia origem checklist corretamente', () => {
    const row: ActionPlanRow = { ...baseRow, checklist_id: 'checklist-1', fleet_ticket_id: null };
    const plan = actionPlanFromRow(row);
    expect(plan.checklistId).toBe('checklist-1');
    expect(plan.fleetTicketId).toBeUndefined();
  });

  it('mapeia origem chamado corretamente com join', () => {
    const row: ActionPlanRow = {
      ...baseRow,
      checklist_id: null,
      fleet_ticket_id: 'ticket-1',
      fleet_tickets: { ticket_number: 'CH-2608-0001', title: 'Vazamento de óleo' },
    };
    const plan = actionPlanFromRow(row);
    expect(plan.fleetTicketId).toBe('ticket-1');
    expect(plan.fleetTicketNumber).toBe('CH-2608-0001');
    expect(plan.fleetTicketTitle).toBe('Vazamento de óleo');
    expect(plan.checklistId).toBeUndefined();
  });

  it('não lança quando não há join de fleet_tickets', () => {
    const row: ActionPlanRow = { ...baseRow, checklist_id: 'checklist-1' };
    const plan = actionPlanFromRow(row);
    expect(plan.fleetTicketNumber).toBeUndefined();
    expect(plan.fleetTicketTitle).toBeUndefined();
  });

  it('mantém actionStatusLabel funcionando (regressão)', () => {
    expect(actionStatusLabel('awaiting_conclusion')).toBe('Aguardando Aprovação');
  });
});

describe('actionPlanToRow', () => {
  it('emite fleet_ticket_id e não emite checklist_id quando checklistId é undefined', () => {
    const row = actionPlanToRow({ fleetTicketId: 'uuid-x', checklistId: undefined });
    expect(row.fleet_ticket_id).toBe('uuid-x');
    expect('checklist_id' in row).toBe(false);
  });
});
