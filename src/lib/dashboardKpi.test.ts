import { describe, it, expect } from 'vitest';

import {
  applyCostFilters,
  countActiveInMaintenance,
  buildActiveMaintenanceTypeData,
  buildCostFilterOptions,
  calculateAverageApprovedTicket,
  calculateCostPerKm,
  calculateFleetAvailability,
  countVehiclesInMaintenance,
  calculateChecklistComplianceRate,
  countOverdueMaintenanceOrders,
  countPendingApprovalOrders,
  getEndOfWeekIso,
  countVehiclesWithoutDriver,
  getVehiclesWithoutDriverPlates,
  countOpenOrders,
  countActiveOrdersExitingByEndOfWeek,
  getActiveOrdersExitingByEndOfWeekVehicleIds,
  countActiveOrdersDueWithinDays,
  getActiveOrdersDueWithinDaysVehicleIds,
  countPendingBudgetOrders,
  getPendingBudgetVehicleIds,
  buildOperationalActionQueue,
  calculateInsuranceCoverageRate,
  calculateTrackerCoverageRate,
  buildFleetCountByKey,
  buildTopFleetModels,
  buildActionQueue,
  calculateAverageMaintenanceDays,
  calculateAverageOpenOrderAgeDays,
  buildMaintenanceStatusData,
  calculatePreviousPeriodRange,
  calculateCostVariation,
  countExpiringSoon,
  mapVehicleIdsToPlates,
  isCrlvExpired,
  getExpiredCrlvPlates,
  getExpiringSoonCrlvPlates,
  getExpiredCnhNames,
  getExpiringSoonCnhNames,
  getExpiringSoonGrPlates,
  getExpiringSoonGrDriverNames,
  chooseTrendGranularity,
  buildCostTrendSeries,
  getTrailingMonthKeys,
  sumApprovedCostByMonthKeys,
  calculateMovingAverageProjection,
  computeOverdueChecklistVehicleIds,
  resolveHorizonRange,
  buildMonthlyOrderCounts,
  buildMonthlyAverageCompletionDays,
  buildMonthlyMaintenanceTypeCounts,
  buildComplianceActionQueue,
  calculateDocumentaryComplianceRate,
  countIrregularDrivers,
  countIrregularVehicles,
  getDriversMissingCnhUploadNames,
  getDriversWithVehicleMissingGrNames,
  getExpiredGrDriverNames,
  getExpiredGrVehiclePlates,
  getVehiclesMissingCrlvUploadPlates,
  getVehiclesMissingGrPlates,
  getVehiclesMissingInsurancePlates,
  getVehiclesMissingMaintenanceContractPlates,
  isBlank,
  normalizeCostFilterValue,
  sumApprovedMaintenanceCost,
  isDriverDocumentallyIrregular,
  isVehicleDocumentallyIrregular,
  buildCostByVehicleAttribute,
  buildCostBySystemData,
  buildVehicleFinancialRanking,
  type BudgetItemForCost,
} from './dashboardKpi';

describe('cost dashboard filters and KPIs', () => {
  const vehicles = [
    {
      id: 'v1',
      type: 'Truck',
      crlv_year: null,
      crlv_expiration_date: null,
      driver_id: null,
      category: 'Pesado',
      model: 'Atego',
      shipper_name: 'Alpha',
      operational_unit_name: 'Campinas',
    },
    {
      id: 'v2',
      type: 'Van',
      crlv_year: null,
      crlv_expiration_date: null,
      driver_id: null,
      category: 'Leve',
      model: 'Daily',
      shipper_name: 'Beta',
      operational_unit_name: 'Santos',
    },
    {
      id: 'v3',
      type: 'Truck',
      crlv_year: null,
      crlv_expiration_date: null,
      driver_id: null,
      category: 'Pesado',
      model: 'Actros',
      shipper_name: 'Alpha',
      operational_unit_name: 'Santos',
    },
  ];

  const orders = [
    { vehicle_id: 'v1', type: 'Corretiva' as const, status: 'Orçamento aprovado', approved_cost: 1200 },
    { vehicle_id: 'v2', type: 'Preventiva' as const, status: 'Orçamento aprovado', approved_cost: 600 },
    { vehicle_id: 'v3', type: 'Preditiva' as const, status: 'Aguardando aprovação', approved_cost: 300 },
    { vehicle_id: 'v3', type: 'Corretiva' as const, status: 'Cancelado', approved_cost: 999 },
  ];

  const emptyFilters = {
    category: null,
    model: null,
    shipper: null,
    operationalUnit: null,
    maintenanceType: null,
  } as const;

  it('normalizeCostFilterValue normaliza vazio e espaços para null', () => {
    expect(normalizeCostFilterValue(undefined)).toBeNull();
    expect(normalizeCostFilterValue('   ')).toBeNull();
    expect(normalizeCostFilterValue(' Atego ')).toBe('Atego');
  });

  it('buildCostFilterOptions retorna opções únicas ordenadas', () => {
    expect(buildCostFilterOptions(vehicles)).toEqual({
      categories: ['Leve', 'Pesado'],
      models: ['Actros', 'Atego', 'Daily'],
      shippers: ['Alpha', 'Beta'],
      operationalUnits: ['Campinas', 'Santos'],
    });
  });

  it('applyCostFilters filtra veículos e ordens por Categoria', () => {
    const result = applyCostFilters({
      vehicles,
      orders,
      filters: { ...emptyFilters, category: 'Pesado' },
    });

    expect(result.filteredVehicles.map((vehicle) => vehicle.id)).toEqual(['v1', 'v3']);
    expect(result.filteredOrders.map((order) => order.vehicle_id)).toEqual(['v1', 'v3', 'v3']);
  });

  it('applyCostFilters filtra por Modelo', () => {
    const result = applyCostFilters({
      vehicles,
      orders,
      filters: { ...emptyFilters, model: 'Daily' },
    });

    expect(result.filteredVehicles.map((vehicle) => vehicle.id)).toEqual(['v2']);
    expect(result.filteredOrders.map((order) => order.vehicle_id)).toEqual(['v2']);
  });

  it('applyCostFilters filtra por Embarcador', () => {
    const result = applyCostFilters({
      vehicles,
      orders,
      filters: { ...emptyFilters, shipper: 'Alpha' },
    });

    expect(result.filteredVehicles.map((vehicle) => vehicle.id)).toEqual(['v1', 'v3']);
    expect(result.filteredOrders.map((order) => order.vehicle_id)).toEqual(['v1', 'v3', 'v3']);
  });

  it('applyCostFilters filtra por Unidade Operacional', () => {
    const result = applyCostFilters({
      vehicles,
      orders,
      filters: { ...emptyFilters, operationalUnit: 'Campinas' },
    });

    expect(result.filteredVehicles.map((vehicle) => vehicle.id)).toEqual(['v1']);
    expect(result.filteredOrders.map((order) => order.vehicle_id)).toEqual(['v1']);
  });

  it('combinação de filtros aplica interseção, não união', () => {
    const result = applyCostFilters({
      vehicles,
      orders,
      filters: { ...emptyFilters, category: 'Pesado', shipper: 'Alpha', operationalUnit: 'Campinas' },
    });

    expect(result.filteredVehicles.map((vehicle) => vehicle.id)).toEqual(['v1']);
    expect(result.filteredOrders.map((order) => order.vehicle_id)).toEqual(['v1']);
  });

  it('sumApprovedMaintenanceCost ignora canceladas e custos não positivos', () => {
    expect(sumApprovedMaintenanceCost(orders)).toBe(2100);
  });

  it('calculateAverageApprovedTicket retorna null sem OS aprovada', () => {
    expect(
      calculateAverageApprovedTicket([
        { status: 'Cancelado', approved_cost: 100 },
        { status: 'Aguardando aprovação', approved_cost: 0 },
      ])
    ).toBeNull();
  });

  it('calculateCostPerKm retorna valor quando há custo e KM válido', () => {
    expect(
      calculateCostPerKm({
        totalCost: 2000,
        vehicleKmRows: [
          { vehicle_id: 'v1', km_driven: 400 },
          { vehicle_id: 'v2', km_driven: 100 },
        ],
        allowedVehicleIds: new Set(['v1', 'v2']),
      })
    ).toEqual({ value: 4, totalKm: 500 });
  });

  it('calculateCostPerKm retorna value null quando KM total é zero', () => {
    expect(
      calculateCostPerKm({
        totalCost: 2000,
        vehicleKmRows: [{ vehicle_id: 'v1', km_driven: 0 }],
        allowedVehicleIds: new Set(['v1']),
      })
    ).toEqual({ value: null, totalKm: 0 });
  });

  it('calculateCostPerKm ignora KM zero, negativo ou de veículo fora do filtro', () => {
    expect(
      calculateCostPerKm({
        totalCost: 900,
        vehicleKmRows: [
          { vehicle_id: 'v1', km_driven: 300 },
          { vehicle_id: 'v2', km_driven: 0 },
          { vehicle_id: 'v3', km_driven: -10 },
          { vehicle_id: 'v4', km_driven: 500 },
        ],
        allowedVehicleIds: new Set(['v1', 'v2', 'v3']),
      })
    ).toEqual({ value: 3, totalKm: 300 });
  });
});

describe('countActiveInMaintenance', () => {
  it('retorna 2 quando há 2 ordens ativas e nenhum filtro de tipo', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v2', status: 'Orçamento aprovado' },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    expect(countActiveInMaintenance(orders, vehicles, null)).toBe(2);
  });

  it('retorna 0 quando todas as ordens estão Concluídas ou Canceladas', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Concluído' },
      { vehicle_id: 'v2', status: 'Cancelado' },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    expect(countActiveInMaintenance(orders, vehicles, null)).toBe(0);
  });

  it('retorna 1 quando filtra por Truck e apenas 1 ordem ativa pertence a um Truck', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v2', status: 'Orçamento aprovado' },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    expect(countActiveInMaintenance(orders, vehicles, 'Truck')).toBe(1);
  });

  it('retorna 0 quando orders é um array vazio', () => {
    expect(countActiveInMaintenance([], [], null)).toBe(0);
  });

  it('ignora ordens cujo vehicle_id não está em vehicles quando há filtro de tipo', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v-unknown', status: 'Orçamento aprovado' },
    ];
    const vehicles = [{ id: 'v1', type: 'Truck' }];
    expect(countActiveInMaintenance(orders, vehicles, 'Truck')).toBe(1);
  });
});

describe('buildActiveMaintenanceTypeData', () => {
  it('retorna contagem por tipo apenas para ordens ativas', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento', type: 'Corretiva' as const },
      { vehicle_id: 'v2', status: 'Orçamento aprovado', type: 'Preventiva' as const },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    const result = buildActiveMaintenanceTypeData(orders, vehicles, null);
    expect(result).toEqual([
      { name: 'Corretiva', value: 1 },
      { name: 'Preventiva', value: 1 },
    ]);
  });

  it('ignora ordens concluídas e canceladas', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Concluído', type: 'Corretiva' as const },
      { vehicle_id: 'v2', status: 'Cancelado', type: 'Preventiva' as const },
      { vehicle_id: 'v3', status: 'Aguardando orçamento', type: 'Preditiva' as const },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
      { id: 'v3', type: 'Truck' },
    ];
    const result = buildActiveMaintenanceTypeData(orders, vehicles, null);
    expect(result).toEqual([{ name: 'Preditiva', value: 1 }]);
  });

  it('respeita filtro de tipo de veículo', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento', type: 'Corretiva' as const },
      { vehicle_id: 'v2', status: 'Orçamento aprovado', type: 'Preventiva' as const },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    const result = buildActiveMaintenanceTypeData(orders, vehicles, 'Truck');
    expect(result).toEqual([{ name: 'Corretiva', value: 1 }]);
  });

  it('retorna array vazio quando não há ordens ativas', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Concluído', type: 'Corretiva' as const },
      { vehicle_id: 'v2', status: 'Cancelado', type: 'Preventiva' as const },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    const result = buildActiveMaintenanceTypeData(orders, vehicles, null);
    expect(result).toEqual([]);
  });
});

describe('calculateFleetAvailability', () => {
  it('retorna 80 quando há 10 veículos e 2 em manutenção', () => {
    expect(calculateFleetAvailability(10, 2)).toBe(80);
  });

  it('retorna 0 quando não há frota (divisão por zero)', () => {
    expect(calculateFleetAvailability(0, 0)).toBe(0);
  });

  it('retorna 0 quando veículos em manutenção excedem o total (clamp)', () => {
    expect(calculateFleetAvailability(10, 12)).toBe(0);
  });
});

describe('countVehiclesInMaintenance', () => {
  it('retorna 2 quando há 2 ordens ativas em 2 veículos distintos', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v2', status: 'Orçamento aprovado' },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    expect(countVehiclesInMaintenance(orders, null, vehicles)).toBe(2);
  });

  it('retorna 1 quando 2 ordens ativas estão no MESMO veículo', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v1', status: 'Orçamento aprovado' },
    ];
    const vehicles = [{ id: 'v1', type: 'Truck' }];
    expect(countVehiclesInMaintenance(orders, null, vehicles)).toBe(1);
  });

  it('exclui veículos com status "Veículo retirado" (não são indisponíveis)', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v2', status: 'Veículo retirado' },
      { vehicle_id: 'v3', status: 'Concluído' },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
      { id: 'v3', type: 'Truck' },
    ];
    // Esperado: apenas v1 é ativa (v2 e v3 são status terminal)
    expect(countVehiclesInMaintenance(orders, null, vehicles)).toBe(1);
  });

  it('conta apenas veículos do tipo filtrado', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v2', status: 'Orçamento aprovado' },
    ];
    const vehicles = [
      { id: 'v1', type: 'Truck' },
      { id: 'v2', type: 'Van' },
    ];
    expect(countVehiclesInMaintenance(orders, 'Truck', vehicles)).toBe(1);
  });
});

describe('calculateChecklistComplianceRate', () => {
  it('retorna 90 quando há 10 veículos e 1 com checklist vencido', () => {
    expect(calculateChecklistComplianceRate(10, 1)).toBe(90);
  });

  it('retorna 100 quando não há frota (sem pendência)', () => {
    expect(calculateChecklistComplianceRate(0, 0)).toBe(100);
  });
});

describe('calculateInsuranceCoverageRate', () => {
  it('retorna 80 quando 8 de 10 veículos têm seguro', () => {
    const vehicles = [
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: true },
      { has_insurance: false },
      { has_insurance: false },
    ];

    expect(calculateInsuranceCoverageRate(vehicles)).toBe(80);
  });

  it('retorna 0 quando a lista está vazia', () => {
    expect(calculateInsuranceCoverageRate([])).toBe(0);
  });

  it('conta has_insurance null como não coberto', () => {
    expect(calculateInsuranceCoverageRate([{ has_insurance: true }, { has_insurance: null }])).toBe(50);
  });
});

describe('calculateTrackerCoverageRate', () => {
  it('retorna 50 quando 2 de 4 veículos têm rastreador', () => {
    const vehicles = [
      { tracker: 'Sascar' },
      { tracker: 'Sascar' },
      { tracker: null },
      { tracker: null },
    ];

    expect(calculateTrackerCoverageRate(vehicles)).toBe(50);
  });

  it('conta tracker só com espaços como não coberto', () => {
    expect(calculateTrackerCoverageRate([{ tracker: '   ' }, { tracker: 'Positron' }])).toBe(50);
  });

  it('retorna 0 quando a lista está vazia', () => {
    expect(calculateTrackerCoverageRate([])).toBe(0);
  });
});

describe('buildFleetCountByKey', () => {
  it('agrupa por categoria em buckets ordenados por valor decrescente', () => {
    const vehicles = [
      { id: '1', type: 'Truck', crlv_year: null, crlv_expiration_date: null, driver_id: null, category: 'Pesado' },
      { id: '2', type: 'Truck', crlv_year: null, crlv_expiration_date: null, driver_id: null, category: 'Pesado' },
      { id: '3', type: 'Van', crlv_year: null, crlv_expiration_date: null, driver_id: null, category: 'Leve' },
      { id: '4', type: 'Moto', crlv_year: null, crlv_expiration_date: null, driver_id: null, category: 'Moto' },
    ];

    expect(buildFleetCountByKey(vehicles, (vehicle) => vehicle.category, 'Sem Categoria')).toEqual([
      { name: 'Pesado', value: 2 },
      { name: 'Leve', value: 1 },
      { name: 'Moto', value: 1 },
    ]);
  });

  it('usa fallback quando a chave é nula', () => {
    const vehicles = [
      { id: '1', type: 'Truck', crlv_year: null, crlv_expiration_date: null, driver_id: null, category: null },
    ];

    expect(buildFleetCountByKey(vehicles, (vehicle) => vehicle.category, 'Sem Categoria')).toEqual([
      { name: 'Sem Categoria', value: 1 },
    ]);
  });

  it('não retorna buckets com value igual a zero', () => {
    const vehicles = [
      { id: '1', type: 'Truck', crlv_year: null, crlv_expiration_date: null, driver_id: null, category: 'Pesado' },
    ];

    expect(buildFleetCountByKey(vehicles, (vehicle) => vehicle.category, 'Sem Categoria').every((item) => item.value > 0)).toBe(true);
  });
});

describe('buildTopFleetModels', () => {
  it('retorna os 3 modelos com maior contagem quando limit é 3', () => {
    const vehicles = [
      { model: 'Atego' },
      { model: 'Atego' },
      { model: 'Daily' },
      { model: 'Daily' },
      { model: 'Daily' },
      { model: 'Sprinter' },
      { model: 'Transit' },
      { model: 'HR' },
    ];

    expect(buildTopFleetModels(vehicles, 3, 'Sem Modelo')).toEqual([
      { name: 'Daily', value: 3 },
      { name: 'Atego', value: 2 },
      { name: 'Sprinter', value: 1 },
    ]);
  });

  it('usa fallback quando model é nulo', () => {
    expect(buildTopFleetModels([{ model: null }], 10, 'Sem Modelo')).toEqual([
      { name: 'Sem Modelo', value: 1 },
    ]);
  });
});

describe('countOverdueMaintenanceOrders', () => {
  it('retorna 1 quando há 1 OS ativa com expected_exit_date anterior a hoje', () => {
    const today = '2026-06-13';
    const orders = [
      { status: 'Aguardando orçamento', expected_exit_date: '2026-06-10' },
      { status: 'Orçamento aprovado', expected_exit_date: '2026-06-20' },
    ];
    expect(countOverdueMaintenanceOrders(orders, today)).toBe(1);
  });

  it('não conta OS com expected_exit_date null', () => {
    const today = '2026-06-13';
    const orders = [
      { status: 'Aguardando orçamento', expected_exit_date: null },
    ];
    expect(countOverdueMaintenanceOrders(orders, today)).toBe(0);
  });

  it('não conta OS Concluído mesmo com data vencida', () => {
    const today = '2026-06-13';
    const orders = [
      { status: 'Concluído', expected_exit_date: '2026-06-10' },
    ];
    expect(countOverdueMaintenanceOrders(orders, today)).toBe(0);
  });
});

describe('countPendingApprovalOrders', () => {
  it('retorna 1 quando há 1 OS Aguardando aprovação entre 3', () => {
    const orders = [
      { status: 'Aguardando orçamento' },
      { status: 'Aguardando aprovação' },
      { status: 'Orçamento aprovado' },
    ];
    expect(countPendingApprovalOrders(orders)).toBe(1);
  });
});

describe('getEndOfWeekIso', () => {
  it('retorna o domingo da semana para uma terça-feira', () => {
    expect(getEndOfWeekIso('2026-06-16')).toBe('2026-06-21');
  });

  it('retorna o próprio domingo quando hoje já é domingo', () => {
    expect(getEndOfWeekIso('2026-06-21')).toBe('2026-06-21');
  });

  it('retorna o domingo seguinte quando hoje é sábado', () => {
    expect(getEndOfWeekIso('2026-06-20')).toBe('2026-06-21');
  });

  it('lida com virada de mês', () => {
    expect(getEndOfWeekIso('2026-05-29')).toBe('2026-05-31');
    expect(getEndOfWeekIso('2026-08-31')).toBe('2026-09-06');
  });
});

describe('countVehiclesWithoutDriver / getVehiclesWithoutDriverPlates', () => {
  it('conta apenas veículos sem motorista e retorna só placas válidas', () => {
    const vehicles = [
      { driver_id: null, license_plate: 'ABC1D23' },
      { driver_id: undefined, license_plate: 'DEF4G56' },
      { driver_id: 'driver-1', license_plate: 'GHI7J89' },
      { driver_id: null, license_plate: null },
    ];

    expect(countVehiclesWithoutDriver(vehicles)).toBe(3);
    expect(getVehiclesWithoutDriverPlates(vehicles)).toEqual(['ABC1D23', 'DEF4G56']);
  });
});

describe('countOpenOrders', () => {
  it('ignora ordens concluídas e canceladas', () => {
    expect(
      countOpenOrders([
        { status: 'Aguardando orçamento' },
        { status: 'Serviço em execução' },
        { status: 'Concluído' },
        { status: 'Cancelado' },
      ])
    ).toBe(2);
  });
});

describe('countActiveOrdersExitingByEndOfWeek / getActiveOrdersExitingByEndOfWeekVehicleIds', () => {
  it('inclui somente OS ativas com saída entre hoje e fim da semana', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento', expected_exit_date: '2026-06-16' },
      { vehicle_id: 'v2', status: 'Serviço em execução', expected_exit_date: '2026-06-21' },
      { vehicle_id: 'v3', status: 'Serviço em execução', expected_exit_date: '2026-06-15' },
      { vehicle_id: 'v4', status: 'Serviço em execução', expected_exit_date: '2026-06-22' },
      { vehicle_id: 'v5', status: 'Serviço em execução', expected_exit_date: null },
      { vehicle_id: 'v6', status: 'Concluído', expected_exit_date: '2026-06-18' },
      { vehicle_id: 'v7', status: 'Cancelado', expected_exit_date: '2026-06-18' },
    ];

    expect(countActiveOrdersExitingByEndOfWeek(orders, '2026-06-16', '2026-06-21')).toBe(2);
    expect(getActiveOrdersExitingByEndOfWeekVehicleIds(orders, '2026-06-16', '2026-06-21')).toEqual(['v1', 'v2']);
  });
});

describe('countActiveOrdersDueWithinDays / getActiveOrdersDueWithinDaysVehicleIds', () => {
  it('inclui hoje até hoje+7 e exclui dia 8, passado, null e concluído', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento', expected_exit_date: '2026-06-16' },
      { vehicle_id: 'v2', status: 'Serviço em execução', expected_exit_date: '2026-06-23' },
      { vehicle_id: 'v3', status: 'Serviço em execução', expected_exit_date: '2026-06-24' },
      { vehicle_id: 'v4', status: 'Serviço em execução', expected_exit_date: '2026-06-15' },
      { vehicle_id: 'v5', status: 'Serviço em execução', expected_exit_date: null },
      { vehicle_id: 'v6', status: 'Concluído', expected_exit_date: '2026-06-20' },
    ];

    expect(countActiveOrdersDueWithinDays(orders, '2026-06-16', 7)).toBe(2);
    expect(getActiveOrdersDueWithinDaysVehicleIds(orders, '2026-06-16', 7)).toEqual(['v1', 'v2']);
  });
});

describe('countPendingBudgetOrders / getPendingBudgetVehicleIds', () => {
  it('considera apenas status Aguardando orçamento', () => {
    const orders = [
      { vehicle_id: 'v1', status: 'Aguardando orçamento' },
      { vehicle_id: 'v2', status: 'Aguardando aprovação' },
      { vehicle_id: 'v3', status: 'Aguardando orçamento' },
    ];

    expect(countPendingBudgetOrders(orders)).toBe(2);
    expect(getPendingBudgetVehicleIds(orders)).toEqual(['v1', 'v3']);
  });
});

describe('buildOperationalActionQueue', () => {
  it('mantém a ordem fixa dos 9 itens quando todos têm dados', () => {
    const result = buildOperationalActionQueue({
      vehiclesUnavailable: ['ABC1D23'],
      vehiclesNoDriver: ['DEF4G56'],
      osOverdue: ['GHI7J89'],
      checklistOverdue: ['JKL0M12'],
      osExitThisWeek: ['NOP3Q45'],
      osPendingApproval: ['RST6U78'],
      osPendingBudget: ['VWX9Y01'],
      actionPlansOpen: ['ZAB2C34'],
      osDueSoon: ['CDE5F67'],
    });

    expect(result.map((item) => item.category)).toEqual([
      'vehicles_unavailable',
      'vehicles_no_driver',
      'os_overdue',
      'checklist_overdue',
      'os_exit_this_week',
      'os_pending_approval',
      'os_pending_budget',
      'action_plans_open',
      'os_due_soon',
    ]);
  });

  it('filtra itens com count zero e mantém count igual aos details', () => {
    const result = buildOperationalActionQueue({
      vehiclesUnavailable: [],
      vehiclesNoDriver: ['DEF4G56'],
      osOverdue: [],
      checklistOverdue: ['JKL0M12', 'NOP3Q45'],
      osExitThisWeek: [],
      osPendingApproval: [],
      osPendingBudget: [],
      actionPlansOpen: [],
      osDueSoon: [],
    });

    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(result[0].details.length);
    expect(result[1].count).toBe(result[1].details.length);
  });

  it('retorna array vazio quando tudo está vazio', () => {
    expect(
      buildOperationalActionQueue({
        vehiclesUnavailable: [],
        vehiclesNoDriver: [],
        osOverdue: [],
        checklistOverdue: [],
        osExitThisWeek: [],
        osPendingApproval: [],
        osPendingBudget: [],
        actionPlansOpen: [],
        osDueSoon: [],
      })
    ).toEqual([]);
  });
});

describe('buildActionQueue', () => {
  it('retorna 5 itens com high antes de medium, contagens e detalhes preservados', () => {
    const result = buildActionQueue({
      checklist: ['ABC1D23', 'DEF4G56'],
      crlv: ['GHI7J89'],
      crlvExpiring: [],
      cnh: ['Maria Souza'],
      osOverdue: ['JKL0M12', 'NOP3Q45', 'RST6U78'],
      osPendingApproval: ['VWX9Y01', 'ZAB2C34'],
    });
    expect(result).toHaveLength(5);
    expect(result[0].severity).toBe('high');
    expect(result[1].severity).toBe('high');
    expect(result[2].severity).toBe('high');
    expect(result[3].severity).toBe('high');
    expect(result[4].severity).toBe('medium');
    expect(result[0].count).toBe(result[0].details.length);
    expect(result[0].details).toEqual(['ABC1D23', 'DEF4G56']);
    expect(result[4].count).toBe(result[4].details.length);
    expect(result[4].details).toEqual(['VWX9Y01', 'ZAB2C34']);
  });

  it('retorna array vazio quando todas as listas estão vazias', () => {
    const result = buildActionQueue({
      checklist: [],
      crlv: [],
      crlvExpiring: [],
      cnh: [],
      osOverdue: [],
      osPendingApproval: [],
    });
    expect(result).toEqual([]);
  });

  it('retorna 1 item medium quando apenas osPendingApproval tem itens', () => {
    const result = buildActionQueue({
      checklist: [],
      crlv: [],
      crlvExpiring: [],
      cnh: [],
      osOverdue: [],
      osPendingApproval: ['ABC1D23', 'DEF4G56', 'GHI7J89'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('os_pending_approval');
    expect(result[0].severity).toBe('medium');
    expect(result[0].details).toEqual(['ABC1D23', 'DEF4G56', 'GHI7J89']);
  });

  it('retorna item crlv_expiring com severity medium e ordenado após itens high', () => {
    const result = buildActionQueue({
      checklist: [],
      crlv: ['ABC1D23'],
      crlvExpiring: ['XYZ9A87'],
      cnh: [],
      osOverdue: [],
      osPendingApproval: [],
    });
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('crlv');
    expect(result[0].severity).toBe('high');
    expect(result[1].category).toBe('crlv_expiring');
    expect(result[1].severity).toBe('medium');
    expect(result[1].details).toEqual(['XYZ9A87']);
  });

  it('inclui os novos itens medium após os medium pré-existentes e preserva a ordem relativa', () => {
    const result = buildActionQueue({
      checklist: ['AAA1A11'],
      crlv: [],
      crlvExpiring: ['BBB2B22'],
      cnh: [],
      osOverdue: [],
      osPendingApproval: ['CCC3C33'],
      cnhExpiring: ['Maria Souza'],
      grVehicleExpiring: ['DDD4D44'],
      grDriverExpiring: ['João Lima'],
    });

    expect(result.map((item) => item.category)).toEqual([
      'checklist',
      'crlv_expiring',
      'os_pending_approval',
      'cnh_expiring',
      'gr_vehicle_expiring',
      'gr_driver_expiring',
    ]);
    expect(result.slice(1).every((item) => item.severity === 'medium')).toBe(true);
    expect(result[3].count).toBe(result[3].details.length);
    expect(result[4].count).toBe(result[4].details.length);
    expect(result[5].count).toBe(result[5].details.length);
  });

  it('mantém comportamento neutro quando os novos campos são omitidos', () => {
    const result = buildActionQueue({
      checklist: [],
      crlv: ['ABC1D23'],
      crlvExpiring: ['XYZ9A87'],
      cnh: [],
      osOverdue: [],
      osPendingApproval: [],
    });

    expect(result).toEqual([
      {
        category: 'crlv',
        label: 'Veículos com CRLV vencido',
        count: 1,
        severity: 'high',
        details: ['ABC1D23'],
      },
      {
        category: 'crlv_expiring',
        label: 'Veículos com CRLV a vencer (30d)',
        count: 1,
        severity: 'medium',
        details: ['XYZ9A87'],
      },
    ]);
  });

  it('não inclui novos itens quando as listas opcionais estão vazias', () => {
    const result = buildActionQueue({
      checklist: [],
      crlv: [],
      crlvExpiring: [],
      cnh: [],
      osOverdue: [],
      osPendingApproval: [],
      cnhExpiring: [],
      grVehicleExpiring: [],
      grDriverExpiring: [],
    });

    expect(result).toEqual([]);
  });
});

describe('expiring soon extractors', () => {
  it('getExpiringSoonCnhNames includes names within the window and on the exact limit', () => {
    const result = getExpiringSoonCnhNames([
      { name: 'Maria Souza', expiration_date: '2026-07-15' },
      { name: 'João Lima', expiration_date: '2026-06-20' },
    ], '2026-06-15', 30);

    expect(result).toEqual(['Maria Souza', 'João Lima']);
  });

  it('getExpiringSoonCnhNames excludes expired, null, unnamed and beyond-window entries', () => {
    const result = getExpiringSoonCnhNames([
      { name: 'Expirada', expiration_date: '2026-06-14' },
      { name: 'Fora da janela', expiration_date: '2026-07-16' },
      { name: null, expiration_date: '2026-06-20' },
      { name: 'Sem data', expiration_date: null },
    ], '2026-06-15', 30);

    expect(result).toEqual([]);
  });

  it('getExpiringSoonGrPlates includes plates within the window and on the exact limit', () => {
    const result = getExpiringSoonGrPlates([
      { license_plate: 'ABC1D23', gr_expiration_date: '2026-06-20' },
      { license_plate: 'XYZ9A87', gr_expiration_date: '2026-07-15' },
    ], '2026-06-15', 30);

    expect(result).toEqual(['ABC1D23', 'XYZ9A87']);
  });

  it('getExpiringSoonGrPlates excludes expired, null, plate-less and beyond-window entries', () => {
    const result = getExpiringSoonGrPlates([
      { license_plate: 'OLD1A11', gr_expiration_date: '2026-06-14' },
      { license_plate: 'FAR2B22', gr_expiration_date: '2026-07-16' },
      { license_plate: null, gr_expiration_date: '2026-06-20' },
      { license_plate: 'NON3C33', gr_expiration_date: null },
    ], '2026-06-15', 30);

    expect(result).toEqual([]);
  });

  it('getExpiringSoonGrDriverNames includes names within the window and on the exact limit', () => {
    const result = getExpiringSoonGrDriverNames([
      { name: 'Carlos Dias', gr_expiration_date: '2026-06-25' },
      { name: 'Ana Lima', gr_expiration_date: '2026-07-15' },
    ], '2026-06-15', 30);

    expect(result).toEqual(['Carlos Dias', 'Ana Lima']);
  });

  it('getExpiringSoonGrDriverNames excludes expired, null, unnamed and beyond-window entries', () => {
    const result = getExpiringSoonGrDriverNames([
      { name: 'Expirado', gr_expiration_date: '2026-06-14' },
      { name: 'Fora da janela', gr_expiration_date: '2026-07-16' },
      { name: null, gr_expiration_date: '2026-06-20' },
      { name: 'Sem data', gr_expiration_date: null },
    ], '2026-06-15', 30);

    expect(result).toEqual([]);
  });
});

describe('calculateAverageMaintenanceDays', () => {
  it('retorna média arredondada para OS concluídas com entrada e saída', () => {
    const result = calculateAverageMaintenanceDays([
      { status: 'Concluído', entry_date: '2026-06-01', actual_exit_date: '2026-06-05' },
      { status: 'Concluído', entry_date: '2026-06-10', actual_exit_date: '2026-06-16' },
    ]);
    expect(result).toBe(5);
  });

  it('retorna null quando não há OS concluídas elegíveis', () => {
    const result = calculateAverageMaintenanceDays([
      { status: 'Aguardando orçamento', entry_date: '2026-06-01', actual_exit_date: '2026-06-05' },
    ]);
    expect(result).toBeNull();
  });

  it('ignora OS sem actual_exit_date', () => {
    const result = calculateAverageMaintenanceDays([
      { status: 'Concluído', entry_date: '2026-06-01', actual_exit_date: null },
      { status: 'Concluído', entry_date: '2026-06-10', actual_exit_date: '2026-06-14' },
    ]);
    expect(result).toBe(4);
  });
});

describe('calculateAverageOpenOrderAgeDays', () => {
  it('retorna média de permanência para OS aberta', () => {
    const result = calculateAverageOpenOrderAgeDays([
      { status: 'Serviço em execução', entry_date: '2026-06-03' },
    ], '2026-06-13');
    expect(result).toBe(10);
  });

  it('ignora OS concluídas e canceladas', () => {
    const result = calculateAverageOpenOrderAgeDays([
      { status: 'Concluído', entry_date: '2026-06-01' },
      { status: 'Cancelado', entry_date: '2026-06-01' },
      { status: 'Aguardando aprovação', entry_date: '2026-06-10' },
    ], '2026-06-13');
    expect(result).toBe(3);
  });

  it('retorna null quando não há OS elegíveis', () => {
    const result = calculateAverageOpenOrderAgeDays([
      { status: 'Concluído', entry_date: '2026-06-01' },
      { status: 'Cancelado', entry_date: null },
    ], '2026-06-13');
    expect(result).toBeNull();
  });
});

describe('buildMaintenanceStatusData', () => {
  it('retorna contagens na ordem fixa apenas com value > 0', () => {
    const result = buildMaintenanceStatusData([
      { status: 'Serviço em execução' },
      { status: 'Aguardando aprovação' },
      { status: 'Aguardando aprovação' },
      { status: 'Concluído' },
    ]);
    expect(result).toEqual([
      { name: 'Aguardando aprovação', value: 2 },
      { name: 'Serviço em execução', value: 1 },
    ]);
  });

  it('retorna lista vazia quando não há status ativos do workflow', () => {
    expect(buildMaintenanceStatusData([])).toEqual([]);
  });
});

describe('calculatePreviousPeriodRange', () => {
  it('retorna o período anterior com a mesma duração', () => {
    expect(calculatePreviousPeriodRange('2026-06-01', '2026-06-30')).toEqual({
      from: '2026-05-02',
      to: '2026-05-31',
    });
  });

  it('retorna o dia anterior quando from e to são iguais', () => {
    expect(calculatePreviousPeriodRange('2026-06-13', '2026-06-13')).toEqual({
      from: '2026-06-12',
      to: '2026-06-12',
    });
  });
});

describe('calculateCostVariation', () => {
  it('retorna variação positiva', () => {
    expect(calculateCostVariation(110, 100)).toEqual({ percent: 10, direction: 'up' });
  });

  it('retorna percent null e direção up quando anterior é zero e atual maior que zero', () => {
    expect(calculateCostVariation(100, 0)).toEqual({ percent: null, direction: 'up' });
  });

  it('retorna variação negativa', () => {
    expect(calculateCostVariation(80, 100)).toEqual({ percent: -20, direction: 'down' });
  });
});

describe('countExpiringSoon', () => {
  it('conta data dentro da janela de 30 dias', () => {
    expect(countExpiringSoon(['2026-06-20'], '2026-06-13', 30)).toBe(1);
  });

  it('não conta data já vencida', () => {
    expect(countExpiringSoon(['2026-06-12'], '2026-06-13', 30)).toBe(0);
  });

  it('não conta null', () => {
    expect(countExpiringSoon([null], '2026-06-13', 30)).toBe(0);
  });

  it('não conta data além da janela', () => {
    expect(countExpiringSoon(['2026-07-20'], '2026-06-13', 30)).toBe(0);
  });
});

describe('mapVehicleIdsToPlates', () => {
  it('mapeia ids para placas', () => {
    const plateByVehicleId = new Map([
      ['v1', 'ABC1D23'],
      ['v2', 'DEF4G56'],
    ]);
    expect(mapVehicleIdsToPlates(['v1', 'v2'], plateByVehicleId)).toEqual(['ABC1D23', 'DEF4G56']);
  });

  it('descarta id sem placa no mapa', () => {
    const plateByVehicleId = new Map([
      ['v1', 'ABC1D23'],
      ['v2', null],
    ]);
    expect(mapVehicleIdsToPlates(['v1', 'v2', 'v3'], plateByVehicleId)).toEqual(['ABC1D23']);
  });
});

describe('isCrlvExpired', () => {
  it('data futura próxima: não vencido', () => {
    expect(isCrlvExpired({ crlv_year: '2025', crlv_expiration_date: '2027-01-15' }, '2026', '2026-06-13')).toBe(false);
  });

  it('data passada: vencido por data, mesmo com crlv_year atual', () => {
    expect(isCrlvExpired({ crlv_year: '2026', crlv_expiration_date: '2026-06-10' }, '2026', '2026-06-13')).toBe(true);
  });

  it('sem data + ano antigo: vencido por fallback', () => {
    expect(isCrlvExpired({ crlv_year: '2025', crlv_expiration_date: null }, '2026', '2026-06-13')).toBe(true);
  });

  it('sem data + ano atual: não vencido', () => {
    expect(isCrlvExpired({ crlv_year: '2026', crlv_expiration_date: null }, '2026', '2026-06-13')).toBe(false);
  });

  it('sem data + ano nulo: não vencido', () => {
    expect(isCrlvExpired({ crlv_year: null, crlv_expiration_date: null }, '2026', '2026-06-13')).toBe(false);
  });
});

describe('getExpiredCrlvPlates', () => {
  it('retorna placas de CRLV vencido por data', () => {
    const result = getExpiredCrlvPlates([
      { license_plate: 'ABC1D23', crlv_year: '2026', crlv_expiration_date: '2026-06-10' },
      { license_plate: 'DEF4G56', crlv_year: '2026', crlv_expiration_date: '2026-07-01' },
    ], '2026', '2026-06-13');
    expect(result).toEqual(['ABC1D23']);
  });

  it('ignora ano atual/futuro e placa nula (fallback por ano)', () => {
    const result = getExpiredCrlvPlates([
      { license_plate: null, crlv_year: '2025', crlv_expiration_date: null },
      { license_plate: 'DEF4G56', crlv_year: '2026', crlv_expiration_date: null },
      { license_plate: 'GHI7J89', crlv_year: '2027', crlv_expiration_date: null },
    ], '2026', '2026-06-13');
    expect(result).toEqual([]);
  });

  it('fallback por ano quando sem data', () => {
    const result = getExpiredCrlvPlates([
      { license_plate: 'ABC1D23', crlv_year: '2025', crlv_expiration_date: null },
    ], '2026', '2026-06-13');
    expect(result).toEqual(['ABC1D23']);
  });
});

describe('getExpiringSoonCrlvPlates', () => {
  it('inclui placa com data dentro da janela', () => {
    const result = getExpiringSoonCrlvPlates([
      { license_plate: 'ABC1D23', crlv_expiration_date: '2026-07-10' },
    ], '2026-06-13', 30);
    expect(result).toEqual(['ABC1D23']);
  });

  it('inclui placa com data exatamente no limite da janela', () => {
    const result = getExpiringSoonCrlvPlates([
      { license_plate: 'ABC1D23', crlv_expiration_date: '2026-07-13' },
    ], '2026-06-13', 30);
    expect(result).toEqual(['ABC1D23']);
  });

  it('não inclui placa com data já passada (vencido)', () => {
    const result = getExpiringSoonCrlvPlates([
      { license_plate: 'ABC1D23', crlv_expiration_date: '2026-06-12' },
    ], '2026-06-13', 30);
    expect(result).toEqual([]);
  });

  it('não inclui placa com data nula', () => {
    const result = getExpiringSoonCrlvPlates([
      { license_plate: 'ABC1D23', crlv_expiration_date: null },
    ], '2026-06-13', 30);
    expect(result).toEqual([]);
  });

  it('não inclui placa sem license_plate', () => {
    const result = getExpiringSoonCrlvPlates([
      { license_plate: null, crlv_expiration_date: '2026-07-10' },
    ], '2026-06-13', 30);
    expect(result).toEqual([]);
  });

  it('não inclui placa com data além da janela', () => {
    const result = getExpiringSoonCrlvPlates([
      { license_plate: 'ABC1D23', crlv_expiration_date: '2026-08-01' },
    ], '2026-06-13', 30);
    expect(result).toEqual([]);
  });
});

describe('getExpiredCnhNames', () => {
  it('retorna nomes com CNH vencida', () => {
    const result = getExpiredCnhNames([
      { name: 'Maria Souza', expiration_date: '2026-06-12' },
      { name: 'João Silva', expiration_date: '2026-06-13' },
    ], '2026-06-13');
    expect(result).toEqual(['Maria Souza']);
  });

  it('ignora data nula e nome nulo', () => {
    const result = getExpiredCnhNames([
      { name: 'Maria Souza', expiration_date: null },
      { name: null, expiration_date: '2026-06-12' },
    ], '2026-06-13');
    expect(result).toEqual([]);
  });
});

// ─── Dashboard Fase 3 — Tendência histórica e projeção ────────────────────────

describe('chooseTrendGranularity', () => {
  it('retorna "day" para intervalo de 30 dias', () => {
    expect(chooseTrendGranularity('2026-06-01', '2026-07-01')).toBe('day');
  });

  it('retorna "month" para intervalo de 90 dias', () => {
    expect(chooseTrendGranularity('2026-06-01', '2026-08-30')).toBe('month');
  });

  it('retorna "day" na borda de 62 dias', () => {
    expect(chooseTrendGranularity('2026-06-01', '2026-08-02')).toBe('day');
  });

  it('retorna "month" para 63 dias', () => {
    expect(chooseTrendGranularity('2026-06-01', '2026-08-03')).toBe('month');
  });
});

describe('buildCostTrendSeries', () => {
  it('granularidade "day": soma ordens no dia correto, dia sem ordens com value 0', () => {
    const orders = [
      { entry_date: '2026-06-01', approved_cost: 100 },
      { entry_date: '2026-06-01', approved_cost: 200 },
      { entry_date: '2026-06-03', approved_cost: 50 },
    ];
    const result = buildCostTrendSeries(orders, '2026-06-01', '2026-06-03', 'day');
    expect(result).toEqual([
      { name: '01/06', value: 300 },
      { name: '02/06', value: 0 },
      { name: '03/06', value: 50 },
    ]);
  });

  it('granularidade "day": ignora ordem fora do intervalo', () => {
    const orders = [
      { entry_date: '2026-06-01', approved_cost: 100 },
      { entry_date: '2026-05-31', approved_cost: 200 },
      { entry_date: '2026-06-04', approved_cost: 50 },
    ];
    const result = buildCostTrendSeries(orders, '2026-06-01', '2026-06-03', 'day');
    expect(result).toEqual([
      { name: '01/06', value: 100 },
      { name: '02/06', value: 0 },
      { name: '03/06', value: 0 },
    ]);
  });

  it('granularidade "day": ignora approved_cost nulo ou <= 0', () => {
    const orders = [
      { entry_date: '2026-06-01', approved_cost: null },
      { entry_date: '2026-06-01', approved_cost: 0 },
      { entry_date: '2026-06-01', approved_cost: -10 },
      { entry_date: '2026-06-01', approved_cost: 150 },
    ];
    const result = buildCostTrendSeries(orders, '2026-06-01', '2026-06-01', 'day');
    expect(result).toEqual([{ name: '01/06', value: 150 }]);
  });

  it('granularidade "month": soma por mês em ordem cronológica, mês sem ordens com value 0', () => {
    const orders = [
      { entry_date: '2026-06-15', approved_cost: 100 },
      { entry_date: '2026-07-10', approved_cost: 200 },
      { entry_date: '2026-07-20', approved_cost: 50 },
    ];
    const result = buildCostTrendSeries(orders, '2026-06-01', '2026-08-31', 'month');
    expect(result).toEqual([
      { name: '06/2026', value: 100 },
      { name: '07/2026', value: 250 },
      { name: '08/2026', value: 0 },
    ]);
  });
});

describe('getTrailingMonthKeys', () => {
  it('retorna 3 meses fechados anteriores ao mês corrente', () => {
    expect(getTrailingMonthKeys('2026-06-13', 3)).toEqual([
      '2026-03', '2026-04', '2026-05',
    ]);
  });

  it('virada de ano: retorna meses do ano anterior', () => {
    expect(getTrailingMonthKeys('2026-01-15', 3)).toEqual([
      '2025-10', '2025-11', '2025-12',
    ]);
  });

  it('retorna array vazio quando count é 0', () => {
    expect(getTrailingMonthKeys('2026-06-13', 0)).toEqual([]);
  });
});

describe('sumApprovedCostByMonthKeys', () => {
  it('retorna totais corretos por mês, preservando ordem de monthKeys', () => {
    const orders = [
      { entry_date: '2026-03-10', approved_cost: 100 },
      { entry_date: '2026-04-05', approved_cost: 200 },
      { entry_date: '2026-04-20', approved_cost: 50 },
    ];
    const result = sumApprovedCostByMonthKeys(orders, ['2026-03', '2026-04', '2026-05']);
    expect(result).toEqual([100, 250, 0]);
  });

  it('retorna 0 para mês sem ordens', () => {
    const orders = [
      { entry_date: '2026-03-01', approved_cost: 500 },
    ];
    const result = sumApprovedCostByMonthKeys(orders, ['2026-02', '2026-03', '2026-04']);
    expect(result).toEqual([0, 500, 0]);
  });

  it('retorna array do mesmo tamanho de monthKeys com todos 0 quando orders vazio', () => {
    expect(sumApprovedCostByMonthKeys([], ['2026-03', '2026-04'])).toEqual([0, 0]);
  });
});

describe('calculateMovingAverageProjection', () => {
  it('retorna média arredondada', () => {
    expect(calculateMovingAverageProjection([40000, 50000, 60000])).toBe(50000);
  });

  it('retorna null para array vazio', () => {
    expect(calculateMovingAverageProjection([])).toBeNull();
  });

  it('arredonda para cima quando a média tem 0.5', () => {
    expect(calculateMovingAverageProjection([10000, 10001])).toBe(10001);
  });
});

describe('computeOverdueChecklistVehicleIds', () => {
  it('paridade single-tenant: veículos vencidos conforme intervalos do cliente', () => {
    const clientId = 'client-a';
    const vehicles = [
      { id: 'v1', client_id: clientId },
      { id: 'v2', client_id: clientId },
      { id: 'v3', client_id: clientId },
    ];
    const checklistRows = [
      { vehicle_id: 'v1', context: 'Rotina', completed_at: '2026-06-01T10:00:00Z' },
      { vehicle_id: 'v2', context: 'Rotina', completed_at: '2026-05-01T10:00:00Z' },
    ];
    const intervalsByClient = new Map([
      [clientId, { rotina_day_interval: 30, seguranca_day_interval: null }],
    ]);
    const today = new Date('2026-06-14T12:00:00Z');
    const result = computeOverdueChecklistVehicleIds({ vehicles, checklistRows, intervalsByClient, today });
    expect(result.has('v1')).toBe(false);
    expect(result.has('v2')).toBe(true);
    expect(result.has('v3')).toBe(true);
  });

  it('cross-tenant com intervalos distintos: cada veículo usa intervalo do seu cliente', () => {
    const clientA = 'client-a';
    const clientB = 'client-b';
    const vehicles = [
      { id: 'v1', client_id: clientA },
      { id: 'v2', client_id: clientB },
    ];
    const checklistRows = [
      { vehicle_id: 'v1', context: 'Rotina', completed_at: '2026-06-01T10:00:00Z' },
      { vehicle_id: 'v2', context: 'Rotina', completed_at: '2026-06-01T10:00:00Z' },
    ];
    const intervalsByClient = new Map([
      [clientA, { rotina_day_interval: 10, seguranca_day_interval: null }],
      [clientB, { rotina_day_interval: 90, seguranca_day_interval: null }],
    ]);
    const today = new Date('2026-06-14T12:00:00Z');
    const result = computeOverdueChecklistVehicleIds({ vehicles, checklistRows, intervalsByClient, today });
    expect(result.has('v1')).toBe(true);
    expect(result.has('v2')).toBe(false);
  });

  it('veículo sem checklist registrado conta como vencido quando há intervalo definido', () => {
    const clientId = 'client-a';
    const vehicles = [
      { id: 'v1', client_id: clientId },
    ];
    const checklistRows: { vehicle_id: string; context: string; completed_at: string }[] = [];
    const intervalsByClient = new Map([
      [clientId, { rotina_day_interval: 30, seguranca_day_interval: null }],
    ]);
    const today = new Date('2026-06-14T12:00:00Z');
    const result = computeOverdueChecklistVehicleIds({ vehicles, checklistRows, intervalsByClient, today });
    expect(result.has('v1')).toBe(true);
  });

  it('veículo cujo cliente não tem intervalos não conta como vencido', () => {
    const clientA = 'client-a';
    const vehicles = [
      { id: 'v1', client_id: clientA },
    ];
    const checklistRows: { vehicle_id: string; context: string; completed_at: string }[] = [];
    const intervalsByClient = new Map<string, { rotina_day_interval: number | null; seguranca_day_interval: number | null }>();
    const today = new Date('2026-06-14T12:00:00Z');
    const result = computeOverdueChecklistVehicleIds({ vehicles, checklistRows, intervalsByClient, today });
    expect(result.has('v1')).toBe(false);
  });

  it('veículo sem client_id não conta como vencido', () => {
    const vehicles = [
      { id: 'v1', client_id: null },
    ];
    const checklistRows: { vehicle_id: string; context: string; completed_at: string }[] = [];
    const intervalsByClient = new Map<string, { rotina_day_interval: number | null; seguranca_day_interval: number | null }>();
    const today = new Date('2026-06-14T12:00:00Z');
    const result = computeOverdueChecklistVehicleIds({ vehicles, checklistRows, intervalsByClient, today });
    expect(result.has('v1')).toBe(false);
  });
});

// ─── Dashboard Evolução — Indicadores mensais ────────────────────────────────

describe('resolveHorizonRange', () => {
  it('6m em junho/2026 retorna jan a jun', () => {
    expect(resolveHorizonRange('6m', '2026-06-19')).toEqual({
      from: '2026-01-01',
      to: '2026-06-30',
    });
  });

  it('3m em junho/2026 retorna abr a jun', () => {
    expect(resolveHorizonRange('3m', '2026-06-19')).toEqual({
      from: '2026-04-01',
      to: '2026-06-30',
    });
  });

  it('12m em junho/2026 retorna jul/2025 a jun/2026', () => {
    expect(resolveHorizonRange('12m', '2026-06-19')).toEqual({
      from: '2025-07-01',
      to: '2026-06-30',
    });
  });

  it('current_year em junho/2026 retorna jan a jun', () => {
    expect(resolveHorizonRange('current_year', '2026-06-19')).toEqual({
      from: '2026-01-01',
      to: '2026-06-30',
    });
  });

  it('3m em janeiro/2026 (virada de ano) retorna nov/2025 a jan/2026', () => {
    expect(resolveHorizonRange('3m', '2026-01-15')).toEqual({
      from: '2025-11-01',
      to: '2026-01-31',
    });
  });
});

describe('buildMonthlyOrderCounts', () => {
  it('OS aberta em abril e concluída em maio conta opened no mês 04 e completed no mês 05', () => {
    const orders = [
      { status: 'Concluído', entry_date: '2026-04-10', actual_exit_date: '2026-05-15' },
    ];
    const result = buildMonthlyOrderCounts(orders, '2026-04-01', '2026-05-31');
    expect(result).toEqual([
      { name: '04/2026', opened: 1, completed: 0 },
      { name: '05/2026', opened: 0, completed: 1 },
    ]);
  });

  it('OS sem actual_exit_date ou não Concluído não conta em completed', () => {
    const orders = [
      { status: 'Aguardando orçamento', entry_date: '2026-04-10', actual_exit_date: null },
      { status: 'Concluído', entry_date: '2026-04-10', actual_exit_date: null },
    ];
    const result = buildMonthlyOrderCounts(orders, '2026-04-01', '2026-04-30');
    expect(result).toEqual([{ name: '04/2026', opened: 2, completed: 0 }]);
  });

  it('Mês sem OS retorna opened: 0, completed: 0', () => {
    const orders: { status: string; entry_date: string | null; actual_exit_date: string | null }[] = [];
    const result = buildMonthlyOrderCounts(orders, '2026-04-01', '2026-05-31');
    expect(result).toEqual([
      { name: '04/2026', opened: 0, completed: 0 },
      { name: '05/2026', opened: 0, completed: 0 },
    ]);
  });
});

describe('buildMonthlyAverageCompletionDays', () => {
  it('Duas OS concluídas no mesmo mês com 4 e 6 dias retorna value: 5', () => {
    const orders = [
      { status: 'Concluído', entry_date: '2026-04-01', actual_exit_date: '2026-04-05' },
      { status: 'Concluído', entry_date: '2026-04-02', actual_exit_date: '2026-04-08' },
    ];
    const result = buildMonthlyAverageCompletionDays(orders, '2026-04-01', '2026-04-30');
    expect(result).toEqual([{ name: '04/2026', value: 5 }]);
  });

  it('Mês sem conclusão retorna value: 0', () => {
    const orders: { status: string; entry_date: string | null; actual_exit_date: string | null }[] = [];
    const result = buildMonthlyAverageCompletionDays(orders, '2026-04-01', '2026-04-30');
    expect(result).toEqual([{ name: '04/2026', value: 0 }]);
  });

  it('OS sem actual_exit_date ou não Concluído é ignorada', () => {
    const orders = [
      { status: 'Aguardando orçamento', entry_date: '2026-04-01', actual_exit_date: '2026-04-05' },
      { status: 'Concluído', entry_date: '2026-04-01', actual_exit_date: null },
      { status: 'Concluído', entry_date: '2026-04-01', actual_exit_date: '2026-04-10' },
    ];
    const result = buildMonthlyAverageCompletionDays(orders, '2026-04-01', '2026-04-30');
    expect(result).toEqual([{ name: '04/2026', value: 9 }]);
  });
});

describe('buildMonthlyMaintenanceTypeCounts', () => {
  it('Mês com 2 Corretivas + 1 Preventiva retorna contadores corretos', () => {
    const orders = [
      { type: 'Corretiva' as const, entry_date: '2026-04-01' },
      { type: 'Corretiva' as const, entry_date: '2026-04-10' },
      { type: 'Preventiva' as const, entry_date: '2026-04-15' },
    ];
    const result = buildMonthlyMaintenanceTypeCounts(orders, '2026-04-01', '2026-04-30');
    expect(result).toEqual([
      { name: '04/2026', Corretiva: 2, Preventiva: 1, Preditiva: 0 },
    ]);
  });
});

describe('Conformidade documental', () => {
  it('isBlank trata null, undefined e strings em branco como ausente', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('file.pdf')).toBe(false);
  });

  it('getExpiredGrVehiclePlates retorna apenas placas com GR vencida', () => {
    expect(getExpiredGrVehiclePlates([
      { license_plate: 'ABC1D23', gr_expiration_date: '2026-06-10' },
      { license_plate: 'DEF4G56', gr_expiration_date: '2026-06-25' },
    ], '2026-06-20')).toEqual(['ABC1D23']);
  });

  it('getExpiredGrVehiclePlates retorna vazio para lista vazia', () => {
    expect(getExpiredGrVehiclePlates([], '2026-06-20')).toEqual([]);
  });

  it('getExpiredGrVehiclePlates não considera data igual a hoje como vencida', () => {
    expect(getExpiredGrVehiclePlates([
      { license_plate: 'ABC1D23', gr_expiration_date: '2026-06-20' },
    ], '2026-06-20')).toEqual([]);
  });

  it('getDriversWithVehicleMissingGrNames inclui apenas motorista com veículo e sem GR', () => {
    expect(getDriversWithVehicleMissingGrNames([
      { id: 'd1', name: 'Maria', gr_upload: '' },
      { id: 'd2', name: 'João', gr_upload: '' },
      { id: 'd3', name: 'Ana', gr_upload: 'gr.pdf' },
    ], new Set(['d1', 'd3']))).toEqual(['Maria']);
  });

  it('getVehiclesMissingInsurancePlates inclui false, null e undefined e exclui true', () => {
    expect(getVehiclesMissingInsurancePlates([
      { license_plate: 'ABC1D23', has_insurance: false },
      { license_plate: 'DEF4G56', has_insurance: null },
      { license_plate: 'GHI7J89', has_insurance: undefined },
      { license_plate: 'JKL0M12', has_insurance: true },
    ])).toEqual(['ABC1D23', 'DEF4G56', 'GHI7J89']);
  });

  it('helpers de documentos ausentes tratam string vazia e em branco como ausente', () => {
    expect(getVehiclesMissingCrlvUploadPlates([
      { license_plate: 'ABC1D23', crlv_upload: '' },
      { license_plate: 'DEF4G56', crlv_upload: '   ' },
      { license_plate: 'GHI7J89', crlv_upload: 'crlv.pdf' },
    ])).toEqual(['ABC1D23', 'DEF4G56']);

    expect(getVehiclesMissingGrPlates([
      { license_plate: 'ABC1D23', gr_upload: '' },
      { license_plate: 'DEF4G56', gr_upload: '   ' },
      { license_plate: 'GHI7J89', gr_upload: 'gr.pdf' },
    ])).toEqual(['ABC1D23', 'DEF4G56']);

    expect(getDriversMissingCnhUploadNames([
      { name: 'Maria', cnh_upload: '' },
      { name: 'João', cnh_upload: '   ' },
      { name: 'Ana', cnh_upload: 'cnh.pdf' },
    ])).toEqual(['Maria', 'João']);
  });

  it('isVehicleDocumentallyIrregular retorna false para veículo em dia', () => {
    expect(isVehicleDocumentallyIrregular({
      id: 'v1',
      type: 'Truck',
      crlv_year: '2026',
      crlv_expiration_date: '2026-12-31',
      driver_id: 'd1',
      gr_expiration_date: '2026-12-31',
      crlv_upload: 'crlv.pdf',
      gr_upload: 'gr.pdf',
      has_insurance: true,
      has_maintenance_contract: true,
    }, '2026', '2026-06-20', 30)).toBe(false);
  });

  it('isVehicleDocumentallyIrregular retorna true com uma pendência de cada tipo', () => {
    const today = '2026-06-20';
    expect(isVehicleDocumentallyIrregular({ id: '1', type: 'Truck', crlv_year: '2025', crlv_expiration_date: null, driver_id: null }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '2', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-06-25', driver_id: null }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '3', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, gr_expiration_date: '2026-06-10' }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '4', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, gr_expiration_date: '2026-06-25' }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '5', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, crlv_upload: '' }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '6', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, crlv_upload: 'crlv.pdf', gr_upload: '' }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '7', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, crlv_upload: 'crlv.pdf', gr_upload: 'gr.pdf', has_insurance: false }, '2026', today, 30)).toBe(true);
    expect(isVehicleDocumentallyIrregular({ id: '8', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, crlv_upload: 'crlv.pdf', gr_upload: 'gr.pdf', has_insurance: true, has_maintenance_contract: false }, '2026', today, 30)).toBe(true);
  });

  it('isDriverDocumentallyIrregular retorna false para motorista em dia', () => {
    expect(isDriverDocumentallyIrregular({
      id: 'd1',
      expiration_date: '2026-12-31',
      gr_expiration_date: '2026-12-31',
      cnh_upload: 'cnh.pdf',
      gr_upload: 'gr.pdf',
    }, new Set(['d1']), '2026-06-20', 30)).toBe(false);
  });

  it('isDriverDocumentallyIrregular retorna true com uma pendência de cada tipo', () => {
    const today = '2026-06-20';
    expect(isDriverDocumentallyIrregular({ id: '1', expiration_date: '2026-06-10', gr_expiration_date: null, cnh_upload: 'cnh.pdf', gr_upload: 'gr.pdf' }, new Set(), today, 30)).toBe(true);
    expect(isDriverDocumentallyIrregular({ id: '2', expiration_date: '2026-06-25', gr_expiration_date: null, cnh_upload: 'cnh.pdf', gr_upload: 'gr.pdf' }, new Set(), today, 30)).toBe(true);
    expect(isDriverDocumentallyIrregular({ id: '3', expiration_date: '2026-12-31', gr_expiration_date: null, cnh_upload: '', gr_upload: 'gr.pdf' }, new Set(), today, 30)).toBe(true);
    expect(isDriverDocumentallyIrregular({ id: '4', expiration_date: '2026-12-31', gr_expiration_date: '2026-06-10', cnh_upload: 'cnh.pdf', gr_upload: 'gr.pdf' }, new Set(), today, 30)).toBe(true);
    expect(isDriverDocumentallyIrregular({ id: '5', expiration_date: '2026-12-31', gr_expiration_date: '2026-06-25', cnh_upload: 'cnh.pdf', gr_upload: 'gr.pdf' }, new Set(), today, 30)).toBe(true);
    expect(isDriverDocumentallyIrregular({ id: '6', expiration_date: '2026-12-31', gr_expiration_date: null, cnh_upload: 'cnh.pdf', gr_upload: '' }, new Set(['6']), today, 30)).toBe(true);
  });

  it('countIrregularVehicles e countIrregularDrivers contam somente os irregulares', () => {
    expect(countIrregularVehicles([
      { id: 'v1', type: 'Truck', crlv_year: '2026', crlv_expiration_date: '2026-12-31', driver_id: null, crlv_upload: 'crlv.pdf', gr_upload: 'gr.pdf', has_insurance: true, has_maintenance_contract: true },
      { id: 'v2', type: 'Truck', crlv_year: '2025', crlv_expiration_date: null, driver_id: null },
    ], '2026', '2026-06-20', 30)).toBe(1);

    expect(countIrregularDrivers([
      { id: 'd1', expiration_date: '2026-12-31', gr_expiration_date: null, cnh_upload: 'cnh.pdf', gr_upload: 'gr.pdf' },
      { id: 'd2', expiration_date: '2026-06-10', gr_expiration_date: null, cnh_upload: 'cnh.pdf', gr_upload: 'gr.pdf' },
    ], new Set(['d1', 'd2']), '2026-06-20', 30)).toBe(1);
  });

  it('calculateDocumentaryComplianceRate aplica fórmula, zero-case e clamp', () => {
    expect(calculateDocumentaryComplianceRate(10, 2)).toBe(80);
    expect(calculateDocumentaryComplianceRate(0, 0)).toBe(100);
    expect(calculateDocumentaryComplianceRate(10, -5)).toBe(100);
    expect(calculateDocumentaryComplianceRate(10, 20)).toBe(0);
  });

  it('buildComplianceActionQueue omite count 0, ordena high antes de medium e retorna vazio quando não há itens', () => {
    expect(buildComplianceActionQueue({
      crlvExpired: [], cnhExpired: [], grVehicleExpired: [], grDriverExpired: [],
      crlvExpiring: [], cnhExpiring: [], grVehicleExpiring: [], grDriverExpiring: [],
      crlvMissing: [], cnhMissing: [], grVehicleMissing: [], grDriverMissing: [],
      insuranceMissing: [], maintenanceContractMissing: [],
    })).toEqual([]);

    const queue = buildComplianceActionQueue({
      crlvExpired: ['ABC1D23'],
      cnhExpired: [],
      grVehicleExpired: [],
      grDriverExpired: [],
      crlvExpiring: ['DEF4G56'],
      cnhExpiring: [],
      grVehicleExpiring: [],
      grDriverExpiring: [],
      crlvMissing: [],
      cnhMissing: [],
      grVehicleMissing: [],
      grDriverMissing: [],
      insuranceMissing: [],
      maintenanceContractMissing: [],
    });

    expect(queue.map((item) => item.category)).toEqual(['crlv_expired', 'crlv_expiring']);
    expect(queue[0].severity).toBe('high');
    expect(queue[1].severity).toBe('medium');
  });

  it('buildComplianceActionQueue valida os 14 labels', () => {
    const queue = buildComplianceActionQueue({
      crlvExpired: ['1'],
      cnhExpired: ['1'],
      grVehicleExpired: ['1'],
      grDriverExpired: ['1'],
      crlvExpiring: ['1'],
      cnhExpiring: ['1'],
      grVehicleExpiring: ['1'],
      grDriverExpiring: ['1'],
      crlvMissing: ['1'],
      cnhMissing: ['1'],
      grVehicleMissing: ['1'],
      grDriverMissing: ['1'],
      insuranceMissing: ['1'],
      maintenanceContractMissing: ['1'],
    });

    expect(queue.map((item) => item.label)).toEqual([
      'Veículos com CRLV Vencido',
      'Motoristas com CNH Vencida',
      'GR de Veículo Vencida',
      'GR de Motorista Vencida',
      'Veículos sem CRLV Anexado',
      'Motoristas sem CNH Anexada',
      'Veículos sem GR',
      'Motoristas sem GR',
      'Veículo sem Apólice de Seguro',
      'Veículo sem Contrato de Manutenção',
      'CRLV a Vencer em 30 dias',
      'CNH a Vencer em 30 dias',
      'GR de Veículo a Vencer em 30 dias',
      'GR de Motorista a Vencer em 30 dias',
    ]);
  });

  it('getExpiredGrDriverNames e getVehiclesMissingMaintenanceContractPlates retornam apenas entradas válidas', () => {
    expect(getExpiredGrDriverNames([
      { name: 'Maria', gr_expiration_date: '2026-06-10' },
      { name: 'João', gr_expiration_date: '2026-06-25' },
    ], '2026-06-20')).toEqual(['Maria']);

    expect(getVehiclesMissingMaintenanceContractPlates([
      { license_plate: 'ABC1D23', has_maintenance_contract: false },
      { license_plate: 'DEF4G56', has_maintenance_contract: null },
      { license_plate: 'GHI7J89', has_maintenance_contract: true },
    ])).toEqual(['ABC1D23', 'DEF4G56']);
  });
});

describe('buildCostByVehicleAttribute', () => {
  const vehicles = [
    { id: 'v1', category: 'Pesado', model: 'Atego', shipper_name: 'Alpha', operational_unit_name: 'Campinas' },
    { id: 'v2', category: 'Leve', model: 'Daily', shipper_name: 'Beta', operational_unit_name: 'Santos' },
    { id: 'v3', category: 'Pesado', model: null, shipper_name: 'Alpha', operational_unit_name: 'Campinas' },
  ];

  const orders = [
    { vehicle_id: 'v1', approved_cost: 1000, status: 'Orçamento aprovado' },
    { vehicle_id: 'v2', approved_cost: 500, status: 'Orçamento aprovado' },
    { vehicle_id: 'v3', approved_cost: 300, status: 'Orçamento aprovado' },
    { vehicle_id: 'v1', approved_cost: 200, status: 'Cancelado' },
    { vehicle_id: 'v2', approved_cost: 0, status: 'Orçamento aprovado' },
  ];

  it('soma custo por categoria corretamente, ordenado desc', () => {
    const result = buildCostByVehicleAttribute(vehicles, orders, 'category', 'Sem Categoria');
    expect(result).toEqual([
      { name: 'Pesado', value: 1300 },
      { name: 'Leve', value: 500 },
    ]);
  });

  it('fallback para modelo null agrupa em label customizado', () => {
    const result = buildCostByVehicleAttribute(vehicles, orders, 'model', 'Sem Modelo');
    expect(result).toContainEqual({ name: 'Sem Modelo', value: 300 });
    expect(result).toContainEqual({ name: 'Atego', value: 1000 });
    expect(result).toContainEqual({ name: 'Daily', value: 500 });
  });

  it('ignora ordens Cancelado e approved_cost <= 0', () => {
    const result = buildCostByVehicleAttribute(vehicles, orders, 'shipper_name', 'Sem Embarcador');
    expect(result).toEqual([
      { name: 'Alpha', value: 1300 },
      { name: 'Beta', value: 500 },
    ]);
  });
});

describe('buildCostBySystemData', () => {
  it('rateia approved_cost proporcionalmente aos itens de orçamento', () => {
    const orders = [
      { id: 'os1', approved_cost: 1000, status: 'Orçamento aprovado' },
    ];
    const budgetItems: BudgetItemForCost[] = [
      { maintenance_order_id: 'os1', system: 'Motor', value: 600 },
      { maintenance_order_id: 'os1', system: 'Sistema de Freio', value: 400 },
    ];

    const result = buildCostBySystemData(orders, budgetItems);
    expect(result).toEqual([
      { name: 'Motor', value: 600 },
      { name: 'Sistema de Freio', value: 400 },
    ]);
  });

  it('system null normaliza para Outros', () => {
    const orders = [
      { id: 'os1', approved_cost: 500, status: 'Orçamento aprovado' },
    ];
    const budgetItems: BudgetItemForCost[] = [
      { maintenance_order_id: 'os1', system: null, value: 500 },
    ];

    const result = buildCostBySystemData(orders, budgetItems);
    expect(result).toEqual([{ name: 'Outros', value: 500 }]);
  });

  it('OS aprovada sem itens vai inteira para Outros', () => {
    const orders = [
      { id: 'os1', approved_cost: 800, status: 'Orçamento aprovado' },
    ];
    const budgetItems: BudgetItemForCost[] = [];

    const result = buildCostBySystemData(orders, budgetItems);
    expect(result).toEqual([{ name: 'Outros', value: 800 }]);
  });

  it('invariante: soma dos valores == sumApprovedMaintenanceCost', () => {
    const orders = [
      { id: 'os1', approved_cost: 1000, status: 'Orçamento aprovado' },
      { id: 'os2', approved_cost: 500, status: 'Orçamento aprovado' },
      { id: 'os3', approved_cost: 200, status: 'Cancelado' },
    ];
    const budgetItems: BudgetItemForCost[] = [
      { maintenance_order_id: 'os1', system: 'Motor', value: 700 },
      { maintenance_order_id: 'os1', system: 'Suspensão', value: 300 },
      { maintenance_order_id: 'os2', system: 'Motor', value: 500 },
    ];

    const result = buildCostBySystemData(orders, budgetItems);
    const totalSystemCost = result.reduce((sum, item) => sum + item.value, 0);
    const expectedTotal = sumApprovedMaintenanceCost(orders);
    expect(Math.abs(totalSystemCost - expectedTotal)).toBeLessThan(0.01);
  });
});

describe('buildVehicleFinancialRanking', () => {
  const vehicles = [
    { id: 'v1', license_plate: 'ABC1D23', model: 'Atego' },
    { id: 'v2', license_plate: 'DEF4G56', model: 'Daily' },
    { id: 'v3', license_plate: null, model: 'Actros' },
  ];

  const orders = [
    { vehicle_id: 'v1', type: 'Corretiva' as const, approved_cost: 1000, status: 'Orçamento aprovado' },
    { vehicle_id: 'v1', type: 'Corretiva' as const, approved_cost: 500, status: 'Orçamento aprovado' },
    { vehicle_id: 'v1', type: 'Preventiva' as const, approved_cost: 300, status: 'Orçamento aprovado' },
    { vehicle_id: 'v2', type: 'Preventiva' as const, approved_cost: 200, status: 'Orçamento aprovado' },
    { vehicle_id: 'v3', type: 'Corretiva' as const, approved_cost: 800, status: 'Orçamento aprovado' },
  ];

  it('cenário feliz: agrega métricas corretamente com KM válido', () => {
    const vehicleKmRows = [
      { vehicle_id: 'v1', km_driven: 1000 },
      { vehicle_id: 'v2', km_driven: 500 },
    ];

    const result = buildVehicleFinancialRanking({ filteredVehicles: vehicles, filteredOrders: orders, vehicleKmRows });

    const v1Row = result.find((r) => r.vehicleId === 'v1');
    expect(v1Row.totalCost).toBe(1800);
    expect(v1Row.orderCount).toBe(3);
    expect(v1Row.correctiveOrderCount).toBe(2);
    expect(v1Row.kmDriven).toBe(1000);
    expect(v1Row.costPerKm).toBe(1.8);
  });

  it('veículo sem KM: kmDriven=null, costPerKm=null, ainda presente', () => {
    const vehicleKmRows = [
      { vehicle_id: 'v1', km_driven: 1000 },
      { vehicle_id: 'v2', km_driven: 0 },
    ];

    const result = buildVehicleFinancialRanking({ filteredVehicles: vehicles, filteredOrders: orders, vehicleKmRows });

    const v3Row = result.find((r) => r.vehicleId === 'v3');
    expect(v3Row.totalCost).toBe(800);
    expect(v3Row.kmDriven).toBeNull();
    expect(v3Row.costPerKm).toBeNull();

    const v2Row = result.find((r) => r.vehicleId === 'v2');
    expect(v2Row.kmDriven).toBeNull();
    expect(v2Row.costPerKm).toBeNull();
  });

  it('ordenação: maior totalCost primeiro, depois correctiveOrderCount, depois placa', () => {
    const vehicleKmRows = [
      { vehicle_id: 'v1', km_driven: 1000 },
      { vehicle_id: 'v2', km_driven: 500 },
      { vehicle_id: 'v3', km_driven: 800 },
    ];

    const result = buildVehicleFinancialRanking({ filteredVehicles: vehicles, filteredOrders: orders, vehicleKmRows });
    expect(result[0].vehicleId).toBe('v1');
    expect(result[1].vehicleId).toBe('v3');
    expect(result[2].vehicleId).toBe('v2');
  });
});
