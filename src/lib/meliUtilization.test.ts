import { describe, expect, it } from 'vitest';

import {
  buildUtilizationRows,
  calculateUtilizationKpis,
  defaultDateRange,
  filterRowsByPlate,
  filterRowsByUnit,
  filterRowsByUtilization,
  formatOdometerDistanceKm,
  isVehicleUnavailableOnDate,
  namesDiverge,
  parseMeliUtilizationStatusFilter,
} from './meliUtilization';

import type {
  BuildRowsInput,
  MeliEligibleVehicle,
  MeliRouteEntry,
  MeliUtilizationRow,
} from '../types/meliUtilization';

function vehicle(overrides: Partial<MeliEligibleVehicle> = {}): MeliEligibleVehicle {
  return {
    id: 'vehicle-1',
    licensePlate: 'ABC1D23',
    brand: 'Mercedes-Benz',
    model: 'Sprinter',
    driverName: 'José da Silva',
    unitCode: 'SRJ1',
    ...overrides,
  };
}

function route(overrides: Partial<MeliRouteEntry> = {}): MeliRouteEntry {
  return {
    plate: 'ABC1D23',
    routeDate: '2026-09-06',
    routeId: 'route-1',
    driverName: 'Jose da Silva',
    serviceCenter: 'SRJ1',
    cycle: 'AM',
    odometerDistanceKm: 82.35,
    ...overrides,
  };
}

function input(overrides: Partial<BuildRowsInput> = {}): BuildRowsInput {
  return {
    vehicles: [vehicle()],
    routes: [route()],
    maintenanceWindows: [],
    from: '2026-09-06',
    to: '2026-09-06',
    ...overrides,
  };
}

function utilizationRow(overrides: Partial<MeliUtilizationRow> = {}): MeliUtilizationRow {
  return {
    key: 'vehicle-1:route-1',
    vehicleId: 'vehicle-1',
    licensePlate: 'ABC1D23',
    vehicleDescription: 'Mercedes-Benz Sprinter',
    utilized: true,
    routeDate: '2026-09-06',
    routeId: 'route-1',
    driverName: 'José da Silva',
    fleetDriverName: 'José da Silva',
    driverDivergent: false,
    unitCode: 'SRJ1',
    fleetUnitCode: 'SRJ1',
    unitDivergent: false,
    unavailableOnDate: false,
    statusDivergent: false,
    cycle: 'AM',
    odometerDistanceKm: 82.35,
    ...overrides,
  };
}

describe('defaultDateRange', () => {
  it.each([
    [new Date(2026, 8, 7), { from: '2026-09-06', to: '2026-09-06' }],
    [new Date(2026, 2, 1), { from: '2026-02-28', to: '2026-02-28' }],
    [new Date(2026, 0, 1), { from: '2025-12-31', to: '2025-12-31' }],
  ])('devolve D-1 para %s', (today, expected) => {
    expect(defaultDateRange(today)).toEqual(expected);
  });
});

describe('namesDiverge', () => {
  it.each([
    ['Maria Souza', 'Maria Souza', false],
    ['maria souza', 'MARIA SOUZA', false],
    ['José da Silva', 'Jose da Silva', false],
    ['  Ana   Lima ', 'ANA LIMA', false],
    [null, 'Ana Lima', false],
    ['Ana Lima', null, false],
    [null, null, false],
    ['', 'Ana Lima', false],
    ['Ana Lima', 'Carlos Lima', true],
  ])('compara %s e %s', (left, right, expected) => {
    expect(namesDiverge(left, right)).toBe(expected);
  });
});

describe('isVehicleUnavailableOnDate', () => {
  const windows = [
    {
      vehicleId: 'vehicle-1',
      entryDate: '2026-09-03',
      exitDate: '2026-09-08',
      status: 'Em manutenção',
    },
  ];

  it('identifica datas dentro da janela, inclusive os limites', () => {
    expect(isVehicleUnavailableOnDate(windows, 'vehicle-1', '2026-09-03')).toBe(true);
    expect(isVehicleUnavailableOnDate(windows, 'vehicle-1', '2026-09-08')).toBe(true);
  });

  it('ignora datas antes da entrada e depois da saída', () => {
    expect(isVehicleUnavailableOnDate(windows, 'vehicle-1', '2026-09-02')).toBe(false);
    expect(isVehicleUnavailableOnDate(windows, 'vehicle-1', '2026-09-09')).toBe(false);
  });

  it('mantém uma janela aberta indisponível após a entrada', () => {
    expect(
      isVehicleUnavailableOnDate(
        [{ vehicleId: 'vehicle-1', entryDate: '2026-09-03', exitDate: null, status: 'Aberta' }],
        'vehicle-1',
        '2026-10-01',
      ),
    ).toBe(true);
  });

  it('ignora OS cancelada que já possui saída', () => {
    expect(
      isVehicleUnavailableOnDate(
        [
          {
            vehicleId: 'vehicle-1',
            entryDate: '2026-09-03',
            exitDate: '2026-09-08',
            status: 'Cancelado',
          },
        ],
        'vehicle-1',
        '2026-09-05',
      ),
    ).toBe(false);
  });
});

describe('buildUtilizationRows', () => {
  it('emite uma linha utilizada para uma rota', () => {
    const rows = buildUtilizationRows(input());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ utilized: true, routeId: 'route-1' });
  });

  it('preserva três rotas do mesmo veículo no mesmo dia', () => {
    const routes = ['1', '2', '3'].map((routeId) => route({ routeId }));

    expect(buildUtilizationRows(input({ routes }))).toHaveLength(3);
  });

  it('emite uma linha não utilizada por dia sem rota', () => {
    const rows = buildUtilizationRows(
      input({ routes: [], from: '2026-09-04', to: '2026-09-06' }),
    );

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => !row.utilized && row.routeId === null)).toBe(true);
  });

  it('ignora rota cuja placa não pertence ao conjunto elegível', () => {
    const rows = buildUtilizationRows(input({ routes: [route({ plate: 'ZZZ9Z99' })] }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ utilized: false, routeId: null });
  });

  it('casa os últimos sete caracteres de uma placa suja', () => {
    const rows = buildUtilizationRows(input({ routes: [route({ plate: '0000ABC-1D23' })] }));

    expect(rows[0]).toMatchObject({ utilized: true, routeId: 'route-1' });
  });

  it('sinaliza motorista realmente diferente e ignora motorista ausente', () => {
    const divergent = buildUtilizationRows(
      input({ routes: [route({ driverName: 'Outra Pessoa' })] }),
    );
    const absent = buildUtilizationRows(input({ routes: [route({ driverName: null })] }));

    expect(divergent[0].driverDivergent).toBe(true);
    expect(absent[0].driverDivergent).toBe(false);
  });

  it('não confunde SRJ10 com SRJ1', () => {
    const rows = buildUtilizationRows(
      input({ routes: [route({ serviceCenter: 'SRJ10' })] }),
    );

    expect(rows[0].unitDivergent).toBe(true);
  });

  it('sinaliza rota durante OS aberta, mas não veículo parado durante OS', () => {
    const maintenanceWindows = [
      { vehicleId: 'vehicle-1', entryDate: '2026-09-01', exitDate: null, status: 'Aberta' },
    ];
    const used = buildUtilizationRows(input({ maintenanceWindows }));
    const idle = buildUtilizationRows(input({ routes: [], maintenanceWindows }));

    expect(used[0]).toMatchObject({ unavailableOnDate: true, statusDivergent: true });
    expect(idle[0]).toMatchObject({ unavailableOnDate: true, statusDivergent: false });
  });
});

describe('calculateUtilizationKpis', () => {
  it('calcula 4 utilizados em um conjunto de 10 veículos', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      utilizationRow({
        key: `vehicle-${index}:row`,
        vehicleId: `vehicle-${index}`,
        utilized: index < 4,
      }),
    );

    expect(calculateUtilizationKpis(rows)).toEqual({
      totalVehicles: 10,
      usedVehicles: 4,
      unusedVehicles: 6,
      utilizationRate: 40,
    });
  });

  it('devolve zero para conjunto vazio', () => {
    expect(calculateUtilizationKpis([])).toEqual({
      totalVehicles: 0,
      usedVehicles: 0,
      unusedVehicles: 0,
      utilizationRate: 0,
    });
  });

  it('conta um veículo com três rotas apenas uma vez', () => {
    const rows = ['1', '2', '3'].map((routeId) =>
      utilizationRow({ key: `vehicle-1:${routeId}`, routeId }),
    );

    expect(calculateUtilizationKpis(rows).usedVehicles).toBe(1);
  });
});

describe('filterRowsByUnit', () => {
  const rows = [
    utilizationRow({ key: 'used', unitCode: 'SRJ1', utilized: true }),
    utilizationRow({
      key: 'idle',
      vehicleId: 'vehicle-2',
      unitCode: 'SRJ1',
      utilized: false,
    }),
    utilizationRow({ key: 'other', vehicleId: 'vehicle-3', unitCode: 'SRJ10' }),
  ];

  it('devolve a mesma lista quando a seleção está vazia', () => {
    expect(filterRowsByUnit(rows, [])).toBe(rows);
  });

  it('mantém linhas utilizadas e não utilizadas da unidade selecionada', () => {
    expect(filterRowsByUnit(rows, ['SRJ1']).map((row) => row.key)).toEqual(['used', 'idle']);
  });
});

describe('filtros e formatação de utilização MELI', () => {
  const rowUsed: MeliUtilizationRow = {
    key: 'v1:111',
    vehicleId: 'v1',
    licensePlate: 'ABC1D23',
    vehicleDescription: 'Fiat Fiorino',
    utilized: true,
    routeDate: '2026-09-06',
    routeId: '111',
    driverName: 'Ana',
    fleetDriverName: 'Ana',
    driverDivergent: false,
    unitCode: 'SRJ1',
    fleetUnitCode: 'SRJ1',
    unitDivergent: false,
    unavailableOnDate: false,
    statusDivergent: false,
    cycle: 'A',
    odometerDistanceKm: 15.5,
  };
  const rowUnused: MeliUtilizationRow = {
    key: 'v2:2026-09-06:idle',
    vehicleId: 'v2',
    licensePlate: 'ABC2D34',
    vehicleDescription: 'Fiat Fiorino',
    utilized: false,
    routeDate: '2026-09-06',
    routeId: null,
    driverName: null,
    fleetDriverName: 'Bruno',
    driverDivergent: false,
    unitCode: 'SRJ1',
    fleetUnitCode: 'SRJ1',
    unitDivergent: false,
    unavailableOnDate: false,
    statusDivergent: false,
    cycle: null,
    odometerDistanceKm: null,
  };

  it('formata a distância percorrida', () => {
    expect(formatOdometerDistanceKm(15.5)).toBe('15,5');
    expect(formatOdometerDistanceKm(null)).toBe('—');
  });

  it('filtra linhas por placa', () => {
    expect(filterRowsByPlate([rowUsed, rowUnused], 'ABC2D34')).toEqual([rowUnused]);
    expect(filterRowsByPlate([rowUsed, rowUnused], 'abc1')).toEqual([rowUsed]);
    expect(filterRowsByPlate([rowUsed, rowUnused], '')).toEqual([rowUsed, rowUnused]);
  });

  it('filtra linhas por utilização', () => {
    expect(filterRowsByUtilization([rowUsed, rowUnused], 'used')).toEqual([rowUsed]);
    expect(filterRowsByUtilization([rowUsed, rowUnused], 'unused')).toEqual([rowUnused]);
    expect(filterRowsByUtilization([rowUsed, rowUnused], 'all')).toEqual([
      rowUsed,
      rowUnused,
    ]);
  });

  it('interpreta o filtro de utilização', () => {
    expect(parseMeliUtilizationStatusFilter('used')).toBe('used');
    expect(parseMeliUtilizationStatusFilter('unused')).toBe('unused');
    expect(parseMeliUtilizationStatusFilter('bogus')).toBe('all');
    expect(parseMeliUtilizationStatusFilter(null)).toBe('all');
  });
});
