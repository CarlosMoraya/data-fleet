import { canEditWorkshopOrder } from './rolePermissions';

import type { Role, WorkshopAccount } from '../types';


// ─── Regra de completude do cadastro da oficina ──────────────────────────────
// Single source of truth for "is the workshop profile complete?" and the
// derived action gate. Pure module: no React, no Supabase, no side effects.

export const REQUIRED_WORKSHOP_PROFILE_FIELDS = [
  'name',
  'cnpj',
  'phone',
  'email',
  'contactPerson',
  'addressStreet',
  'addressNumber',
  'addressNeighborhood',
  'addressCity',
  'addressState',
  'addressZip',
] as const satisfies readonly (keyof WorkshopAccount)[];

export const WORKSHOP_PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'Nome da Oficina',
  cnpj: 'CNPJ',
  phone: 'Telefone',
  email: 'E-mail',
  contactPerson: 'Pessoa de Contato',
  addressStreet: 'Logradouro',
  addressNumber: 'Número',
  addressNeighborhood: 'Bairro',
  addressCity: 'Cidade',
  addressState: 'UF',
  addressZip: 'CEP',
  specialties: 'Especialidades',
};

// A text field counts as filled when, after trim, it has length > 0.
// `notes` and `addressComplement` are optional and never required here.
function isTextFilled(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}

/** Lists the PT labels of the missing required fields, in canonical order. */
export function missingWorkshopProfileFields(account: WorkshopAccount | null): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_WORKSHOP_PROFILE_FIELDS) {
    if (!account || !isTextFilled(account[field])) {
      missing.push(WORKSHOP_PROFILE_FIELD_LABELS[field]);
    }
  }
  // `specialties` counts as filled with at least 1 element; label always last.
  if (!account || !Array.isArray(account.specialties) || account.specialties.length === 0) {
    missing.push(WORKSHOP_PROFILE_FIELD_LABELS.specialties);
  }
  return missing;
}

/** True only when nothing is missing from the workshop profile. */
export function isWorkshopProfileComplete(account: WorkshopAccount | null): boolean {
  return missingWorkshopProfileFields(account).length === 0;
}

/** Composes the existing role gate with the profile completeness gate. */
export function canWorkshopActOnOrders(
  role: Role | undefined | null,
  account: WorkshopAccount | null
): boolean {
  return canEditWorkshopOrder(role) && isWorkshopProfileComplete(account);
}
