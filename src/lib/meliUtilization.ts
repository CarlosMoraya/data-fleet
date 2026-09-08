import { filterPlate } from './inputHelpers';
import { computeUnavailableVehicleIds } from './overviewFleetFilters';

import type {
  BuildRowsInput,
  MeliMaintenanceWindow,
  MeliUtilizationKpis,
  MeliUtilizationRow,
  MeliUtilizationStatusFilter,
} from '../types/meliUtilization';

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePlate(value: string): string {
  return filterPlate(value).slice(-7);
}

export function formatOdometerDistanceKm(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function normalizeUnitCode(value: string): string {
  return value.trim().toUpperCase();
}

function describeVehicle(brand: string | null, model: string | null): string {
  return [brand, model].filter((value): value is string => !!value?.trim()).join(' ');
}

function enumerateDates(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function isVehicleUnavailableOnDate(
  windows: MeliMaintenanceWindow[],
  vehicleId: string,
  date: string,
): boolean {
  const allowedVehicleIds = new Set([vehicleId]);
  return windows.some((window) => {
    if (window.vehicleId !== vehicleId) return false;
    if (window.entryDate > date || (window.exitDate !== null && date > window.exitDate)) return false;
    if (window.exitDate === null) return true;
    return computeUnavailableVehicleIds(
      [{ vehicle_id: window.vehicleId, status: window.status }],
      allowedVehicleIds,
    ).has(vehicleId);
  });
}

export function namesDiverge(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return false;
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft !== normalizedRight;
}

export function buildUtilizationRows(input: BuildRowsInput): MeliUtilizationRow[] {
  const dates = enumerateDates(input.from, input.to);
  const dateSet = new Set(dates);
  const vehiclesByPlate = new Map(
    input.vehicles.map((vehicle) => [normalizePlate(vehicle.licensePlate), vehicle]),
  );
  const routeDatesByVehicle = new Map<string, Set<string>>();
  const rows: MeliUtilizationRow[] = [];

  for (const route of input.routes) {
    const vehicle = vehiclesByPlate.get(normalizePlate(route.plate));
    if (!vehicle || !dateSet.has(route.routeDate)) continue;
    const routeDates = routeDatesByVehicle.get(vehicle.id) ?? new Set<string>();
    routeDates.add(route.routeDate);
    routeDatesByVehicle.set(vehicle.id, routeDates);
    const unavailableOnDate = isVehicleUnavailableOnDate(
      input.maintenanceWindows,
      vehicle.id,
      route.routeDate,
    );
    const fleetUnitCode = vehicle.unitCode;
    const unitCode = route.serviceCenter;
    rows.push({
      key: `${vehicle.id}:${route.routeId}`,
      vehicleId: vehicle.id,
      licensePlate: vehicle.licensePlate,
      vehicleDescription: describeVehicle(vehicle.brand, vehicle.model),
      utilized: true,
      routeDate: route.routeDate,
      routeId: route.routeId,
      driverName: route.driverName,
      fleetDriverName: vehicle.driverName,
      driverDivergent: namesDiverge(route.driverName, vehicle.driverName),
      unitCode,
      fleetUnitCode,
      unitDivergent:
        !!unitCode?.trim() &&
        !!fleetUnitCode?.trim() &&
        normalizeUnitCode(unitCode) !== normalizeUnitCode(fleetUnitCode),
      unavailableOnDate,
      statusDivergent: unavailableOnDate,
      cycle: route.cycle,
      odometerDistanceKm: route.odometerDistanceKm,
    });
  }

  for (const vehicle of input.vehicles) {
    const routeDates = routeDatesByVehicle.get(vehicle.id);
    for (const date of dates) {
      if (routeDates?.has(date)) continue;
      const unavailableOnDate = isVehicleUnavailableOnDate(
        input.maintenanceWindows,
        vehicle.id,
        date,
      );
      rows.push({
        key: `${vehicle.id}:${date}:idle`,
        vehicleId: vehicle.id,
        licensePlate: vehicle.licensePlate,
        vehicleDescription: describeVehicle(vehicle.brand, vehicle.model),
        utilized: false,
        routeDate: date,
        routeId: null,
        driverName: null,
        fleetDriverName: vehicle.driverName,
        driverDivergent: false,
        unitCode: vehicle.unitCode,
        fleetUnitCode: vehicle.unitCode,
        unitDivergent: false,
        unavailableOnDate,
        statusDivergent: false,
        cycle: null,
        odometerDistanceKm: null,
      });
    }
  }

  return rows.sort(
    (left, right) =>
      right.routeDate.localeCompare(left.routeDate) ||
      left.licensePlate.localeCompare(right.licensePlate) ||
      (left.routeId ?? '').localeCompare(right.routeId ?? ''),
  );
}

export function calculateUtilizationKpis(rows: MeliUtilizationRow[]): MeliUtilizationKpis {
  const vehicleIds = new Set(rows.map((row) => row.vehicleId));
  const usedVehicleIds = new Set(
    rows.filter((row) => row.utilized).map((row) => row.vehicleId),
  );
  const totalVehicles = vehicleIds.size;
  const usedVehicles = usedVehicleIds.size;
  return {
    totalVehicles,
    usedVehicles,
    unusedVehicles: totalVehicles - usedVehicles,
    utilizationRate:
      totalVehicles === 0 ? 0 : Math.round((usedVehicles / totalVehicles) * 1000) / 10,
  };
}

export function defaultDateRange(today: Date): { from: string; to: string } {
  const previousDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  previousDay.setDate(previousDay.getDate() - 1);
  const date = [
    previousDay.getFullYear(),
    String(previousDay.getMonth() + 1).padStart(2, '0'),
    String(previousDay.getDate()).padStart(2, '0'),
  ].join('-');
  return { from: date, to: date };
}

export function filterRowsByUnit(
  rows: MeliUtilizationRow[],
  unitCodes: string[],
): MeliUtilizationRow[] {
  if (unitCodes.length === 0) return rows;
  const selectedCodes = new Set(unitCodes.map(normalizeUnitCode));
  return rows.filter(
    (row) => row.unitCode !== null && selectedCodes.has(normalizeUnitCode(row.unitCode)),
  );
}

export function filterRowsByPlate(
  rows: MeliUtilizationRow[],
  plateQuery: string,
): MeliUtilizationRow[] {
  const normalizedQuery = normalizePlate(plateQuery);
  if (!normalizedQuery) return rows;
  return rows.filter((row) => normalizePlate(row.licensePlate).includes(normalizedQuery));
}

export function filterRowsByUtilization(
  rows: MeliUtilizationRow[],
  filter: MeliUtilizationStatusFilter,
): MeliUtilizationRow[] {
  if (filter === 'all') return rows;
  const wantUtilized = filter === 'used';
  return rows.filter((row) => row.utilized === wantUtilized);
}

export function parseMeliUtilizationStatusFilter(value: string | null): MeliUtilizationStatusFilter {
  return value === 'used' || value === 'unused' ? value : 'all';
}
