import { VehicleFieldSettings } from '../types';

/** Row retornado pelo Supabase (snake_case) */
export interface VehicleFieldSettingsRow {
  id: string;
  client_id: string;
  renavam_optional: boolean;
  chassi_optional: boolean;
  detran_uf_optional: boolean;
  color_optional: boolean;
  owner_optional: boolean;
  fipe_price_optional: boolean;
  tracker_optional: boolean;
  antt_optional: boolean;
  autonomy_optional: boolean;
  acquisition_date_optional: boolean;
  tag_optional: boolean;
  category_optional: boolean;
  crlv_upload_optional: boolean;
  sanitary_inspection_optional: boolean;
  gr_upload_optional: boolean;
  gr_expiration_date_optional: boolean;
  fuel_type_optional: boolean;
  tank_capacity_optional: boolean;
  avg_consumption_optional: boolean;
  cooling_brand_optional: boolean;
  placa_semi_reboque_optional: boolean;
  pbt_optional: boolean;
  cmt_optional: boolean;
  eixos_optional: boolean;
  warranty_end_date_optional: boolean;
  first_revision_max_km_optional: boolean;
  first_revision_deadline_optional: boolean;
  cooling_first_revision_deadline_optional: boolean;
  insurance_policy_upload_optional: boolean;
  maintenance_contract_upload_optional: boolean;
  vehicle_usage_optional: boolean;
  initial_km_optional: boolean;
}

/** snake_case → camelCase */
export function fieldSettingsFromRow(row: VehicleFieldSettingsRow): VehicleFieldSettings {
  return {
    id: row.id,
    clientId: row.client_id,
    renavamOptional: row.renavam_optional,
    chassiOptional: row.chassi_optional,
    detranUFOptional: row.detran_uf_optional,
    colorOptional: row.color_optional,
    ownerOptional: row.owner_optional,
    fipePriceOptional: row.fipe_price_optional,
    trackerOptional: row.tracker_optional,
    anttOptional: row.antt_optional,
    autonomyOptional: row.autonomy_optional,
    acquisitionDateOptional: row.acquisition_date_optional,
    tagOptional: row.tag_optional,
    categoryOptional: row.category_optional,
    crlvUploadOptional: row.crlv_upload_optional,
    sanitaryInspectionOptional: row.sanitary_inspection_optional,
    grUploadOptional: row.gr_upload_optional,
    grExpirationDateOptional: row.gr_expiration_date_optional,
    fuelTypeOptional: row.fuel_type_optional,
    tankCapacityOptional: row.tank_capacity_optional,
    avgConsumptionOptional: row.avg_consumption_optional,
    coolingBrandOptional: row.cooling_brand_optional,
    placaSemiReboqueOptional: row.placa_semi_reboque_optional,
    pbtOptional: row.pbt_optional,
    cmtOptional: row.cmt_optional,
    eixosOptional: row.eixos_optional,
    warrantyEndDateOptional: row.warranty_end_date_optional,
    firstRevisionMaxKmOptional: row.first_revision_max_km_optional,
    firstRevisionDeadlineOptional: row.first_revision_deadline_optional,
    coolingFirstRevisionDeadlineOptional: row.cooling_first_revision_deadline_optional,
    insurancePolicyUploadOptional: row.insurance_policy_upload_optional,
    maintenanceContractUploadOptional: row.maintenance_contract_upload_optional,
    vehicleUsageOptional: row.vehicle_usage_optional,
    initialKmOptional: row.initial_km_optional,
  };
}

/** camelCase → snake_case para insert/update */
export function fieldSettingsToRow(
  settings: VehicleFieldSettings,
  clientId: string
): Omit<VehicleFieldSettingsRow, 'id'> {
  return {
    client_id: clientId,
    renavam_optional: settings.renavamOptional,
    chassi_optional: settings.chassiOptional,
    detran_uf_optional: settings.detranUFOptional,
    color_optional: settings.colorOptional,
    owner_optional: settings.ownerOptional,
    fipe_price_optional: settings.fipePriceOptional,
    tracker_optional: settings.trackerOptional,
    antt_optional: settings.anttOptional,
    autonomy_optional: settings.autonomyOptional,
    acquisition_date_optional: settings.acquisitionDateOptional,
    tag_optional: settings.tagOptional,
    category_optional: settings.categoryOptional,
    crlv_upload_optional: settings.crlvUploadOptional,
    sanitary_inspection_optional: settings.sanitaryInspectionOptional,
    gr_upload_optional: settings.grUploadOptional,
    gr_expiration_date_optional: settings.grExpirationDateOptional,
    fuel_type_optional: settings.fuelTypeOptional,
    tank_capacity_optional: settings.tankCapacityOptional,
    avg_consumption_optional: settings.avgConsumptionOptional,
    cooling_brand_optional: settings.coolingBrandOptional,
    placa_semi_reboque_optional: settings.placaSemiReboqueOptional,
    pbt_optional: settings.pbtOptional,
    cmt_optional: settings.cmtOptional,
    eixos_optional: settings.eixosOptional,
    warranty_end_date_optional: settings.warrantyEndDateOptional,
    first_revision_max_km_optional: settings.firstRevisionMaxKmOptional,
    first_revision_deadline_optional: settings.firstRevisionDeadlineOptional,
    cooling_first_revision_deadline_optional: settings.coolingFirstRevisionDeadlineOptional,
    insurance_policy_upload_optional: settings.insurancePolicyUploadOptional,
    maintenance_contract_upload_optional: settings.maintenanceContractUploadOptional,
    vehicle_usage_optional: settings.vehicleUsageOptional,
    initial_km_optional: settings.initialKmOptional,
  };
}

/** Retorna defaults: tudo obrigatório (optional = false) */
export function defaultFieldSettings(clientId: string): VehicleFieldSettings {
  return {
    id: '',
    clientId,
    renavamOptional: false,
    chassiOptional: false,
    detranUFOptional: false,
    colorOptional: false,
    ownerOptional: false,
    fipePriceOptional: false,
    trackerOptional: false,
    anttOptional: false,
    autonomyOptional: false,
    acquisitionDateOptional: false,
    tagOptional: false,
    categoryOptional: false,
    crlvUploadOptional: false,
    sanitaryInspectionOptional: false,
    grUploadOptional: false,
    grExpirationDateOptional: false,
    fuelTypeOptional: false,
    tankCapacityOptional: false,
    avgConsumptionOptional: false,
    coolingBrandOptional: false,
    placaSemiReboqueOptional: false,
    pbtOptional: false,
    cmtOptional: false,
    eixosOptional: false,
    warrantyEndDateOptional: false,
    firstRevisionMaxKmOptional: false,
    firstRevisionDeadlineOptional: false,
    coolingFirstRevisionDeadlineOptional: false,
    insurancePolicyUploadOptional: false,
    maintenanceContractUploadOptional: false,
    vehicleUsageOptional: false,
    initialKmOptional: false,
  };
}

/** Mapa: nome do campo no Vehicle → chave *Optional no VehicleFieldSettings */
const FIELD_TO_SETTING: Record<string, keyof VehicleFieldSettings> = {
  renavam: 'renavamOptional',
  chassi: 'chassiOptional',
  detranUF: 'detranUFOptional',
  color: 'colorOptional',
  owner: 'ownerOptional',
  fipePrice: 'fipePriceOptional',
  tracker: 'trackerOptional',
  antt: 'anttOptional',
  autonomy: 'autonomyOptional',
  acquisitionDate: 'acquisitionDateOptional',
  tag: 'tagOptional',
  category: 'categoryOptional',
  crlvUpload: 'crlvUploadOptional',
  sanitaryInspectionUpload: 'sanitaryInspectionOptional',
  grUpload: 'grUploadOptional',
  grExpirationDate: 'grExpirationDateOptional',
  fuelType: 'fuelTypeOptional',
  tankCapacity: 'tankCapacityOptional',
  avgConsumption: 'avgConsumptionOptional',
  coolingBrand: 'coolingBrandOptional',
  placaSemiReboque: 'placaSemiReboqueOptional',
  pbt: 'pbtOptional',
  cmt: 'cmtOptional',
  eixos: 'eixosOptional',
  warrantyEndDate: 'warrantyEndDateOptional',
  firstRevisionMaxKm: 'firstRevisionMaxKmOptional',
  firstRevisionDeadline: 'firstRevisionDeadlineOptional',
  coolingFirstRevisionDeadline: 'coolingFirstRevisionDeadlineOptional',
  insurancePolicyUpload: 'insurancePolicyUploadOptional',
  maintenanceContractUpload: 'maintenanceContractUploadOptional',
  vehicleUsage: 'vehicleUsageOptional',
  initialKm: 'initialKmOptional',
};

/** Retorna true se o campo é obrigatório. Campos não mapeados são sempre obrigatórios. */
export function isFieldRequired(fieldName: string, settings: VehicleFieldSettings): boolean {
  const key = FIELD_TO_SETTING[fieldName];
  if (!key) return true;
  return !settings[key];
}

/** Lista de campos configuráveis para renderizar na página Settings */
export const CONFIGURABLE_FIELDS: { key: keyof VehicleFieldSettings; label: string; section: string; note?: string }[] = [
  // Identificação
  { key: 'renavamOptional', label: 'Renavam', section: 'Identificação' },
  { key: 'chassiOptional', label: 'Chassi', section: 'Identificação' },
  { key: 'detranUFOptional', label: 'Detran (UF)', section: 'Identificação' },
  { key: 'colorOptional', label: 'Cor', section: 'Identificação' },
  // Propriedade & Rastreamento
  { key: 'ownerOptional', label: 'Proprietário', section: 'Propriedade & Rastreamento' },
  { key: 'fipePriceOptional', label: 'Preço FIPE', section: 'Propriedade & Rastreamento' },
  { key: 'trackerOptional', label: 'Rastreador', section: 'Propriedade & Rastreamento' },
  { key: 'anttOptional', label: 'ANTT', section: 'Propriedade & Rastreamento' },
  { key: 'autonomyOptional', label: 'Autonomia (km)', section: 'Propriedade & Rastreamento' },
  { key: 'acquisitionDateOptional', label: 'Data de Aquisição', section: 'Propriedade & Rastreamento' },
  { key: 'tagOptional', label: 'Tag (Sem Parar)', section: 'Propriedade & Rastreamento' },
  { key: 'categoryOptional', label: 'Categoria', section: 'Documentos & Acessórios' },
  // Documentos
  { key: 'crlvUploadOptional', label: 'CRLV', section: 'Documentos & Acessórios' },
  { key: 'sanitaryInspectionOptional', label: 'Inspeção Sanitária', section: 'Documentos & Acessórios' },
  { key: 'grUploadOptional', label: 'GR (Gerenciamento de Risco)', section: 'Documentos & Acessórios' },
  { key: 'grExpirationDateOptional', label: 'Vencimento do GR', section: 'Documentos & Acessórios' },
  // Condicionais
  { key: 'fuelTypeOptional', label: 'Tipo de Combustível', section: 'Campos Condicionais', note: 'Quando Fonte = Combustão' },
  { key: 'tankCapacityOptional', label: 'Capacidade do Tanque', section: 'Campos Condicionais', note: 'Quando Fonte = Combustão' },
  { key: 'avgConsumptionOptional', label: 'Consumo Médio', section: 'Campos Condicionais', note: 'Quando Fonte = Combustão' },
  { key: 'coolingBrandOptional', label: 'Marca do Refrigerador', section: 'Campos Condicionais', note: 'Quando Refrigeração = Sim' },
  { key: 'placaSemiReboqueOptional', label: 'Placa Semi-Reboque', section: 'Campos Condicionais', note: 'Quando Tipo = Cavalo' },
  // Peso & Capacidade
  { key: 'pbtOptional', label: 'PBT (Peso Bruto Total)', section: 'Especificações Técnicas' },
  { key: 'cmtOptional', label: 'CMT (Cap. Máxima de Tração)', section: 'Especificações Técnicas' },
  { key: 'eixosOptional', label: 'Eixos', section: 'Especificações Técnicas' },
  // Garantia & Revisões
  { key: 'warrantyEndDateOptional', label: 'Data Final da Garantia', section: 'Garantia & Revisões', note: 'Quando Veículo em Garantia = Sim' },
  { key: 'firstRevisionMaxKmOptional', label: 'Km Máximo da 1ª Revisão', section: 'Garantia & Revisões' },
  { key: 'firstRevisionDeadlineOptional', label: 'Data Limite da 1ª Revisão', section: 'Garantia & Revisões' },
  { key: 'coolingFirstRevisionDeadlineOptional', label: 'Data 1ª Revisão do Refrigerador', section: 'Garantia & Revisões', note: 'Quando Refrigeração = Sim' },
  // Seguro & Contrato
  { key: 'insurancePolicyUploadOptional', label: 'Apólice de Seguro', section: 'Seguro & Contrato', note: 'Quando Veículo possui seguro = Sim' },
  { key: 'maintenanceContractUploadOptional', label: 'Contrato de Manutenção', section: 'Seguro & Contrato', note: 'Quando Veículo possui contrato = Sim' },
  // Finalidade
  { key: 'vehicleUsageOptional', label: 'Finalidade do Veículo', section: 'Propriedade & Rastreamento' },
  // Hodômetro
  { key: 'initialKmOptional', label: 'Km Inicial', section: 'Propriedade & Rastreamento' },
];
