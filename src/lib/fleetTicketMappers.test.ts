import { describe, expect, it } from 'vitest';

import {
  fleetTicketEventFromRow,
  fleetTicketFromRow,
  telegramSettingsFromRow,
  telegramSettingsToRow,
  type FleetTicketRow,
} from './fleetTicketMappers';

function makeRow(overrides: Partial<FleetTicketRow> = {}): FleetTicketRow {
  return {
    id: 'ticket-1',
    client_id: 'client-1',
    source: 'sos',
    opened_by: 'profile-1',
    opened_by_role: 'Driver',
    opened_by_name_snapshot: 'João Silva',
    driver_id: 'driver-1',
    driver_name_snapshot: 'João Silva',
    vehicle_id: 'vehicle-1',
    vehicle_license_plate_snapshot: 'ABC1D23',
    sos_type: 'breakdown',
    title: 'S.O.S. — Veículo enguiçado',
    description: 'O veículo parou na rodovia.',
    criticality: 'critical',
    classified_by: null,
    classified_by_name_snapshot: null,
    classified_at: null,
    status: 'open',
    assigned_to: null,
    assigned_to_name_snapshot: null,
    assigned_at: null,
    resolved_by: null,
    resolved_by_name_snapshot: null,
    resolved_at: null,
    resolution_notes: null,
    latitude: -23.55,
    longitude: -46.63,
    location_status: 'captured',
    location_text: null,
    attachment_paths: ['client-1/fleet-tickets/ticket-1/photo.jpg'],
    telegram_notified_at: null,
    telegram_last_error: null,
    created_at: '2026-07-29T10:00:00Z',
    updated_at: '2026-07-29T10:00:00Z',
    ...overrides,
  };
}

describe('fleetTicketFromRow', () => {
  it('maps a complete ticket to camelCase', () => {
    const ticket = fleetTicketFromRow(makeRow());

    expect(ticket).toMatchObject({
      id: 'ticket-1',
      clientId: 'client-1',
      openedByNameSnapshot: 'João Silva',
      vehicleLicensePlateSnapshot: 'ABC1D23',
      criticality: 'critical',
      attachmentPaths: ['client-1/fleet-tickets/ticket-1/photo.jpg'],
    });
  });

  it('normalizes null attachment arrays to an empty array', () => {
    expect(fleetTicketFromRow(makeRow({ attachment_paths: null })).attachmentPaths).toEqual([]);
  });

  it('normalizes absent optional fields to undefined', () => {
    const row = makeRow();
    delete row.driver_id;
    delete row.description;
    delete row.latitude;
    delete row.location_status;

    const ticket = fleetTicketFromRow(row);
    expect(ticket.driverId).toBeUndefined();
    expect(ticket.description).toBeUndefined();
    expect(ticket.latitude).toBeUndefined();
    expect(ticket.locationStatus).toBeUndefined();
  });

  it('preserves author and driver snapshots', () => {
    const ticket = fleetTicketFromRow(makeRow({
      opened_by_name_snapshot: 'Nome histórico',
      driver_name_snapshot: 'Motorista histórico',
    }));

    expect(ticket.openedByNameSnapshot).toBe('Nome histórico');
    expect(ticket.driverNameSnapshot).toBe('Motorista histórico');
  });

  it('maps ticket number, odometer and vehicle snapshots', () => {
    const ticket = fleetTicketFromRow(makeRow({
      ticket_number: 'CH-2607-4821',
      odometer_km: '92400',
      vehicle_model_snapshot: 'Volvo FH 540',
      vehicle_owner_snapshot: 'Transportadora Beta',
      shipper_name_snapshot: 'Embarcador X',
      operational_unit_name_snapshot: 'Base Sul',
    }));

    expect(ticket).toMatchObject({
      ticketNumber: 'CH-2607-4821',
      odometerKm: 92400,
      vehicleModelSnapshot: 'Volvo FH 540',
      vehicleOwnerSnapshot: 'Transportadora Beta',
      shipperNameSnapshot: 'Embarcador X',
      operationalUnitNameSnapshot: 'Base Sul',
    });
    expect(ticket.odometerKm).toBe(92400);
  });

  it('maps a legacy ticket without the new columns to undefined fields', () => {
    const row = makeRow();
    delete row.ticket_number;
    delete row.odometer_km;
    delete row.vehicle_model_snapshot;
    delete row.vehicle_owner_snapshot;
    delete row.shipper_name_snapshot;
    delete row.operational_unit_name_snapshot;

    const ticket = fleetTicketFromRow(row);

    expect(ticket.ticketNumber).toBeUndefined();
    expect(ticket.odometerKm).toBeUndefined();
    expect(ticket.vehicleModelSnapshot).toBeUndefined();
    expect(ticket.vehicleOwnerSnapshot).toBeUndefined();
    expect(ticket.shipperNameSnapshot).toBeUndefined();
    expect(ticket.operationalUnitNameSnapshot).toBeUndefined();
  });

  it('maps odometer_km of 0 to the number 0, not undefined', () => {
    const ticket = fleetTicketFromRow(makeRow({ odometer_km: 0 }));
    expect(ticket.odometerKm).toBe(0);
  });
});

describe('fleetTicketEventFromRow', () => {
  it('maps event fields and defaults a null payload', () => {
    const event = fleetTicketEventFromRow({
      id: 'event-1',
      client_id: 'client-1',
      ticket_id: 'ticket-1',
      event_type: 'created',
      actor_id: null,
      actor_name_snapshot: null,
      payload: null,
      created_at: '2026-07-29T10:00:00Z',
    });

    expect(event.ticketId).toBe('ticket-1');
    expect(event.eventType).toBe('created');
    expect(event.payload).toEqual({});
  });
});

describe('telegram settings mappers', () => {
  it('returns safe defaults when no settings row exists', () => {
    expect(telegramSettingsFromRow(null, 'client-1')).toEqual({
      clientId: 'client-1',
      enabled: false,
      chatId: '',
      notifySos: true,
      notifyCritical: true,
      notifyHigh: false,
    });
  });

  it('maps a settings row', () => {
    const settings = telegramSettingsFromRow({
      client_id: 'client-1',
      enabled: true,
      chat_id: '-100123',
      notify_sos: false,
      notify_critical: true,
      notify_high: true,
      updated_by: 'user-1',
      updated_at: '2026-07-29T10:00:00Z',
    }, 'ignored-client');

    expect(settings).toMatchObject({ clientId: 'client-1', chatId: '-100123', notifySos: false, notifyHigh: true });
  });

  it('trims chatId when converting settings to a row', () => {
    const row = telegramSettingsToRow({
      clientId: 'client-1',
      enabled: true,
      chatId: '  -100123  ',
      notifySos: true,
      notifyCritical: true,
      notifyHigh: false,
    }, 'user-1');

    expect(row).toMatchObject({ client_id: 'client-1', chat_id: '-100123', updated_by: 'user-1' });
  });
});
