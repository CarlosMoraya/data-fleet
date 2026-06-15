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
