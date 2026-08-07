import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

import { getFleetTicketSlaSettings, saveFleetTicketSlaSettings } from './fleetTicketSlaSettingsService';

function queryFor<T>(result: { data: T; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.upsert = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.single = vi.fn(() => Promise.resolve(result));
  return query;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe('getFleetTicketSlaSettings', () => {
  it('retorna os padrões 24/72 quando não há linha no banco', async () => {
    fromMock.mockReturnValue(queryFor({ data: null, error: null }));
    const settings = await getFleetTicketSlaSettings('client-1');
    expect(settings).toEqual({ clientId: 'client-1', openSlaHours: 24, assignedSlaHours: 72 });
  });

  it('propaga o erro do Supabase', async () => {
    fromMock.mockReturnValue(queryFor({ data: null, error: new Error('boom') }));
    await expect(getFleetTicketSlaSettings('client-1')).rejects.toThrow('boom');
  });
});

describe('saveFleetTicketSlaSettings', () => {
  it('rejeita openSlaHours fora da faixa sem chamar supabase.from', async () => {
    await expect(
      saveFleetTicketSlaSettings({ clientId: 'c1', openSlaHours: 0, assignedSlaHours: 72 }, 'user-1'),
    ).rejects.toThrow('Informe um SLA entre 1 e 8760 horas.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejeita assignedSlaHours fora da faixa', async () => {
    await expect(
      saveFleetTicketSlaSettings({ clientId: 'c1', openSlaHours: 24, assignedSlaHours: 9000 }, 'user-1'),
    ).rejects.toThrow('Informe um SLA entre 1 e 8760 horas.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejeita valores não inteiros', async () => {
    await expect(
      saveFleetTicketSlaSettings({ clientId: 'c1', openSlaHours: 12.5, assignedSlaHours: 72 }, 'user-1'),
    ).rejects.toThrow('Informe um SLA entre 1 e 8760 horas.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('salva valores válidos com updated_by e retorna o objeto mapeado', async () => {
    const query = queryFor({
      data: {
        client_id: 'c1',
        open_sla_hours: 12,
        assigned_sla_hours: 48,
        updated_by: 'user-1',
        updated_at: '2026-08-07T10:00:00Z',
      },
      error: null,
    });
    fromMock.mockReturnValue(query);

    const result = await saveFleetTicketSlaSettings(
      { clientId: 'c1', openSlaHours: 12, assignedSlaHours: 48 },
      'user-1',
    );

    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 'c1',
      open_sla_hours: 12,
      assigned_sla_hours: 48,
      updated_by: 'user-1',
    }));
    expect(result).toEqual({
      clientId: 'c1',
      openSlaHours: 12,
      assignedSlaHours: 48,
      updatedBy: 'user-1',
      updatedAt: '2026-08-07T10:00:00Z',
    });
  });
});
