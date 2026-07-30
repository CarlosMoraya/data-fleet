import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, invokeMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('../lib/invokeEdgeFn', () => ({ invokeEdgeFunction: invokeMock }));

import {
  getTelegramSettings,
  saveTelegramSettings,
  sendTelegramTestMessage,
} from './telegramSettingsService';

function queryFor<T>(result: { data: T; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.upsert = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.single = vi.fn(() => Promise.resolve(result));
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const row = {
  client_id: 'client-1',
  enabled: false,
  chat_id: null,
  notify_sos: true,
  notify_critical: true,
  notify_high: false,
  updated_by: 'user-1',
  updated_at: '2026-07-29T10:00:00Z',
};

beforeEach(() => {
  fromMock.mockReset();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({});
});

describe('getTelegramSettings', () => {
  it('returns defaults when no row exists', async () => {
    fromMock.mockReturnValue({ select: vi.fn(() => queryFor({ data: null, error: null })) });

    await expect(getTelegramSettings('client-1')).resolves.toMatchObject({
      clientId: 'client-1', enabled: false, chatId: '', notifySos: true,
    });
  });
});

describe('saveTelegramSettings', () => {
  it('saves disabled settings without a chat id', async () => {
    const query = queryFor({ data: row, error: null });
    fromMock.mockReturnValue({ upsert: query.upsert });

    await saveTelegramSettings({
      clientId: 'client-1', enabled: false, chatId: '', notifySos: true, notifyCritical: true, notifyHigh: false,
    }, 'user-1');

    const payload = (query.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload).toMatchObject({ client_id: 'client-1', enabled: false, chat_id: null });
  });

  it('blocks enabled settings without a chat id', async () => {
    await expect(saveTelegramSettings({
      clientId: 'client-1', enabled: true, chatId: '  ', notifySos: true, notifyCritical: true, notifyHigh: false,
    }, 'user-1')).rejects.toThrow('chat_id');
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('sendTelegramTestMessage', () => {
  it('calls the Telegram Edge Function test action', async () => {
    await sendTelegramTestMessage('client-1');

    expect(invokeMock).toHaveBeenCalledWith('notify-fleet-ticket-telegram', {
      action: 'test', clientId: 'client-1',
    });
  });
});
