export type Role = 'Driver' | 'Yard Auditor' | 'Fleet Assistant' | 'Fleet Analyst' | 'Manager' | 'Director' | 'Admin Master';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string; // The primary client they belong to
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
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

  // Associação motorista (1:1)
  driverId?: string;    // FK → drivers.id (nullable)
  driverName?: string;  // Nome do motorista (vem do JOIN, não persistido diretamente)
}

export interface Driver {
  id: string;
  clientId: string;

  // Core identity (sempre obrigatórios)
  name: string;
  cpf: string;

  // CNH
  issueDate?: string;
  expirationDate?: string;
  cnhUpload?: string;
  registrationNumber?: string;
  category?: string; // A, B, AB, AE, etc.
  renach?: string;

  // GR do motorista
  grUpload?: string;
  grExpirationDate?: string;

  // Certificados
  certificate1Upload?: string;
  courseName1?: string;
  certificate2Upload?: string;
  courseName2?: string;
  certificate3Upload?: string;
  courseName3?: string;
}

/** Configuração per-client de quais campos de motorista são opcionais.
 *  `true` = opcional, `false` = obrigatório. Default: tudo obrigatório. */
export interface DriverFieldSettings {
  id: string;
  clientId: string;

  // CNH
  issueDateOptional: boolean;
  expirationDateOptional: boolean;
  cnhUploadOptional: boolean;
  registrationNumberOptional: boolean;
  categoryOptional: boolean;
  renachOptional: boolean;

  // GR
  grUploadOptional: boolean;
  grExpirationDateOptional: boolean;

  // Certificados
  certificate1UploadOptional: boolean;
  courseName1Optional: boolean;
  certificate2UploadOptional: boolean;
  courseName2Optional: boolean;
  certificate3UploadOptional: boolean;
  courseName3Optional: boolean;
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
