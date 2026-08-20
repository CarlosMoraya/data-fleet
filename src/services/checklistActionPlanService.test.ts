import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

import {
  getChecklistActionPlanStatuses,
  getChecklistTicketTreatments,
  markChecklistTreatedByTicket,
} from './checklistActionPlanService';

function queryFor<T>(result: { data: T; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.delete = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe('getChecklistActionPlanStatuses', () => {
  it('retorna Map vazio sem chamar o Supabase quando a lista está vazia', async () => {
    await expect(getChecklistActionPlanStatuses([])).resolves.toEqual(new Map());
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('agrupa os status por checklist', async () => {
    fromMock.mockReturnValue(queryFor({
      data: [
        { checklist_id: 'checklist-1', status: 'pending' },
        { checklist_id: 'checklist-2', status: 'completed' },
        { checklist_id: 'checklist-1', status: 'awaiting_conclusion' },
      ],
      error: null,
    }));

    const result = await getChecklistActionPlanStatuses(['checklist-1', 'checklist-2']);

    expect(result).toEqual(new Map([
      ['checklist-1', ['pending', 'awaiting_conclusion']],
      ['checklist-2', ['completed']],
    ]));
  });

  it('propaga erros do Supabase', async () => {
    fromMock.mockReturnValue(queryFor({ data: null, error: new Error('network failure') }));
    await expect(getChecklistActionPlanStatuses(['checklist-1'])).rejects.toThrow('network failure');
  });
});

describe('getChecklistTicketTreatments', () => {
  it('retorna Map vazio sem chamar o Supabase quando a lista está vazia', async () => {
    await expect(getChecklistTicketTreatments([])).resolves.toEqual(new Map());
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('mapeia a marcação e o número amigável do chamado', async () => {
    fromMock.mockReturnValue(queryFor({
      data: [{
        checklist_id: 'checklist-1',
        fleet_ticket_id: 'ticket-1',
        marked_at: '2026-08-19T14:30:00Z',
        fleet_tickets: { ticket_number: 'CHA-0042' },
      }],
      error: null,
    }));

    await expect(getChecklistTicketTreatments(['checklist-1'])).resolves.toEqual(new Map([
      ['checklist-1', {
        checklistId: 'checklist-1',
        fleetTicketId: 'ticket-1',
        fleetTicketNumber: 'CHA-0042',
        markedAt: '2026-08-19T14:30:00Z',
      }],
    ]));
  });
});

describe('markChecklistTreatedByTicket', () => {
  it('traduz o erro quando o checklist já possui plano de ação', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fromMock.mockReturnValue(queryFor({
      data: null,
      error: { code: 'P0001', message: 'CHECKLIST_ALREADY_HAS_ACTION_PLAN' },
    }));

    await expect(markChecklistTreatedByTicket({
      clientId: 'client-1',
      checklistId: 'checklist-1',
      fleetTicketId: 'ticket-1',
      markedBy: 'user-1',
    })).rejects.toThrow('Este checklist já possui plano de ação e não pode ser marcado como tratado por chamado.');
    expect(consoleError).toHaveBeenCalledWith(
      'markChecklistTreatedByTicket failed',
      expect.objectContaining({ message: 'CHECKLIST_ALREADY_HAS_ACTION_PLAN' }),
    );
    consoleError.mockRestore();
  });
});
