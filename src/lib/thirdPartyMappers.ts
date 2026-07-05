import type { ThirdPartyDriver, ThirdPartyTractor } from '../types/coupling';

export interface ThirdPartyTractorRow {
  id: string;
  client_id: string;
  plate: string;
  crlv_upload: string | null;
  crlv_expiration_date: string | null;
  antt: string | null;
  gr_upload: string | null;
  gr_expiration_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ThirdPartyDriverRow {
  id: string;
  client_id: string;
  name: string;
  cnh: string | null;
  cnh_expiration_date: string | null;
  phone: string | null;
  address: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function thirdPartyTractorFromRow(row: ThirdPartyTractorRow): ThirdPartyTractor {
  return {
    id: row.id,
    clientId: row.client_id,
    plate: row.plate,
    crlvUpload: row.crlv_upload ?? undefined,
    crlvExpirationDate: row.crlv_expiration_date ?? undefined,
    antt: row.antt ?? undefined,
    grUpload: row.gr_upload ?? undefined,
    grExpirationDate: row.gr_expiration_date ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function thirdPartyDriverFromRow(row: ThirdPartyDriverRow): ThirdPartyDriver {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    cnh: row.cnh ?? undefined,
    cnhExpirationDate: row.cnh_expiration_date ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}
