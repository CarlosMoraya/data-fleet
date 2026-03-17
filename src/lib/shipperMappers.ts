import { Shipper } from '../types';
import { capitalizeWords, normalizeTrim } from './inputHelpers';
export { formatCNPJ } from './workshopMappers';

// ─── Tipo espelho do banco (snake_case) ─────────────────────────────────────

export interface ShipperRow {
  id: string;
  client_id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  notes: string | null;
  active: boolean;
  created_at?: string;
}

// ─── Conversor: banco → frontend ────────────────────────────────────────────

export function shipperFromRow(row: ShipperRow): Shipper {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    cnpj: row.cnpj ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
  };
}

// ─── Conversor: frontend → banco ────────────────────────────────────────────

export function shipperToRow(
  shipper: Partial<Shipper>,
  clientId: string
): Omit<ShipperRow, 'id'> {
  return {
    client_id: clientId,
    name: capitalizeWords(shipper.name),
    cnpj: normalizeTrim(shipper.cnpj) || null,
    phone: normalizeTrim(shipper.phone) || null,
    email: normalizeTrim(shipper.email)?.toLowerCase() || null,
    contact_person: capitalizeWords(shipper.contactPerson) || null,
    notes: normalizeTrim(shipper.notes) || null,
    active: shipper.active ?? true,
  };
}
