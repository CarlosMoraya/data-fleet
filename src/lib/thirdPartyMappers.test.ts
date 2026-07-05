import { describe, expect, it } from 'vitest';

import { thirdPartyDriverFromRow, thirdPartyTractorFromRow } from './thirdPartyMappers';

describe('thirdPartyTractorFromRow', () => {
  it('maps tractor row', () => {
    expect(thirdPartyTractorFromRow({
      id: 'tractor-1',
      client_id: 'client-1',
      plate: 'ABC1D23',
      crlv_upload: null,
      crlv_expiration_date: '2027-01-10',
      antt: '123',
      gr_upload: null,
      gr_expiration_date: null,
      created_at: '2026-07-11T10:00:00Z',
      updated_at: '2026-07-11T10:00:00Z',
    })).toMatchObject({
      id: 'tractor-1',
      clientId: 'client-1',
      plate: 'ABC1D23',
      crlvExpirationDate: '2027-01-10',
      antt: '123',
    });
  });
});

describe('thirdPartyDriverFromRow', () => {
  it('maps driver row', () => {
    expect(thirdPartyDriverFromRow({
      id: 'driver-1',
      client_id: 'client-1',
      name: 'Beatriz',
      cnh: null,
      cnh_expiration_date: null,
      phone: '11999999999',
      address: 'Rua A',
      created_at: '2026-07-11T10:00:00Z',
      updated_at: '2026-07-11T10:00:00Z',
    })).toMatchObject({
      id: 'driver-1',
      clientId: 'client-1',
      name: 'Beatriz',
      phone: '11999999999',
      address: 'Rua A',
    });
  });
});
