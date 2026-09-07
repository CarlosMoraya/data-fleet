import type { FuelSupply } from '../types/fuelSupply';

/** Campos NUMERIC chegam do PostgREST como string; converte e devolve null quando inválido. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Mapeia uma linha de `fuel_supplies` (com joins) para o tipo do frontend. */
export function mapFuelSupplyRow(row: unknown): FuelSupply | null {
  if (row == null || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.plate !== 'string' ||
    typeof record.transaction_date !== 'string'
  ) {
    return null;
  }

  const vehicle = (record.vehicles ?? null) as Record<string, unknown> | null;
  const shipper = (vehicle?.shippers ?? null) as Record<string, unknown> | null;
  const unit = (vehicle?.operational_units ?? null) as Record<string, unknown> | null;
  const hasVehicle = typeof record.vehicle_id === 'string';

  return {
    id: record.id,
    clientId: toText(record.client_id) ?? '',
    vehicleId: hasVehicle ? (record.vehicle_id as string) : null,
    driverId: toText(record.driver_id),
    plate: record.plate,
    driverName: toText(record.driver_name),
    vehicleModel: toText(record.vehicle_model),
    fuelType: toText(record.fuel_type),
    amountLiters: toNumber(record.amount_liters),
    unitValue: toNumber(record.unit_value),
    totalValue: toNumber(record.total_value),
    odometer: toNumber(record.odometer),
    previousOdometer: toNumber(record.previous_odometer),
    kmTraveled: toNumber(record.km_traveled),
    transactionDate: record.transaction_date,
    transactionStatus: toText(record.transaction_status),
    supplyLocation: toText(record.supply_location),
    network: toText(record.network),
    costCenter: toText(record.cost_center),
    baseName: toText(record.base_name),
    cardLast4: toText(record.card_last4),
    shipperId: hasVehicle ? toText(shipper?.id) : null,
    shipperName: hasVehicle ? toText(shipper?.name) : null,
    operationalUnitId: hasVehicle ? toText(unit?.id) : null,
    operationalUnitName: hasVehicle ? toText(unit?.name) : null,
  };
}
