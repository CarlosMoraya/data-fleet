import { Vehicle } from '../types';
import {
  normalizeUpper,
  capitalizeWords,
  commaToFloat,
  normalizeTrim,
} from './inputHelpers';

/** Row retornado pelo Supabase (snake_case) */
export interface VehicleRow {
  id: string;
  client_id: string;
  type: string;
  energy_source: string;
  cooling_equipment: boolean;
  semi_reboque: boolean | null;
  placa_semi_reboque: string | null;
  fuel_type: string | null;
  tank_capacity: number | null;
  avg_consumption: number | null;
  cooling_brand: string | null;
  license_plate: string;
  renavam: string;
  chassi: string;
  detran_uf: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  acquisition: string;
  fipe_price: number;
  tracker: string;
  antt: string;
  owner: string;
  autonomy: number;
  acquisition_date: string | null;
  crlv_upload: string | null;
}

/** Converte row do Supabase (snake_case) para interface Vehicle (camelCase) */
export function vehicleFromRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type as Vehicle['type'],
    energySource: row.energy_source as Vehicle['energySource'],
    coolingEquipment: row.cooling_equipment,
    semiReboque: row.semi_reboque ?? undefined,
    placaSemiReboque: row.placa_semi_reboque ?? undefined,
    fuelType: row.fuel_type ?? undefined,
    tankCapacity: row.tank_capacity ?? undefined,
    avgConsumption: row.avg_consumption ?? undefined,
    coolingBrand: row.cooling_brand ?? undefined,
    licensePlate: row.license_plate,
    renavam: row.renavam,
    chassi: row.chassi,
    detranUF: row.detran_uf,
    brand: row.brand,
    model: row.model,
    year: row.year,
    color: row.color,
    acquisition: row.acquisition as Vehicle['acquisition'],
    fipePrice: row.fipe_price,
    tracker: row.tracker,
    antt: row.antt,
    owner: row.owner,
    autonomy: row.autonomy,
    acquisitionDate: row.acquisition_date ?? undefined,
    crlvUpload: row.crlv_upload ?? undefined,
  };
}

/** Converte Partial<Vehicle> (camelCase) para payload de insert/update (snake_case) com normalização */
export function vehicleToRow(vehicle: Partial<Vehicle>, clientId: string): Omit<VehicleRow, 'id'> {
  return {
    client_id: clientId,
    type: vehicle.type ?? 'Light',
    energy_source: vehicle.energySource ?? 'Combustão',
    cooling_equipment: vehicle.coolingEquipment ?? false,
    semi_reboque: vehicle.semiReboque ?? null,
    placa_semi_reboque: vehicle.placaSemiReboque ? normalizeUpper(vehicle.placaSemiReboque) : null,
    fuel_type: vehicle.fuelType ? capitalizeWords(vehicle.fuelType) : null,
    tank_capacity: vehicle.tankCapacity != null ? commaToFloat(vehicle.tankCapacity) : null,
    avg_consumption: vehicle.avgConsumption != null ? commaToFloat(vehicle.avgConsumption) : null,
    cooling_brand: vehicle.coolingBrand ? capitalizeWords(vehicle.coolingBrand) : null,
    license_plate: normalizeUpper(vehicle.licensePlate),
    renavam: normalizeTrim(vehicle.renavam),
    chassi: normalizeUpper(vehicle.chassi),
    detran_uf: normalizeUpper(vehicle.detranUF),
    brand: normalizeUpper(vehicle.brand),
    model: normalizeUpper(vehicle.model),
    year: vehicle.year != null ? parseInt(String(vehicle.year), 10) : 0,
    color: capitalizeWords(vehicle.color),
    acquisition: vehicle.acquisition ?? 'Owned',
    fipe_price: commaToFloat(vehicle.fipePrice),
    tracker: capitalizeWords(vehicle.tracker),
    antt: normalizeTrim(vehicle.antt),
    owner: capitalizeWords(vehicle.owner),
    autonomy: commaToFloat(vehicle.autonomy),
    acquisition_date: vehicle.acquisitionDate ?? null,
    crlv_upload: vehicle.crlvUpload ?? null,
  };
}
