import { describe, expect, it } from 'vitest';

import { buildGoogleMapsUrl, formatWorkshopAddress } from './workshopScheduleMappers';

import type { WorkshopSchedule } from '../types';


function makeFixture(overrides: Partial<WorkshopSchedule> = {}): WorkshopSchedule {
  return {
    id: 'sch-1',
    clientId: 'cli-1',
    vehicleId: 'veh-1',
    vehicleLicensePlate: 'TXS8A77',
    workshopId: 'wks-1',
    workshopName: 'VAMOS',
    workshopAddressStreet: 'R. André Narciso Rodrigo',
    workshopAddressNumber: '50',
    workshopAddressComplement: undefined,
    workshopAddressNeighborhood: 'Ipiranga',
    workshopAddressCity: 'Pouso Alegre',
    workshopAddressState: 'MG',
    workshopAddressZip: '37549-000',
    scheduledDate: '2026-09-16',
    status: 'scheduled',
    completedAt: undefined,
    checklistId: undefined,
    notes: 'Agendado para 10h. Procurar o mecânico Tião.',
    createdBy: 'usr-1',
    createdByName: 'Maria Souza',
    createdAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('formatWorkshopAddress', () => {
  it('formats complete address without complement', () => {
    const result = formatWorkshopAddress(makeFixture());
    expect(result).toBe(
      'R. André Narciso Rodrigo, 50\nIpiranga, Pouso Alegre - MG, 37549-000',
    );
  });

  it('formats address with complement', () => {
    const result = formatWorkshopAddress(
      makeFixture({ workshopAddressComplement: 'Galpão 3' }),
    );
    expect(result).toBe(
      'R. André Narciso Rodrigo, 50, Galpão 3\nIpiranga, Pouso Alegre - MG, 37549-000',
    );
  });

  it('formats address without state', () => {
    const result = formatWorkshopAddress(
      makeFixture({ workshopAddressState: undefined }),
    );
    expect(result).toBe(
      'R. André Narciso Rodrigo, 50\nIpiranga, Pouso Alegre, 37549-000',
    );
  });

  it('returns empty string when all address fields are undefined', () => {
    const result = formatWorkshopAddress(
      makeFixture({
        workshopAddressStreet: undefined,
        workshopAddressNumber: undefined,
        workshopAddressComplement: undefined,
        workshopAddressNeighborhood: undefined,
        workshopAddressCity: undefined,
        workshopAddressState: undefined,
        workshopAddressZip: undefined,
      }),
    );
    expect(result).toBe('');
  });
});

describe('buildGoogleMapsUrl', () => {
  it('builds URL for complete address', () => {
    const result = buildGoogleMapsUrl(makeFixture());
    expect(result).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=R.%20Andr%C3%A9%20Narciso%20Rodrigo%2C%2050%2C%20Ipiranga%2C%20Pouso%20Alegre%2C%20MG%2C%2037549-000',
    );
  });

  it('returns URL with empty destination when all address fields are undefined', () => {
    const result = buildGoogleMapsUrl(
      makeFixture({
        workshopAddressStreet: undefined,
        workshopAddressNumber: undefined,
        workshopAddressComplement: undefined,
        workshopAddressNeighborhood: undefined,
        workshopAddressCity: undefined,
        workshopAddressState: undefined,
        workshopAddressZip: undefined,
      }),
    );
    expect(result).toBe('https://www.google.com/maps/dir/?api=1&destination=');
  });
});
