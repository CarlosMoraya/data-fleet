import type { VehicleRow } from '../components/dashboard/OperationalPanel';

export type OverviewFilterKey = 'category' | 'type' | 'model' | 'acquisition' | 'operationalUnit' | 'shipper';

export type OverviewFleetFilters = Record<OverviewFilterKey, string[]>;

export const EMPTY_OVERVIEW_FILTERS: OverviewFleetFilters = {
  category: [],
  type: [],
  model: [],
  acquisition: [],
  operationalUnit: [],
  shipper: [],
};

export const ACQUISITION_LABELS: Record<string, string> = {
  Owned: 'Próprio',
  Rented: 'Alugado',
  Agregado: 'Agregado',
};

export function mapAcquisitionLabel(value: string | null | undefined): string | null {
  if (value == null) return null;
  return ACQUISITION_LABELS[value] ?? null;
}

export interface OverviewDimension {
  key: OverviewFilterKey;
  title: string;
  accessor: (v: VehicleRow) => string | null | undefined;
  fallbackLabel: string;
}

export const OVERVIEW_DIMENSIONS: OverviewDimension[] = [
  {
    key: 'category',
    title: 'Frota por Categoria',
    accessor: (v) => v.category,
    fallbackLabel: 'Sem Categoria',
  },
  {
    key: 'type',
    title: 'Frota por Tipo',
    accessor: (v) => v.type,
    fallbackLabel: 'Sem Tipo',
  },
  {
    key: 'model',
    title: 'Top Modelos da Frota',
    accessor: (v) => v.model,
    fallbackLabel: 'Sem Modelo',
  },
  {
    key: 'acquisition',
    title: 'Próprios x Alugados x Agregados',
    accessor: (v) => mapAcquisitionLabel(v.acquisition),
    fallbackLabel: 'Não Informado',
  },
  {
    key: 'operationalUnit',
    title: 'Frota por Unidade Operacional',
    accessor: (v) => v.operational_unit_name,
    fallbackLabel: 'Sem Unidade',
  },
  {
    key: 'shipper',
    title: 'Frota por Embarcador',
    accessor: (v) => v.shipper_name,
    fallbackLabel: 'Sem Embarcador',
  },
];

export function isFiltersEmpty(filters: OverviewFleetFilters): boolean {
  return (Object.keys(filters) as OverviewFilterKey[]).every((key) => filters[key].length === 0);
}

export function toggleDimensionValue(
  filters: OverviewFleetFilters,
  key: OverviewFilterKey,
  name: string,
  additive: boolean,
): OverviewFleetFilters {
  if (!additive) {
    const current = filters[key];
    if (current.length === 1 && current[0] === name) {
      return { ...filters, [key]: [] };
    }
    return { ...filters, [key]: [name] };
  }

  const current = filters[key];
  const index = current.indexOf(name);
  if (index === -1) {
    return { ...filters, [key]: [...current, name] };
  }
  return { ...filters, [key]: current.filter((_, i) => i !== index) };
}

export function clearDimension(
  filters: OverviewFleetFilters,
  key: OverviewFilterKey,
): OverviewFleetFilters {
  return { ...filters, [key]: [] };
}

export function removeDimensionValue(
  filters: OverviewFleetFilters,
  key: OverviewFilterKey,
  name: string,
): OverviewFleetFilters {
  return { ...filters, [key]: filters[key].filter((v) => v !== name) };
}

export function resolveDimensionValue(vehicle: VehicleRow, dimension: OverviewDimension): string {
  const raw = dimension.accessor(vehicle);
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return dimension.fallbackLabel;
}

export function applyOverviewFleetFilter(
  vehicles: VehicleRow[],
  filters: OverviewFleetFilters,
): VehicleRow[] {
  const activeDimensions = OVERVIEW_DIMENSIONS.filter((d) => filters[d.key].length > 0);
  if (activeDimensions.length === 0) return vehicles;

  return vehicles.filter((vehicle) =>
    activeDimensions.every((dimension) => {
      const value = resolveDimensionValue(vehicle, dimension);
      return filters[dimension.key].includes(value);
    }),
  );
}

export function filtersExcept(
  filters: OverviewFleetFilters,
  key: OverviewFilterKey,
): OverviewFleetFilters {
  return { ...filters, [key]: [] };
}

const INACTIVE_MAINTENANCE_STATUSES = new Set(['Concluído', 'Cancelado', 'Veículo retirado']);

export function countActiveMaintenanceVehiclesByIds(
  orders: { vehicle_id: string; status: string }[],
  allowedVehicleIds: Set<string>,
): number {
  const activeVehicleIds = new Set<string>();
  for (const order of orders) {
    if (INACTIVE_MAINTENANCE_STATUSES.has(order.status)) continue;
    if (allowedVehicleIds.has(order.vehicle_id)) {
      activeVehicleIds.add(order.vehicle_id);
    }
  }
  return activeVehicleIds.size;
}

export function sumApprovedCostByVehicleIds(
  orders: { vehicle_id: string; approved_cost: number | null }[],
  allowedVehicleIds: Set<string>,
): number {
  let sum = 0;
  for (const order of orders) {
    if (!allowedVehicleIds.has(order.vehicle_id)) continue;
    if (order.approved_cost != null && order.approved_cost > 0) {
      sum += order.approved_cost;
    }
  }
  return sum;
}

export function countOverdueChecklistByIds(
  overdueChecklistVehicleIds: Set<string>,
  allowedVehicleIds: Set<string>,
): number {
  let count = 0;
  for (const id of overdueChecklistVehicleIds) {
    if (allowedVehicleIds.has(id)) count++;
  }
  return count;
}

export const AVAILABILITY_AVAILABLE = 'Disponíveis';
export const AVAILABILITY_UNAVAILABLE = 'Indisponíveis';
export type AvailabilityValue = typeof AVAILABILITY_AVAILABLE | typeof AVAILABILITY_UNAVAILABLE;

export function computeUnavailableVehicleIds(
  orders: { vehicle_id: string; status: string }[],
  allowedVehicleIds: Set<string>,
): Set<string> {
  const unavailableIds = new Set<string>();
  for (const order of orders) {
    if (INACTIVE_MAINTENANCE_STATUSES.has(order.status)) continue;
    if (allowedVehicleIds.has(order.vehicle_id)) {
      unavailableIds.add(order.vehicle_id);
    }
  }
  return unavailableIds;
}

export function applyAvailabilityFilter(
  vehicles: VehicleRow[],
  unavailableIds: Set<string>,
  selected: AvailabilityValue[],
): VehicleRow[] {
  if (selected.length === 0 || selected.length === 2) return vehicles;
  if (selected[0] === AVAILABILITY_AVAILABLE) {
    return vehicles.filter((v) => !unavailableIds.has(v.id));
  }
  return vehicles.filter((v) => unavailableIds.has(v.id));
}

export function toggleAvailabilityValue(
  selected: AvailabilityValue[],
  value: AvailabilityValue,
  additive: boolean,
): AvailabilityValue[] {
  if (!additive) {
    if (selected.length === 1 && selected[0] === value) {
      return [];
    }
    return [value];
  }

  const index = selected.indexOf(value);
  if (index === -1) {
    return [...selected, value];
  }
  return selected.filter((_, i) => i !== index);
}

export function buildAvailabilityChartData(
  vehicles: VehicleRow[],
  unavailableIds: Set<string>,
): { name: AvailabilityValue; value: number }[] {
  const unavailableCount = vehicles.filter((v) => unavailableIds.has(v.id)).length;
  const availableCount = vehicles.length - unavailableCount;
  return [
    { name: AVAILABILITY_AVAILABLE, value: availableCount },
    { name: AVAILABILITY_UNAVAILABLE, value: unavailableCount },
  ];
}
