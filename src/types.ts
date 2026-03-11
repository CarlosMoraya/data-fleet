export type Role = 'Driver' | 'Yard Auditor' | 'Fleet Assistant' | 'Fleet Analyst' | 'Manager' | 'Director' | 'Admin Master';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string; // The primary client they belong to
  canDeleteVehicles: boolean;
}

export interface Client {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface Vehicle {
  id: string;
  clientId: string;
  type: 'Passeio' | 'Utilitário' | 'Van' | 'Moto' | 'Vuc' | 'Toco' | 'Truck' | 'Cavalo';
  energySource: 'Combustão' | 'Elétrico' | 'Híbrido';
  coolingEquipment: boolean;
  
  // Conditional fields
  semiReboque?: boolean;
  placaSemiReboque?: string;
  fuelType?: string;
  tankCapacity?: number;
  avgConsumption?: number;
  coolingBrand?: string;

  // Additional fields
  licensePlate: string;
  renavam: string;
  chassi: string;
  detranUF: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  acquisition: 'Owned' | 'Rented';
  fipePrice: number;
  tracker: string;
  antt: string;
  owner: string;
  autonomy: number;
  acquisitionDate?: string;
  crlvUpload?: string;
  status?: 'Available' | 'In Use' | 'Maintenance';

  // New fields
  tag?: string;
  sanitaryInspectionUpload?: string;
  spareKey?: boolean;
  vehicleManual?: boolean;
  grUpload?: string;
  grExpirationDate?: string;
  category?: 'Leve' | 'Médio' | 'Pesado';
}

/** Configuração per-client de quais campos de veículo são opcionais.
 *  `true` = opcional, `false` = obrigatório. Default: tudo obrigatório. */
export interface VehicleFieldSettings {
  id: string;
  clientId: string;

  // Identificação
  renavamOptional: boolean;
  chassiOptional: boolean;
  detranUFOptional: boolean;
  colorOptional: boolean;

  // Propriedade & Rastreamento
  ownerOptional: boolean;
  fipePriceOptional: boolean;
  trackerOptional: boolean;
  anttOptional: boolean;
  autonomyOptional: boolean;
  acquisitionDateOptional: boolean;
  tagOptional: boolean;
  categoryOptional: boolean;

  // Documentos
  crlvUploadOptional: boolean;
  sanitaryInspectionOptional: boolean;
  grUploadOptional: boolean;
  grExpirationDateOptional: boolean;

  // Condicionais
  fuelTypeOptional: boolean;
  tankCapacityOptional: boolean;
  avgConsumptionOptional: boolean;
  coolingBrandOptional: boolean;
  placaSemiReboqueOptional: boolean;
}
