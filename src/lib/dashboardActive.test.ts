import { describe, expect, it } from 'vitest';

import {
  calculateChecklistComplianceRate,
  calculateFleetAvailability,
  calculateInsuranceCoverageRate,
  calculateTrackerCoverageRate,
  countVehiclesWithoutDriver,
  buildVehicleFinancialRanking,
} from './dashboardKpi';

describe('dashboard active filtering', () => {
  const vehicles = [
    { id: 'v1', active: true, driver_id: 'd1', has_insurance: true, tracker: 'On', license_plate: 'AAA1A11', model: 'Actros' },
    { id: 'v2', active: true, driver_id: null, has_insurance: false, tracker: '', license_plate: 'BBB2B22', model: 'Daily' },
    { id: 'v3', active: true, driver_id: 'd3', has_insurance: true, tracker: 'On', license_plate: 'CCC3C33', model: 'Atego' },
    { id: 'v4', active: false, driver_id: null, has_insurance: false, tracker: '', license_plate: 'DDD4D44', model: 'FH' },
    { id: 'v5', active: false, driver_id: null, has_insurance: false, tracker: '', license_plate: 'EEE5E55', model: 'Stralis' },
  ];

  const activeVehicles = vehicles.filter((vehicle) => vehicle.active !== false);

  it('applies operational and conformity metrics only to active vehicles', () => {
    expect(calculateFleetAvailability(activeVehicles.length, 1)).toBe(67);
    expect(calculateChecklistComplianceRate(activeVehicles.length, 1)).toBe(67);
    expect(calculateInsuranceCoverageRate(activeVehicles)).toBe(67);
    expect(calculateTrackerCoverageRate(activeVehicles)).toBe(67);
    expect(countVehiclesWithoutDriver(activeVehicles)).toBe(1);
  });

  it('preserves cost history and plate resolution for inactive vehicles', () => {
    const ranking = buildVehicleFinancialRanking({
      filteredVehicles: vehicles,
      filteredOrders: [
        { vehicle_id: 'v4', type: 'Corretiva', approved_cost: 800, status: 'Orçamento aprovado' },
      ],
      vehicleKmRows: [],
    });

    expect(ranking).toHaveLength(1);
    expect(ranking[0].vehicleId).toBe('v4');
    expect(ranking[0].plate).toBe('DDD4D44');
  });
});
