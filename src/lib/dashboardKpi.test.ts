import { describe, it, expect } from 'vitest';
import { countActiveInMaintenance, buildActiveMaintenanceTypeData } from './dashboardKpi';

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
