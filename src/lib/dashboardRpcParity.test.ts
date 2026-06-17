import { describe, expect, it } from 'vitest';
import {
  calculateMovingAverageProjection,
  computeOverdueChecklistVehicleIds,
  getTrailingMonthKeys,
  sumApprovedCostByMonthKeys,
} from './dashboardKpi';

type CostOrder = { entry_date: string | null; approved_cost: number | null };
type ChecklistHistoryRow = {
  vehicle_id: string;
  context: string;
  completed_at: string;
  odometer_km?: number | null;
};

function reduceToLastChecklistRows(rows: ChecklistHistoryRow[]) {
  const lastByKey = new Map<string, { vehicle_id: string; context: string; completed_at: string }>();

  for (const row of rows) {
    if (!row.vehicle_id || !row.completed_at) continue;
    if (row.context !== 'Rotina' && row.context !== 'Segurança') continue;

    const key = `${row.vehicle_id}:${row.context}`;
    const current = lastByKey.get(key);
    if (!current || row.completed_at > current.completed_at) {
      lastByKey.set(key, {
        vehicle_id: row.vehicle_id,
        context: row.context,
        completed_at: row.completed_at,
      });
    }
  }

  return [...lastByKey.values()];
}

function sumPreviousPeriodClientSide(rows: CostOrder[]) {
  return rows
    .filter((row) => row.approved_cost !== null && row.approved_cost > 0)
    .reduce((sum, row) => sum + (row.approved_cost ?? 0), 0);
}

function calculateTotalKmClientSide(rows: ChecklistHistoryRow[]) {
  const kmsByVehicle = new Map<string, number[]>();

  for (const row of rows) {
    if (row.odometer_km == null) continue;
    const kms = kmsByVehicle.get(row.vehicle_id) ?? [];
    kms.push(row.odometer_km);
    kmsByVehicle.set(row.vehicle_id, kms);
  }

  let totalKm = 0;
  for (const kms of kmsByVehicle.values()) {
    if (kms.length < 2) continue;
    const diff = Math.max(...kms) - Math.min(...kms);
    if (diff > 0) totalKm += diff;
  }

  return totalKm;
}

describe('dashboard RPC parity', () => {
  it('projecao a partir de somas mensais e identica a projecao a partir de linhas brutas', () => {
    const today = '2026-06-17';
    const keys = getTrailingMonthKeys(today, 3);
    const rawOrders: CostOrder[] = [
      { entry_date: '2026-03-03', approved_cost: 100 },
      { entry_date: '2026-03-18', approved_cost: 50 },
      { entry_date: '2026-04-07', approved_cost: 200 },
      { entry_date: '2026-04-19', approved_cost: null },
      { entry_date: '2026-04-22', approved_cost: 0 },
      { entry_date: '2026-04-28', approved_cost: -10 },
    ];
    const rpcRows = [
      { month_key: '2026-03', total: 150 },
      { month_key: '2026-04', total: 200 },
    ];

    const oldMonthlyTotals = sumApprovedCostByMonthKeys(rawOrders, keys);
    const totalByKey = new Map(rpcRows.map((row) => [row.month_key, Number(row.total ?? 0)]));
    const rpcMonthlyTotals = keys.map((key) => totalByKey.get(key) ?? 0);

    expect(rpcMonthlyTotals).toEqual(oldMonthlyTotals);
    expect(calculateMovingAverageProjection(rpcMonthlyTotals)).toBe(
      calculateMovingAverageProjection(oldMonthlyTotals)
    );
  });

  it('soma do periodo anterior e identica entre linhas brutas e retorno escalar', () => {
    const rawOrders: CostOrder[] = [
      { entry_date: '2026-05-02', approved_cost: 300 },
      { entry_date: '2026-05-08', approved_cost: null },
      { entry_date: '2026-05-14', approved_cost: 0 },
      { entry_date: '2026-05-20', approved_cost: -50 },
      { entry_date: '2026-05-27', approved_cost: 125 },
    ];
    const rpcScalar = 425;

    expect(sumPreviousPeriodClientSide(rawOrders)).toBe(rpcScalar);
    expect(sumPreviousPeriodClientSide([])).toBe(0);
    expect(Number(0)).toBe(0);
  });

  it('overdue por ultima checklist e identico entre historico completo e linhas por veiculo/contexto', () => {
    const vehicles = [
      { id: 'v1', client_id: 'client-a' },
      { id: 'v2', client_id: 'client-a' },
      { id: 'v3', client_id: 'client-a' },
    ];
    const intervalsByClient = new Map([
      ['client-a', { rotina_day_interval: 20, seguranca_day_interval: 30 }],
    ]);
    const today = new Date('2026-06-17T12:00:00Z');
    const fullHistory: ChecklistHistoryRow[] = [
      { vehicle_id: 'v1', context: 'Rotina', completed_at: '2026-05-01T10:00:00Z' },
      { vehicle_id: 'v1', context: 'Rotina', completed_at: '2026-06-10T10:00:00Z' },
      { vehicle_id: 'v1', context: 'Segurança', completed_at: '2026-06-02T10:00:00Z' },
      { vehicle_id: 'v2', context: 'Rotina', completed_at: '2026-05-10T10:00:00Z' },
      { vehicle_id: 'v2', context: 'Segurança', completed_at: '2026-05-01T10:00:00Z' },
    ];
    const rpcRows = reduceToLastChecklistRows(fullHistory);

    const oldResult = computeOverdueChecklistVehicleIds({
      vehicles,
      checklistRows: fullHistory,
      intervalsByClient,
      today,
    });
    const rpcResult = computeOverdueChecklistVehicleIds({
      vehicles,
      checklistRows: rpcRows,
      intervalsByClient,
      today,
    });

    expect(rpcResult).toEqual(oldResult);
    expect(rpcResult.has('v3')).toBe(true);
  });

  it('custo por KM e identico entre linhas brutas e km agregado por veiculo', () => {
    const totalCost = 1000;
    const rawChecklists: ChecklistHistoryRow[] = [
      { vehicle_id: 'v1', context: 'Rotina', completed_at: '2026-06-01T10:00:00Z', odometer_km: 1000 },
      { vehicle_id: 'v1', context: 'Rotina', completed_at: '2026-06-15T10:00:00Z', odometer_km: 1450 },
      { vehicle_id: 'v2', context: 'Rotina', completed_at: '2026-06-03T10:00:00Z', odometer_km: 2000 },
      { vehicle_id: 'v2', context: 'Segurança', completed_at: '2026-06-20T10:00:00Z', odometer_km: 2300 },
      { vehicle_id: 'v3', context: 'Rotina', completed_at: '2026-06-08T10:00:00Z', odometer_km: 5000 },
    ];
    const rpcRows = [
      { vehicle_id: 'v1', km_driven: 450 },
      { vehicle_id: 'v2', km_driven: 300 },
    ];

    const oldTotalKm = calculateTotalKmClientSide(rawChecklists);
    const rpcTotalKm = rpcRows.reduce((sum, row) => sum + row.km_driven, 0);

    expect(rpcTotalKm).toBe(oldTotalKm);
    expect(totalCost / rpcTotalKm).toBe(totalCost / oldTotalKm);
  });
});
