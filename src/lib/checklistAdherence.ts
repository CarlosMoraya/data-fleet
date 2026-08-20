import {
  calculateChecklistComplianceRate,
  daysBetween,
  type ChecklistAdherenceContext,
  type ChecklistDayIntervalsByContext,
  type OverdueChecklistSets,
} from './dashboardKpi';
import { OVERVIEW_DIMENSIONS, resolveDimensionValue, type OverviewDimension } from './overviewFleetFilters';

import type { VehicleRow } from '../components/dashboard/OperationalPanel';

export interface AdherenceVehicle {
  id: string;
  license_plate: string | null;
  brand: string | null;
  model: string | null;
  driver_name: string | null;
  shipper_name: string | null;
  operational_unit_name: string | null;
}

export interface AdherenceCardData {
  context: ChecklistAdherenceContext;
  label: string;
  isConfigured: boolean;
  dayInterval: number | null;
  totalActiveVehicles: number;
  overdueCount: number;
  adherenceRate: number | null;
}

export interface AdherenceGroupSlice {
  name: string;
  value: number;
  adherenceRate: number;
}

export interface AdherenceTableRow {
  vehicleId: string;
  licensePlate: string;
  vehicleLabel: string;
  contextLabel: string;
  lastCompletedAt: string | null;
  daysOverdue: number | null;
  driverName: string;
  shipperName: string;
  operationalUnitName: string;
  checklistId: string | null;
}

export const ADHERENCE_CONTEXT_LABELS: Record<ChecklistAdherenceContext, string> = {
  rotina: 'Rotina',
  seguranca: 'Segurança',
  auditoria: 'Auditoria',
};

const INTERVAL_FIELD_BY_CONTEXT: Record<ChecklistAdherenceContext, keyof ChecklistDayIntervalsByContext> = {
  rotina: 'rotina_day_interval',
  seguranca: 'seguranca_day_interval',
  auditoria: 'auditoria_day_interval',
};

const DIMENSION_KEY_BY_GROUP = { shipper: 'shipper', operationalUnit: 'operationalUnit' } as const;

const EMPTY_LABEL = '—';

function findDimension(key: 'shipper' | 'operationalUnit'): OverviewDimension {
  const dimension = OVERVIEW_DIMENSIONS.find((d) => d.key === DIMENSION_KEY_BY_GROUP[key]);
  if (!dimension) throw new Error(`Dimensão de agrupamento desconhecida: ${key}`);
  return dimension;
}

// `resolveDimensionValue` declara `VehicleRow`, mas as dimensões `shipper` e `operationalUnit`
// leem apenas estes dois campos. O estreitamento evita alargar `AdherenceVehicle` para um
// `VehicleRow` completo, sem recorrer a `as any`.
function resolveGroupLabel(
  vehicle: Pick<VehicleRow, 'shipper_name' | 'operational_unit_name'>,
  dimension: OverviewDimension,
): string {
  return resolveDimensionValue(vehicle as VehicleRow, dimension);
}

export function buildAdherenceCards(params: {
  contexts: ChecklistAdherenceContext[];
  overdueSets: OverdueChecklistSets;
  intervals: ChecklistDayIntervalsByContext | undefined;
  totalActiveVehicles: number;
}): AdherenceCardData[] {
  const { contexts, overdueSets, intervals, totalActiveVehicles } = params;
  return contexts.map((context) => {
    const rawInterval = intervals?.[INTERVAL_FIELD_BY_CONTEXT[context]];
    const isConfigured = typeof rawInterval === 'number';
    const overdueCount = isConfigured ? overdueSets[context].size : 0;
    return {
      context,
      label: ADHERENCE_CONTEXT_LABELS[context],
      isConfigured,
      dayInterval: isConfigured ? rawInterval : null,
      totalActiveVehicles,
      overdueCount,
      adherenceRate: isConfigured
        ? calculateChecklistComplianceRate(totalActiveVehicles, overdueCount)
        : null,
    };
  });
}

export function groupOverdueVehiclesByDimension(
  vehicles: AdherenceVehicle[],
  overdueIds: Set<string>,
  dimension: 'shipper' | 'operationalUnit',
): AdherenceGroupSlice[] {
  const overviewDimension = findDimension(dimension);
  const countByName = new Map<string, number>();
  const totalByName = new Map<string, number>();
  for (const vehicle of vehicles) {
    const name = resolveGroupLabel(vehicle, overviewDimension);
    totalByName.set(name, (totalByName.get(name) ?? 0) + 1);
    if (!overdueIds.has(vehicle.id)) continue;
    countByName.set(name, (countByName.get(name) ?? 0) + 1);
  }
  return [...countByName.entries()]
    .map(([name, value]) => ({
      name,
      value,
      adherenceRate: calculateChecklistComplianceRate(totalByName.get(name) ?? 0, value),
    }))
    .sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name, 'pt-BR'));
}

export function filterVehiclesByShipperName(
  vehicles: AdherenceVehicle[],
  shipperName: string,
): AdherenceVehicle[] {
  const dimension = findDimension('shipper');
  return vehicles.filter((v) => resolveGroupLabel(v, dimension) === shipperName);
}

export function buildAdherenceTableRows(params: {
  vehicles: AdherenceVehicle[];
  overdueIds: Set<string>;
  context: ChecklistAdherenceContext;
  dayInterval: number;
  lastByVehicle: Map<string, Partial<Record<ChecklistAdherenceContext, string>>>;
  lastChecklistIdByKey: Map<string, string>;
  today: Date;
}): AdherenceTableRow[] {
  const { vehicles, overdueIds, context, dayInterval, lastByVehicle, lastChecklistIdByKey, today } = params;
  const shipperDimension = findDimension('shipper');
  const unitDimension = findDimension('operationalUnit');

  const rows: AdherenceTableRow[] = [];
  for (const vehicle of vehicles) {
    if (!overdueIds.has(vehicle.id)) continue;
    const lastCompletedAt = lastByVehicle.get(vehicle.id)?.[context] ?? null;
    const brandModel = [vehicle.brand, vehicle.model].filter((part) => part != null && part !== '').join(' ');
    rows.push({
      vehicleId: vehicle.id,
      licensePlate: vehicle.license_plate ?? EMPTY_LABEL,
      vehicleLabel: brandModel === '' ? EMPTY_LABEL : brandModel,
      contextLabel: ADHERENCE_CONTEXT_LABELS[context],
      lastCompletedAt,
      daysOverdue: lastCompletedAt ? daysBetween(new Date(lastCompletedAt), today) - dayInterval : null,
      driverName: vehicle.driver_name ?? EMPTY_LABEL,
      shipperName: resolveGroupLabel(vehicle, shipperDimension),
      operationalUnitName: resolveGroupLabel(vehicle, unitDimension),
      checklistId: lastChecklistIdByKey.get(`${vehicle.id}:${context}`) ?? null,
    });
  }

  // Nunca realizado (null) primeiro — são os casos mais graves —, depois maior atraso.
  return rows.sort((a, b) => {
    if (a.daysOverdue === null && b.daysOverdue === null) return 0;
    if (a.daysOverdue === null) return -1;
    if (b.daysOverdue === null) return 1;
    return b.daysOverdue - a.daysOverdue;
  });
}

export function filterAdherenceRowsByGroup(
  rows: AdherenceTableRow[],
  shipper: string | null,
  operationalUnit: string | null,
): AdherenceTableRow[] {
  return rows.filter(
    (row) =>
      (shipper === null || row.shipperName === shipper) &&
      (operationalUnit === null || row.operationalUnitName === operationalUnit),
  );
}
