import { describe, expect, it } from 'vitest';

import { couplingFromRow } from './couplingMappers';

describe('couplingFromRow', () => {
  it('maps snake_case payload to camelCase coupling', () => {
    expect(couplingFromRow({
      id: 'coupling-1',
      client_id: 'client-1',
      trailer_id: 'trailer-1',
      tractor_id: 'tractor-1',
      tractor_plate: 'ABC1D23',
      tractor_driver_name: 'Marcos',
      third_party_tractor_id: null,
      third_party_driver_id: null,
      coupled_at: '2026-07-11T10:00:00Z',
      uncoupled_at: null,
      coupled_latitude: '-23.5',
      coupled_longitude: '-46.6',
      uncoupled_latitude: null,
      uncoupled_longitude: null,
      odometer_coupled: '1000',
      odometer_uncoupled: null,
      distance_km: null,
      coupling_checklist_id: 'checklist-1',
      uncoupling_checklist_id: null,
      filled_by: 'profile-1',
      notes: 'Teste',
      created_at: '2026-07-11T10:00:00Z',
      updated_at: '2026-07-11T10:00:00Z',
    })).toEqual({
      id: 'coupling-1',
      clientId: 'client-1',
      trailerId: 'trailer-1',
      tractorId: 'tractor-1',
      tractorPlate: 'ABC1D23',
      tractorDriverName: 'Marcos',
      thirdPartyTractorId: null,
      thirdPartyDriverId: null,
      coupledAt: '2026-07-11T10:00:00Z',
      uncoupledAt: null,
      coupledLatitude: -23.5,
      coupledLongitude: -46.6,
      uncoupledLatitude: null,
      uncoupledLongitude: null,
      odometerCoupled: 1000,
      odometerUncoupled: null,
      distanceKm: null,
      couplingChecklistId: 'checklist-1',
      uncouplingChecklistId: null,
      filledBy: 'profile-1',
      notes: 'Teste',
      createdAt: '2026-07-11T10:00:00Z',
      updatedAt: '2026-07-11T10:00:00Z',
    });
  });
});
