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
  crlv_year: string | null;
  tag: string | null;
  sanitary_inspection_upload: string | null;
  spare_key: boolean;
  vehicle_manual: boolean;
  gr_upload: string | null;
  gr_expiration_date: string | null;
  category: string | null;
  driver_id: string | null;
  shipper_id: string | null;
  operational_unit_id: string | null;
  pbt: number | null;
  cmt: number | null;
  eixos: number | null;
  warranty: boolean;
  warranty_end_date: string | null;
  first_revision_max_km: number | null;
  first_revision_deadline: string | null;
  cooling_first_revision_deadline: string | null;
  has_insurance: boolean;
  insurance_policy_upload: string | null;
  has_maintenance_contract: boolean;
  maintenance_contract_upload: string | null;
  vehicle_usage: string | null;
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
    crlvYear: row.crlv_year ?? undefined,
    tag: row.tag ?? undefined,
    sanitaryInspectionUpload: row.sanitary_inspection_upload ?? undefined,
    spareKey: row.spare_key,
    vehicleManual: row.vehicle_manual,
    grUpload: row.gr_upload ?? undefined,
    grExpirationDate: row.gr_expiration_date ?? undefined,
    category: row.category as Vehicle['category'] ?? undefined,
    driverId: row.driver_id ?? undefined,
    driverName: (row as VehicleRow & { drivers?: { name: string } }).drivers?.name ?? undefined,
    shipperId: row.shipper_id ?? undefined,
    shipperName: (row as VehicleRow & { shippers?: { name: string } }).shippers?.name ?? undefined,
    operationalUnitId: row.operational_unit_id ?? undefined,
    operationalUnitName: (row as VehicleRow & { operational_units?: { name: string } }).operational_units?.name ?? undefined,
    pbt: row.pbt ?? undefined,
    cmt: row.cmt ?? undefined,
    eixos: row.eixos ?? undefined,
    warranty: row.warranty ?? false,
    warrantyEndDate: row.warranty_end_date ?? undefined,
    firstRevisionMaxKm: row.first_revision_max_km ?? undefined,
    firstRevisionDeadline: row.first_revision_deadline ?? undefined,
    coolingFirstRevisionDeadline: row.cooling_first_revision_deadline ?? undefined,
    hasInsurance: row.has_insurance ?? false,
    insurancePolicyUpload: row.insurance_policy_upload ?? undefined,
    hasMaintenanceContract: row.has_maintenance_contract ?? false,
    maintenanceContractUpload: row.maintenance_contract_upload ?? undefined,
    vehicleUsage: row.vehicle_usage as Vehicle['vehicleUsage'] ?? undefined,
  };
}

/** Converte Partial<Vehicle> (camelCase) para payload de insert/update (snake_case) com normalização */
export function vehicleToRow(vehicle: Partial<Vehicle>, clientId: string): Omit<VehicleRow, 'id'> {
  return {
    client_id: clientId,
    type: vehicle.type ?? 'Passeio',
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
    crlv_year: vehicle.crlvYear ? normalizeTrim(vehicle.crlvYear) : null,
    tag: vehicle.tag ? normalizeTrim(vehicle.tag) : null,
    sanitary_inspection_upload: vehicle.sanitaryInspectionUpload ?? null,
    spare_key: vehicle.spareKey ?? false,
    vehicle_manual: vehicle.vehicleManual ?? false,
    gr_upload: vehicle.grUpload ?? null,
    gr_expiration_date: vehicle.grExpirationDate ?? null,
    category: vehicle.category ?? null,
    driver_id: vehicle.driverId ?? null,
    shipper_id: vehicle.shipperId ?? null,
    operational_unit_id: vehicle.operationalUnitId ?? null,
    pbt: vehicle.pbt != null ? commaToFloat(vehicle.pbt) : null,
    cmt: vehicle.cmt != null ? commaToFloat(vehicle.cmt) : null,
    eixos: vehicle.eixos != null ? parseInt(String(vehicle.eixos), 10) : null,
    warranty: vehicle.warranty ?? false,
    warranty_end_date: vehicle.warrantyEndDate ?? null,
    first_revision_max_km: vehicle.firstRevisionMaxKm != null ? parseInt(String(vehicle.firstRevisionMaxKm), 10) : null,
    first_revision_deadline: vehicle.firstRevisionDeadline ?? null,
    cooling_first_revision_deadline: vehicle.coolingFirstRevisionDeadline ?? null,
    has_insurance: vehicle.hasInsurance ?? false,
    insurance_policy_upload: vehicle.insurancePolicyUpload ?? null,
    has_maintenance_contract: vehicle.hasMaintenanceContract ?? false,
    maintenance_contract_upload: vehicle.maintenanceContractUpload ?? null,
    vehicle_usage: vehicle.vehicleUsage ?? null,
  };
}
