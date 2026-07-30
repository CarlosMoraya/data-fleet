import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock, uploadMock, signedUrlMock, invokeMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  uploadMock: vi.fn(),
  signedUrlMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: rpcMock, from: fromMock },
}));

vi.mock('../lib/storageHelpers', () => ({
  uploadFleetTicketAttachment: uploadMock,
  getFleetTicketAttachmentSignedUrl: signedUrlMock,
}));

vi.mock('../lib/invokeEdgeFn', () => ({ invokeEdgeFunction: invokeMock }));

import {
  classifyFleetTicket,
  createSosTicket,
  getFleetTicketAttachmentUrls,
  listFleetTickets,
} from './fleetTicketService';

function queryFor<T>(result: { data: T; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.single = vi.fn(() => Promise.resolve(result));
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const ticketRow = {
  id: 'ticket-1',
  client_id: 'client-1',
  source: 'sos',
  opened_by: 'driver-1',
  opened_by_role: 'Driver',
  opened_by_name_snapshot: 'João',
  driver_id: 'driver-1',
  driver_name_snapshot: 'João',
  vehicle_id: 'vehicle-1',
  vehicle_license_plate_snapshot: 'ABC1D23',
  sos_type: 'breakdown',
  title: 'S.O.S. — Veículo enguiçado',
  description: 'Falha',
  criticality: 'critical',
  status: 'open',
  attachment_paths: [],
  created_at: '2026-07-29T10:00:00Z',
  updated_at: '2026-07-29T10:00:00Z',
};

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  uploadMock.mockReset();
  signedUrlMock.mockReset();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({});
});

describe('createSosTicket', () => {
  const input = {
    clientId: 'client-1',
    vehicleId: 'vehicle-1',
    sosType: 'breakdown' as const,
    description: 'Falha no motor',
    locationText: '',
    latitude: -23.5,
    longitude: -46.6,
    locationStatus: 'captured' as const,
    files: [new File([new Uint8Array([1])], 'photo.pdf', { type: 'application/pdf' })],
  };

  it('calls the create RPC before uploading and registers uploaded paths', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: 'ticket-1', error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    uploadMock.mockResolvedValue('client-1/fleet-tickets/ticket-1/file.pdf');

    const result = await createSosTicket(input);

    expect(rpcMock.mock.calls[0][0]).toBe('create_sos_ticket');
    expect(uploadMock).toHaveBeenCalledWith('client-1', 'ticket-1', input.files[0]);
    expect(rpcMock.mock.calls[1][0]).toBe('append_fleet_ticket_attachments');
    expect(invokeMock).toHaveBeenCalledWith('notify-fleet-ticket-telegram', {
      action: 'ticket', ticketId: 'ticket-1', reason: 'sos_created',
    });
    expect(result).toEqual({ ticketId: 'ticket-1', telegramWarning: undefined, uploadWarnings: [] });
  });

  it('keeps the ticket and returns a warning when upload fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'ticket-1', error: null });
    uploadMock.mockRejectedValue(new Error('Arquivo inválido'));

    const result = await createSosTicket({ ...input, files: [input.files[0]] });

    expect(result.ticketId).toBe('ticket-1');
    expect(result.uploadWarnings).toEqual(['Arquivo inválido']);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the ticket when Telegram notification fails', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'ticket-1', error: null });
    invokeMock.mockRejectedValue(new Error('Telegram indisponível'));

    const result = await createSosTicket({ ...input, files: [] });

    expect(result.ticketId).toBe('ticket-1');
    expect(result.telegramWarning).toBe('Telegram indisponível');
  });
});

describe('classifyFleetTicket', () => {
  it('notifies Telegram after critical classification', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await classifyFleetTicket('ticket-1', 'critical');

    expect(invokeMock).toHaveBeenCalledWith('notify-fleet-ticket-telegram', {
      action: 'ticket', ticketId: 'ticket-1', reason: 'critical_classified',
    });
  });

  it('does not notify Telegram for medium classification', async () => {
    rpcMock.mockResolvedValue({ error: null });

    await classifyFleetTicket('ticket-1', 'medium');

    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('listFleetTickets', () => {
  it('maps Supabase rows', async () => {
    fromMock.mockReturnValue({ select: vi.fn(() => queryFor({ data: [ticketRow], error: null })) });

    const result = await listFleetTickets('client-1');

    expect(result).toHaveLength(1);
    expect(result[0].vehicleLicensePlateSnapshot).toBe('ABC1D23');
    expect(result[0].source).toBe('sos');
  });
});

describe('getFleetTicketAttachmentUrls', () => {
  it('ignores individual signed URL failures', async () => {
    signedUrlMock
      .mockResolvedValueOnce('https://signed/one')
      .mockRejectedValueOnce(new Error('not found'));

    await expect(getFleetTicketAttachmentUrls(['one', 'two'])).resolves.toEqual({ one: 'https://signed/one' });
  });
});
