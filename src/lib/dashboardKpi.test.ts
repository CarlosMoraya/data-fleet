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
  it('retorna 5 itens com high antes de medium quando todas as contagens > 0', () => {
    const result = buildActionQueue({
      overdueChecklistCount: 2,
      expiredCrlvCount: 1,
      expiredCnhCount: 1,
      overdueOsCount: 3,
      pendingApprovalCount: 2,
    });
    expect(result).toHaveLength(5);
    expect(result[0].severity).toBe('high');
    expect(result[1].severity).toBe('high');
    expect(result[2].severity).toBe('high');
    expect(result[3].severity).toBe('high');
    expect(result[4].severity).toBe('medium');
  });

  it('retorna array vazio quando todas as contagens = 0', () => {
    const result = buildActionQueue({
      overdueChecklistCount: 0,
      expiredCrlvCount: 0,
      expiredCnhCount: 0,
      overdueOsCount: 0,
      pendingApprovalCount: 0,
    });
    expect(result).toEqual([]);
  });

  it('retorna 1 item medium quando apenas pendingApprovalCount > 0', () => {
    const result = buildActionQueue({
      overdueChecklistCount: 0,
      expiredCrlvCount: 0,
      expiredCnhCount: 0,
      overdueOsCount: 0,
      pendingApprovalCount: 3,
    });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('os_pending_approval');
    expect(result[0].severity).toBe('medium');
  });
});
