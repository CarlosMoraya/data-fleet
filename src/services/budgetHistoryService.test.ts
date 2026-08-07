import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { listReviewedBudgets } from './budgetHistoryService';

import type { MaintenanceOrderRow } from '../lib/maintenanceMappers';

function makeRow(over: Partial<MaintenanceOrderRow> = {}): MaintenanceOrderRow {
  return {
    id: 'order-1',
    client_id: 'c1',
    vehicle_id: 'vehicle-1',
    workshop_id: 'workshop-1',
    os_number: 'OS-001',
    entry_date: '2026-07-01',
    expected_exit_date: null,
    actual_exit_date: null,
    type: 'Corretiva',
    status: 'Orçamento aprovado',
    description: null,
    mechanic_name: null,
    estimated_cost: 0,
    approved_cost: 15896.11,
    created_by_id: 'user-1',
    notes: null,
    workshop_os_number: '31427',
    current_km: null,
    budget_pdf_url: 'https://example.com/budget.pdf',
    budget_status: 'aprovado',
    budget_discount: 0,
    budget_reviewed_by: 'user-2',
    budget_reviewed_at: '2026-08-07T10:00:00Z',
    budget_rejection_reason: null,
    cancelled_at: null,
    cancelled_by_id: null,
    warranty_revision_event_id: null,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-08-07T10:00:00Z',
    vehicles: { license_plate: 'SSB4J74', model: null, shippers: null, operational_units: null },
    workshops: { name: 'Oficina Central' },
    profiles: { name: 'João' },
    budget_reviewer: { name: 'Data Stack' },
    clients: { name: 'Cliente 1' },
    ...over,
  } as MaintenanceOrderRow;
}

function makeRejectedRow(): MaintenanceOrderRow {
  return makeRow({
    id: 'r1',
    os_number: 'OS-R1',
    budget_status: 'reprovado',
    approved_cost: null,
    budget_rejection_reason: 'Valor acima do praticado',
    budget_reviewer: { name: 'Analista Frota' },
    budget_reviewed_at: '2026-08-06T09:00:00Z',
    vehicles: { license_plate: 'XYZ9K88', model: null, shippers: null, operational_units: null },
  });
}

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeChainable(resolveValue: { data: unknown; error: unknown }, record: RecordedCall[]) {
  const thenable = {
    then(onFulfilled: ((v: { data: unknown; error: unknown }) => unknown) | undefined) {
      return Promise.resolve(resolveValue).then(onFulfilled);
    },
  };

  function buildNode(): Record<string, unknown> {
    return new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (prop === 'then') {
          return thenable.then;
        }
        return (...args: unknown[]) => {
          record.push({ method: prop, args });
          return buildNode();
        };
      },
    });
  }

  return buildNode();
}

beforeEach(() => {
  fromMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('listReviewedBudgets', () => {
  it('com clientId aplica in(eq)+eq(client_id)+order e mapeia as linhas', async () => {
    const record: RecordedCall[] = [];

    fromMock.mockImplementation((table: string) => {
      expect(table).toBe('maintenance_orders');
      return makeChainable(
        { data: [makeRow(), makeRejectedRow()], error: null },
        record,
      );
    });

    const result = await listReviewedBudgets('c1');

    const inCall = record.find(c => c.method === 'in');
    expect(inCall).toEqual({ method: 'in', args: ['budget_status', ['aprovado', 'reprovado']] });

    const eqCall = record.find(c => c.method === 'eq' && c.args[0] === 'client_id');
    expect(eqCall).toEqual({ method: 'eq', args: ['client_id', 'c1'] });

    const orderCall = record.find(c => c.method === 'order');
    expect(orderCall).toEqual({
      method: 'order',
      args: ['budget_reviewed_at', { ascending: false, nullsFirst: false }],
    });

    expect(result).toHaveLength(2);
    const approved = result[0]!;
    expect(approved.budgetReviewedBy).toBe('Data Stack');
    expect(approved.budgetReviewedAt).toBe('2026-08-07T10:00:00Z');
    expect(approved.budgetRejectionReason).toBeUndefined();

    const rejected = result[1]!;
    expect(rejected.budgetStatus).toBe('reprovado');
    expect(rejected.budgetRejectionReason).toBe('Valor acima do praticado');
  });

  it('sem clientId não aplica eq(client_id)', async () => {
    const record: RecordedCall[] = [];

    fromMock.mockImplementation(() => makeChainable({ data: [], error: null }, record));

    await listReviewedBudgets(undefined);

    expect(record.some(c => c.method === 'eq' && c.args[0] === 'client_id')).toBe(false);
  });

  it('em erro do Supabase a promessa rejeita', async () => {
    fromMock.mockImplementation(() =>
      makeChainable({ data: null, error: { message: 'boom' } }, []),
    );

    await expect(listReviewedBudgets('c1')).rejects.toEqual({ message: 'boom' });
  });
});