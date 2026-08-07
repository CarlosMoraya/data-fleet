import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

import { getVehicleOpenTreatment } from './vehicleOpenTreatmentService';

function chainQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string) => (...args: unknown[]) => { calls.push({ method, args }); return query; };
  query.select = record('select');
  query.eq = record('eq');
  query.in = record('in');
  query.not = record('not');
  query.order = record('order');
  query.limit = record('limit');
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  query.__calls = calls;
  return query;
}

describe('getVehicleOpenTreatment', () => {
  let openPlansQuery: ReturnType<typeof chainQuery>;
  let allPlansQuery: ReturnType<typeof chainQuery>;
  let schedulesQuery: ReturnType<typeof chainQuery>;

  beforeEach(() => {
    fromMock.mockReset();
    openPlansQuery = chainQuery({ data: [], error: null });
    allPlansQuery = chainQuery({ data: [], error: null });
    schedulesQuery = chainQuery({ data: [], error: null });

    let actionPlansCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'action_plans') {
        actionPlansCalls += 1;
        return actionPlansCalls === 1 ? openPlansQuery : allPlansQuery;
      }
      if (table === 'workshop_schedules') return schedulesQuery;
      throw new Error(`unexpected table ${table}`);
    });
  });

  it('mapeia planos e agendamentos para camelCase', async () => {
    openPlansQuery = chainQuery({
      data: [
        {
          id: 'plan-1',
          name: 'Plano A',
          suggested_action: 'Trocar pastilha',
          status: 'pending',
          due_date: '2026-08-10',
          responsible_profile: { name: 'Ana' },
        },
      ],
      error: null,
    });
    schedulesQuery = chainQuery({
      data: [{ id: 'sched-1', scheduled_date: '2026-08-12', workshops: { name: 'Oficina Central' } }],
      error: null,
    });
    let actionPlansCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'action_plans') {
        actionPlansCalls += 1;
        return actionPlansCalls === 1 ? openPlansQuery : allPlansQuery;
      }
      return schedulesQuery;
    });

    const result = await getVehicleOpenTreatment('vehicle-1');

    expect(result.actionPlans).toEqual([
      { id: 'plan-1', name: 'Plano A', suggestedAction: 'Trocar pastilha', status: 'pending', dueDate: '2026-08-10', responsibleName: 'Ana' },
    ]);
    expect(result.schedules).toEqual([
      { id: 'sched-1', scheduledDate: '2026-08-12', workshopName: 'Oficina Central' },
    ]);
  });

  it('retorna listas vazias quando não há planos nem agendamentos', async () => {
    const result = await getVehicleOpenTreatment('vehicle-1');
    expect(result).toEqual({ actionPlans: [], schedules: [], ticketPlanIds: [] });
  });

  it('filtra action_plans pelos três status inconclusivos e workshop_schedules por scheduled', async () => {
    await getVehicleOpenTreatment('vehicle-1');

    const openPlansCalls = (openPlansQuery as unknown as { __calls: { method: string; args: unknown[] }[] }).__calls;
    const inCall = openPlansCalls.find((c) => c.method === 'in');
    expect(inCall?.args).toEqual(['status', ['pending', 'in_progress', 'awaiting_conclusion']]);

    const scheduleCalls = (schedulesQuery as unknown as { __calls: { method: string; args: unknown[] }[] }).__calls;
    const eqStatusCall = scheduleCalls.find((c) => c.method === 'eq' && c.args[0] === 'status');
    expect(eqStatusCall?.args).toEqual(['status', 'scheduled']);
  });

  it('rejeita com a mensagem do erro do Supabase na primeira consulta', async () => {
    openPlansQuery = chainQuery({ data: null, error: new Error('falha ao buscar planos') });
    let actionPlansCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'action_plans') {
        actionPlansCalls += 1;
        return actionPlansCalls === 1 ? openPlansQuery : allPlansQuery;
      }
      return schedulesQuery;
    });

    await expect(getVehicleOpenTreatment('vehicle-1')).rejects.toThrow('falha ao buscar planos');
  });
});
