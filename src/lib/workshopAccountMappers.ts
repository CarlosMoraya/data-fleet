import { WorkshopAccount, WorkshopPartnership, WorkshopInvitation } from '../types';

// ─── Tipos espelho do banco (snake_case) ─────────────────────────────────────

export interface WorkshopAccountRow {
  id: string;
  profile_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface WorkshopPartnershipRow {
  id: string;
  workshop_account_id: string;
  client_id: string;
  legacy_workshop_id: string | null;
  status: 'active' | 'inactive';
  invited_at: string;
  accepted_at: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  created_at: string;
  // Joins opcionais
  clients?: { id: string; name: string; logo_url: string | null };
}

export interface WorkshopInvitationRow {
  id: string;
  client_id: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by: string;
  accepted_by: string | null;
  expires_at: string;
  created_at: string;
  // Join opcional
  clients?: { name: string };
}

// ─── Conversores: banco → frontend ───────────────────────────────────────────

export function workshopAccountFromRow(row: WorkshopAccountRow): WorkshopAccount {
  return {
    id: row.id,
    profileId: row.profile_id,
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

export function workshopPartnershipFromRow(row: WorkshopPartnershipRow): WorkshopPartnership {
  return {
    id: row.id,
    workshopAccountId: row.workshop_account_id,
    clientId: row.client_id,
    clientName: row.clients?.name,
    clientLogoUrl: row.clients?.logo_url ?? undefined,
    legacyWorkshopId: row.legacy_workshop_id ?? undefined,
    status: row.status,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at ?? undefined,
  };
}

export function workshopInvitationFromRow(row: WorkshopInvitationRow): WorkshopInvitation {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name,
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
