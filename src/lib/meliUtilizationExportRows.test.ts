import { describe, expect, it } from 'vitest';

import { buildMeliUtilizationExportCells, MELI_UTILIZATION_EXPORT_HEADERS } from './meliUtilizationExportRows';

import type { MeliUtilizationRow } from '../types/meliUtilization';

describe('meliUtilizationExportRows', () => {
  it('mapeia uma linha com rota e todas as divergências verdadeiras', () => {
    const row: MeliUtilizationRow = {
      key: 'v1:111',
      vehicleId: 'v1',
      licensePlate: 'ABC1D23',
      vehicleDescription: 'Fiat Fiorino',
      utilized: true,
      routeDate: '2026-09-06',
      routeId: '111',
      driverName: 'Ana',
      fleetDriverName: 'Ana Paula',
      driverDivergent: true,
      unitCode: 'SRJ1',
      fleetUnitCode: 'SRJ2',
      unitDivergent: true,
      unavailableOnDate: true,
      statusDivergent: true,
      cycle: 'CICLO_1',
      odometerDistanceKm: 15.5,
    };

    expect(buildMeliUtilizationExportCells(row)).toEqual([
      'ABC1D23',
      'Fiat Fiorino',
      'Utilizado',
      'Ana',
      'Ana Paula',
      'Sim',
      '111',
      '06/09/2026',
      'SRJ1',
      'SRJ2',
      'Sim',
      'CICLO_1',
      '15,5',
      'Indisponível',
      'Sim',
    ]);
  });

  it('mapeia um veículo ocioso com todos os campos nulos aplicáveis', () => {
    const row: MeliUtilizationRow = {
      key: 'v2:2026-09-06:idle',
      vehicleId: 'v2',
      licensePlate: 'ABC2D34',
      vehicleDescription: 'Renault Master',
      utilized: false,
      routeDate: '2026-09-06',
      routeId: null,
      driverName: null,
      fleetDriverName: 'Bruno',
      driverDivergent: false,
      unitCode: 'SRJ10',
      fleetUnitCode: 'SRJ10',
      unitDivergent: false,
      unavailableOnDate: false,
      statusDivergent: false,
      cycle: null,
      odometerDistanceKm: null,
    };

    expect(buildMeliUtilizationExportCells(row)).toEqual([
      'ABC2D34',
      'Renault Master',
      'Não utilizado',
      '',
      'Bruno',
      'Não',
      '',
      '06/09/2026',
      'SRJ10',
      'SRJ10',
      'Não',
      '',
      '',
      'Disponível',
      'Não',
    ]);
  });

  it('tem exatamente 15 cabeçalhos', () => {
    expect(MELI_UTILIZATION_EXPORT_HEADERS.length).toBe(15);
  });
});