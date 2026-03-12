import { Workshop } from '../types';
import { capitalizeWords, normalizeUpper, normalizeTrim } from './inputHelpers';

// ─── Tipo espelho do banco (snake_case) ─────────────────────────────────────

export interface WorkshopRow {
  id: string;
  client_id: string;
  name: string;
  cnpj: string;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  specialties: string[] | null;
  notes: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Conversor: banco → frontend ────────────────────────────────────────────

export function workshopFromRow(row: WorkshopRow): Workshop {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    cnpj: row.cnpj,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    contactPerson: row.contact_person ?? undefined,
    addressStreet: row.address_street ?? undefined,
    addressNumber: row.address_number ?? undefined,
    addressComplement: row.address_complement ?? undefined,
    addressNeighborhood: row.address_neighborhood ?? undefined,
    addressCity: row.address_city ?? undefined,
    addressState: row.address_state ?? undefined,
    addressZip: row.address_zip ?? undefined,
    specialties: row.specialties ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
  };
}

// ─── Conversor: frontend → banco ────────────────────────────────────────────

export function workshopToRow(
  workshop: Partial<Workshop>,
  clientId: string
): Omit<WorkshopRow, 'id'> {
  return {
    client_id: clientId,
    name: capitalizeWords(workshop.name),
    cnpj: normalizeTrim(workshop.cnpj),
    phone: normalizeTrim(workshop.phone) || null,
    email: normalizeTrim(workshop.email)?.toLowerCase() || null,
    contact_person: capitalizeWords(workshop.contactPerson) || null,
    address_street: capitalizeWords(workshop.addressStreet) || null,
    address_number: normalizeTrim(workshop.addressNumber) || null,
    address_complement: normalizeTrim(workshop.addressComplement) || null,
    address_neighborhood: capitalizeWords(workshop.addressNeighborhood) || null,
    address_city: capitalizeWords(workshop.addressCity) || null,
    address_state: normalizeUpper(workshop.addressState) || null,
    address_zip: normalizeTrim(workshop.addressZip) || null,
    specialties: workshop.specialties?.length ? workshop.specialties : null,
    notes: normalizeTrim(workshop.notes) || null,
    active: workshop.active ?? true,
  };
}

// ─── Formatter de exibição ───────────────────────────────────────────────────

/** Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// ─── Lista de especialidades disponíveis ─────────────────────────────────────

export const WORKSHOP_SPECIALTIES = [
  'Mecânica Geral',
  'Elétrica',
  'Funilaria e Pintura',
  'Pneus',
  'Ar Condicionado',
  'Suspensão',
  'Freios',
  'Injeção Eletrônica',
  'Câmbio/Transmissão',
  'Refrigeração (Baú)',
];
