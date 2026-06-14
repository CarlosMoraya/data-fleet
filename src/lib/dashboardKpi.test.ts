import { describe, it, expect } from 'vitest';
import {
  countActiveInMaintenance,
  buildActiveMaintenanceTypeData,
  calculateFleetAvailability,
  countVehiclesInMaintenance,
  calculateChecklistComplianceRate,
  countOverdueMaintenanceOrders,
  countPendingApprovalOrders,
  buildActionQueue,
  calculateAverageMaintenanceDays,
  calculateAverageOpenOrderAgeDays,
  buildMaintenanceStatusData,
  calculatePreviousPeriodRange,
  calculateCostVariation,
  countExpiringSoon,
  mapVehicleIdsToPlates,
  getExpiredCrlvPlates,
  getExpiredCnhNames,
} from './dashboardKpi';

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

describe('buildActionQueue', () => {
  it('retorna 5 itens com high antes de medium, contagens e detalhes preservados', () => {
    const result = buildActionQueue({
      checklist: ['ABC1D23', 'DEF4G56'],
      crlv: ['GHI7J89'],
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
      cnh: [],
      osOverdue: [],
      osPendingApproval: ['ABC1D23', 'DEF4G56', 'GHI7J89'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('os_pending_approval');
    expect(result[0].severity).toBe('medium');
    expect(result[0].details).toEqual(['ABC1D23', 'DEF4G56', 'GHI7J89']);
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

describe('getExpiredCrlvPlates', () => {
  it('retorna placas de CRLV vencido', () => {
    const result = getExpiredCrlvPlates([
      { license_plate: 'ABC1D23', crlv_year: '2025' },
      { license_plate: 'DEF4G56', crlv_year: '2026' },
    ], '2026');
    expect(result).toEqual(['ABC1D23']);
  });

  it('ignora ano atual/futuro e placa nula', () => {
    const result = getExpiredCrlvPlates([
      { license_plate: null, crlv_year: '2025' },
      { license_plate: 'DEF4G56', crlv_year: '2026' },
      { license_plate: 'GHI7J89', crlv_year: '2027' },
    ], '2026');
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
