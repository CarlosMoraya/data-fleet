export type Role = 'Driver' | 'Yard Auditor' | 'Fleet Assistant' | 'Fleet Analyst' | 'Manager' | 'Director' | 'Admin Master';

// ─── Checklist types ──────────────────────────────────────────────────────────

export type VehicleCategory = 'Leve' | 'Médio' | 'Pesado' | 'Elétrico';
export type TemplateCategory = VehicleCategory;
export type ChecklistContext = 'Rotina' | 'Auditoria' | 'Reboque' | 'Entrada em Oficina' | 'Saída de Oficina' | 'Segurança';
export const WORKSHOP_CONTEXTS: ChecklistContext[] = ['Entrada em Oficina', 'Saída de Oficina'];
export type TemplateStatus = 'draft' | 'published' | 'deprecated';
export type ChecklistStatus = 'in_progress' | 'completed';
export type ResponseStatus = 'ok' | 'issue' | 'skipped' | 'not_applicable';
export type ActionPlanStatus = 'pending' | 'in_progress' | 'awaiting_conclusion' | 'completed' | 'cancelled';

export interface ChecklistItemSuggestion {
  id: string;
  vehicleCategory: VehicleCategory;
  title: string;
  description?: string;
  isMandatory: boolean;
  requirePhotoIfIssue: boolean;
  defaultAction?: string;
  orderNumber: number;
}

export interface ChecklistTemplate {
  id: string;
  clientId: string;
  vehicleCategory: VehicleCategory;
  context: ChecklistContext;
  name: string;
  description?: string;
  currentVersion: number;
  status: TemplateStatus;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistTemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy?: string;
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  versionNumber: number;
  title: string;
  description?: string;
  isMandatory: boolean;
  requirePhotoIfIssue: boolean;
  canBlockVehicle: boolean;
  defaultAction?: string;
  orderNumber: number;
}

export interface Checklist {
  id: string;
  clientId: string;
  templateId: string;
  templateName?: string; // from join
  templateContext?: ChecklistContext; // from join
  versionNumber: number;
  vehicleId?: string;
  vehicleLicensePlate?: string; // from join
  filledBy: string;
  filledByName?: string; // from join
  startedAt: string;
  completedAt?: string;
  status: ChecklistStatus;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  notes?: string;
  workshopId?: string;
  workshopName?: string; // from join
}

export interface ChecklistResponse {
  id: string;
  checklistId: string;
  itemId: string;
  itemTitle?: string; // from join
  status: ResponseStatus;
  observation?: string;
  photoUrl?: string;
  respondedAt: string;
}

export interface ActionPlan {
  id: string;
  clientId: string;
  checklistId: string;
  checklistResponseId?: string;
  vehicleId?: string;
  vehicleLicensePlate?: string; // from join
  reportedBy?: string;
  reportedByName?: string; // from join
  suggestedAction: string;
  observedIssue?: string;
  photoUrl?: string;
  status: ActionPlanStatus;
  // v2 fields
  name?: string;
  responsibleId?: string;
  responsibleName?: string; // from join
  dueDate?: string;
  assignedBy?: string;
  assignedByName?: string; // from join
  claimedBy?: string;
  claimedByName?: string; // from join
  claimedAt?: string;
  conclusionEvidenceUrl?: string;
  // completion
  completionNotes?: string;
  completedBy?: string;
  completedByName?: string; // from join
  completedAt?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
  // from join
  itemTitle?: string;
  templateName?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string; // The primary client they belong to
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
  canDeleteWorkshops: boolean;
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
}

export interface Driver {
  id: string;
  clientId: string;
  profileId?: string; // FK → profiles.id — todo motorista é um usuário do sistema

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

export interface Workshop {
  id: string;
  clientId: string;
  name: string;
  cnpj: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  specialties?: string[];
  notes?: string;
  active: boolean;
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
}
