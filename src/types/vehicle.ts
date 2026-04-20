// ─── Veículos ─────────────────────────────────────────────────────────────────

import type { AxleConfigEntry } from './tire';

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
  acquisition: 'Owned' | 'Rented' | 'Agregado';
  fipePrice: number;
  tracker: string;
  antt: string;
  owner: string;
  autonomy: number;
  acquisitionDate?: string;
  crlvUpload?: string;
  crlvYear?: string;
  status?: 'Available' | 'In Use' | 'Maintenance';

  // New fields
  tag?: string;
  sanitaryInspectionUpload?: string;
  spareKey?: boolean;
  vehicleManual?: boolean;
  grUpload?: string;
  grExpirationDate?: string;
  category?: 'Leve' | 'Médio' | 'Pesado' | 'Elétrico';

  // Especificações de peso/capacidade
  pbt?: number;   // Peso Bruto Total (t)
  cmt?: number;   // Capacidade Máxima de Tração (t)
  eixos?: number; // Número de eixos

  // Associação motorista (1:1)
  driverId?: string;    // FK → drivers.id (nullable)
  driverName?: string;  // Nome do motorista (vem do JOIN, não persistido diretamente)
  shipperId?: string;              // FK → shippers.id (nullable)
  shipperName?: string;            // from JOIN
  operationalUnitId?: string;      // FK → operational_units.id (nullable)
  operationalUnitName?: string;    // from JOIN

  // Garantia & Revisões
  warranty?: boolean;
  warrantyEndDate?: string;
  firstRevisionMaxKm?: number;
  firstRevisionDeadline?: string;
  coolingFirstRevisionDeadline?: string;

  // Seguro & Contrato de Manutenção
  hasInsurance?: boolean;
  insurancePolicyUpload?: string;
  hasMaintenanceContract?: boolean;
  maintenanceContractUpload?: string;

  // Finalidade
  vehicleUsage?: 'Operação' | 'Uso Administrativo' | 'Uso por Lideranças' | 'Outros';

  // Hodômetro
  initialKm?: number;

  // Configuração detalhada de eixos
  axleConfig?: AxleConfigEntry[];
  stepsCount?: number;  // Estepes de fábrica
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

  // Peso & Capacidade
  pbtOptional: boolean;
  cmtOptional: boolean;
  eixosOptional: boolean;

  // Garantia & Revisões
  warrantyEndDateOptional: boolean;
  firstRevisionMaxKmOptional: boolean;
  firstRevisionDeadlineOptional: boolean;
  coolingFirstRevisionDeadlineOptional: boolean;

  // Seguro & Contrato
  insurancePolicyUploadOptional: boolean;
  maintenanceContractUploadOptional: boolean;

  // Finalidade
  vehicleUsageOptional: boolean;

  // Hodômetro
  initialKmOptional: boolean;
}

// ─── Vehicle KM Intervals ──────────────────────────────────────────────────────

export interface VehicleKmInterval {
  id: string;
  clientId: string;
  vehicleId: string;
  kmInterval: number | null;
  updatedAt?: string;
  updatedBy?: string;
}
