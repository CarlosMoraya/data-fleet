import { DriverFieldSettings } from '../types';

/** Row retornado pelo Supabase (snake_case) */
export interface DriverFieldSettingsRow {
  id: string;
  client_id: string;
  issue_date_optional: boolean;
  expiration_date_optional: boolean;
  cnh_upload_optional: boolean;
  registration_number_optional: boolean;
  category_optional: boolean;
  renach_optional: boolean;
  gr_upload_optional: boolean;
  gr_expiration_date_optional: boolean;
  certificate1_upload_optional: boolean;
  course_name1_optional: boolean;
  certificate2_upload_optional: boolean;
  course_name2_optional: boolean;
  certificate3_upload_optional: boolean;
  course_name3_optional: boolean;
}

/** snake_case → camelCase */
export function driverFieldSettingsFromRow(row: DriverFieldSettingsRow): DriverFieldSettings {
  return {
    id: row.id,
    clientId: row.client_id,
    issueDateOptional: row.issue_date_optional,
    expirationDateOptional: row.expiration_date_optional,
    cnhUploadOptional: row.cnh_upload_optional,
    registrationNumberOptional: row.registration_number_optional,
    categoryOptional: row.category_optional,
    renachOptional: row.renach_optional,
    grUploadOptional: row.gr_upload_optional,
    grExpirationDateOptional: row.gr_expiration_date_optional,
    certificate1UploadOptional: row.certificate1_upload_optional,
    courseName1Optional: row.course_name1_optional,
    certificate2UploadOptional: row.certificate2_upload_optional,
    courseName2Optional: row.course_name2_optional,
    certificate3UploadOptional: row.certificate3_upload_optional,
    courseName3Optional: row.course_name3_optional,
  };
}

/** camelCase → snake_case para insert/update */
export function driverFieldSettingsToRow(
  settings: DriverFieldSettings,
  clientId: string
): Omit<DriverFieldSettingsRow, 'id'> {
  return {
    client_id: clientId,
    issue_date_optional: settings.issueDateOptional,
    expiration_date_optional: settings.expirationDateOptional,
    cnh_upload_optional: settings.cnhUploadOptional,
    registration_number_optional: settings.registrationNumberOptional,
    category_optional: settings.categoryOptional,
    renach_optional: settings.renachOptional,
    gr_upload_optional: settings.grUploadOptional,
    gr_expiration_date_optional: settings.grExpirationDateOptional,
    certificate1_upload_optional: settings.certificate1UploadOptional,
    course_name1_optional: settings.courseName1Optional,
    certificate2_upload_optional: settings.certificate2UploadOptional,
    course_name2_optional: settings.courseName2Optional,
    certificate3_upload_optional: settings.certificate3UploadOptional,
    course_name3_optional: settings.courseName3Optional,
  };
}

/** Retorna defaults: tudo obrigatório (optional = false) */
export function defaultDriverFieldSettings(clientId: string): DriverFieldSettings {
  return {
    id: '',
    clientId,
    issueDateOptional: false,
    expirationDateOptional: false,
    cnhUploadOptional: false,
    registrationNumberOptional: false,
    categoryOptional: false,
    renachOptional: false,
    grUploadOptional: false,
    grExpirationDateOptional: false,
    certificate1UploadOptional: false,
    courseName1Optional: false,
    certificate2UploadOptional: false,
    courseName2Optional: false,
    certificate3UploadOptional: false,
    courseName3Optional: false,
  };
}

/** Mapa: nome do campo no Driver → chave *Optional no DriverFieldSettings */
const DRIVER_FIELD_TO_SETTING: Record<string, keyof DriverFieldSettings> = {
  issueDate: 'issueDateOptional',
  expirationDate: 'expirationDateOptional',
  cnhUpload: 'cnhUploadOptional',
  registrationNumber: 'registrationNumberOptional',
  category: 'categoryOptional',
  renach: 'renachOptional',
  grUpload: 'grUploadOptional',
  grExpirationDate: 'grExpirationDateOptional',
  certificate1Upload: 'certificate1UploadOptional',
  courseName1: 'courseName1Optional',
  certificate2Upload: 'certificate2UploadOptional',
  courseName2: 'courseName2Optional',
  certificate3Upload: 'certificate3UploadOptional',
  courseName3: 'courseName3Optional',
};

/** Retorna true se o campo é obrigatório. Campos não mapeados são sempre obrigatórios. */
export function isDriverFieldRequired(fieldName: string, settings: DriverFieldSettings): boolean {
  const key = DRIVER_FIELD_TO_SETTING[fieldName];
  if (!key) return true;
  return !settings[key];
}

/** Lista de campos configuráveis para renderizar na página Settings */
export const DRIVER_CONFIGURABLE_FIELDS: { key: keyof DriverFieldSettings; label: string; section: string; note?: string }[] = [
  // CNH
  { key: 'issueDateOptional', label: 'Data de Emissão', section: 'CNH' },
  { key: 'expirationDateOptional', label: 'Validade da CNH', section: 'CNH' },
  { key: 'cnhUploadOptional', label: 'Upload da CNH', section: 'CNH' },
  { key: 'registrationNumberOptional', label: 'Nº do Registro', section: 'CNH' },
  { key: 'categoryOptional', label: 'Categoria', section: 'CNH' },
  { key: 'renachOptional', label: 'Renach', section: 'CNH', note: 'Número na lateral do documento' },
  // GR do Motorista
  { key: 'grUploadOptional', label: 'Upload do GR', section: 'GR do Motorista' },
  { key: 'grExpirationDateOptional', label: 'Validade do GR', section: 'GR do Motorista' },
  // Certificados
  { key: 'certificate1UploadOptional', label: 'Upload Certificado 1', section: 'Certificados' },
  { key: 'courseName1Optional', label: 'Nome do Curso 1', section: 'Certificados' },
  { key: 'certificate2UploadOptional', label: 'Upload Certificado 2', section: 'Certificados' },
  { key: 'courseName2Optional', label: 'Nome do Curso 2', section: 'Certificados' },
  { key: 'certificate3UploadOptional', label: 'Upload Certificado 3', section: 'Certificados' },
  { key: 'courseName3Optional', label: 'Nome do Curso 3', section: 'Certificados' },
];
