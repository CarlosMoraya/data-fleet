import { Driver } from '../types';
import {
  capitalizeWords,
  normalizeUpper,
  normalizeTrim,
  filterCPF,
} from './inputHelpers';

/** Row retornado pelo Supabase (snake_case) */
export interface DriverRow {
  id: string;
  client_id: string;
  profile_id?: string | null;
  name: string;
  cpf: string;
  issue_date: string | null;
  expiration_date: string | null;
  cnh_upload: string | null;
  registration_number: string | null;
  category: string | null;
  renach: string | null;
  gr_upload: string | null;
  gr_expiration_date: string | null;
  certificate1_upload: string | null;
  course_name1: string | null;
  certificate2_upload: string | null;
  course_name2: string | null;
  certificate3_upload: string | null;
  course_name3: string | null;
  phone: string | null;
}

/** Converte row do Supabase (snake_case) para interface Driver (camelCase) */
export function driverFromRow(row: DriverRow): Driver {
  return {
    id: row.id,
    clientId: row.client_id,
    profileId: row.profile_id ?? undefined,
    name: row.name,
    cpf: row.cpf,
    issueDate: row.issue_date ?? undefined,
    expirationDate: row.expiration_date ?? undefined,
    cnhUpload: row.cnh_upload ?? undefined,
    registrationNumber: row.registration_number ?? undefined,
    category: row.category ?? undefined,
    renach: row.renach ?? undefined,
    grUpload: row.gr_upload ?? undefined,
    grExpirationDate: row.gr_expiration_date ?? undefined,
    certificate1Upload: row.certificate1_upload ?? undefined,
    courseName1: row.course_name1 ?? undefined,
    certificate2Upload: row.certificate2_upload ?? undefined,
    courseName2: row.course_name2 ?? undefined,
    certificate3Upload: row.certificate3_upload ?? undefined,
    courseName3: row.course_name3 ?? undefined,
    phone: row.phone ?? undefined,
  };
}

/** Converte Partial<Driver> (camelCase) para payload de insert/update (snake_case) com normalização */
export function driverToRow(driver: Partial<Driver>, clientId: string): Omit<DriverRow, 'id'> {
  return {
    client_id: clientId,
    profile_id: driver.profileId ?? null,
    name: capitalizeWords(driver.name),
    cpf: normalizeTrim(filterCPF(driver.cpf ?? '')),
    issue_date: driver.issueDate ?? null,
    expiration_date: driver.expirationDate ?? null,
    cnh_upload: driver.cnhUpload ?? null,
    registration_number: driver.registrationNumber ? normalizeTrim(driver.registrationNumber) : null,
    category: driver.category ? normalizeUpper(driver.category) : null,
    renach: driver.renach ? normalizeTrim(driver.renach) : null,
    gr_upload: driver.grUpload ?? null,
    gr_expiration_date: driver.grExpirationDate ?? null,
    certificate1_upload: driver.certificate1Upload ?? null,
    course_name1: driver.courseName1 ? capitalizeWords(driver.courseName1) : null,
    certificate2_upload: driver.certificate2Upload ?? null,
    course_name2: driver.courseName2 ? capitalizeWords(driver.courseName2) : null,
    certificate3_upload: driver.certificate3Upload ?? null,
    course_name3: driver.courseName3 ? capitalizeWords(driver.courseName3) : null,
    phone: driver.phone ? normalizeTrim(driver.phone) : null,
  };
}
