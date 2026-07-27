import { describe, expect, it } from 'vitest';

import {
  REQUIRED_WORKSHOP_PROFILE_FIELDS,
  WORKSHOP_PROFILE_FIELD_LABELS,
  canWorkshopActOnOrders,
  isWorkshopProfileComplete,
  missingWorkshopProfileFields,
} from './workshopProfile';

import type { WorkshopAccount } from '../types';


// Complete account: all required fields + 1 specialty, no `notes`, no `addressComplement`.
const COMPLETE_ACCOUNT: WorkshopAccount = {
  id: 'wa-1',
  profileId: 'profile-1',
  name: 'Oficina Central Ltda',
  cnpj: '11222333000181',
  phone: '11999998888',
  email: 'contato@oficina.com',
  contactPerson: 'Carlos Silva',
  addressStreet: 'Rua das Flores',
  addressNumber: '123',
  addressNeighborhood: 'Centro',
  addressCity: 'São Paulo',
  addressState: 'SP',
  addressZip: '01001000',
  specialties: ['Motor'],
  active: true,
};

describe('missingWorkshopProfileFields / isWorkshopProfileComplete', () => {
  it('complete account without notes/addressComplement is complete', () => {
    expect(isWorkshopProfileComplete(COMPLETE_ACCOUNT)).toBe(true);
    expect(missingWorkshopProfileFields(COMPLETE_ACCOUNT)).toEqual([]);
  });

  it.each(REQUIRED_WORKSHOP_PROFILE_FIELDS)(
    'removing %s makes the profile incomplete and lists its label',
    (field) => {
      const account = { ...COMPLETE_ACCOUNT, [field]: undefined };
      expect(isWorkshopProfileComplete(account)).toBe(false);
      expect(missingWorkshopProfileFields(account)).toContain(
        WORKSHOP_PROFILE_FIELD_LABELS[field]
      );
    }
  );

  it('empty specialties list is incomplete with Especialidades in the list', () => {
    const account = { ...COMPLETE_ACCOUNT, specialties: [] };
    expect(isWorkshopProfileComplete(account)).toBe(false);
    expect(missingWorkshopProfileFields(account)).toContain('Especialidades');
  });

  it('one specialty is enough to satisfy the specialties requirement', () => {
    const account = { ...COMPLETE_ACCOUNT, specialties: ['Motor'] };
    expect(missingWorkshopProfileFields(account)).not.toContain('Especialidades');
    expect(isWorkshopProfileComplete(account)).toBe(true);
  });

  it('whitespace-only required field counts as missing', () => {
    const account = { ...COMPLETE_ACCOUNT, addressCity: '   ' };
    expect(isWorkshopProfileComplete(account)).toBe(false);
    expect(missingWorkshopProfileFields(account)).toContain('Cidade');
  });

  it('null account is incomplete and lists all 12 labels', () => {
    expect(isWorkshopProfileComplete(null)).toBe(false);
    expect(missingWorkshopProfileFields(null)).toHaveLength(12);
  });

  it('Especialidades is always the last label in the missing list', () => {
    const missing = missingWorkshopProfileFields(null);
    expect(missing[missing.length - 1]).toBe('Especialidades');
  });

  it('missing labels follow the canonical field order', () => {
    const missing = missingWorkshopProfileFields(null);
    expect(missing).toEqual([
      'Nome da Oficina',
      'CNPJ',
      'Telefone',
      'E-mail',
      'Pessoa de Contato',
      'Logradouro',
      'Número',
      'Bairro',
      'Cidade',
      'UF',
      'CEP',
      'Especialidades',
    ]);
  });
});

describe('canWorkshopActOnOrders', () => {
  it('Workshop role with complete account can act on orders', () => {
    expect(canWorkshopActOnOrders('Workshop', COMPLETE_ACCOUNT)).toBe(true);
  });

  it('Workshop role with incomplete account cannot act on orders', () => {
    const incomplete = { ...COMPLETE_ACCOUNT, phone: undefined };
    expect(canWorkshopActOnOrders('Workshop', incomplete)).toBe(false);
  });

  it('Fleet Analyst cannot act on orders even with a complete account', () => {
    expect(canWorkshopActOnOrders('Fleet Analyst', COMPLETE_ACCOUNT)).toBe(false);
  });

  it('undefined role cannot act on orders', () => {
    expect(canWorkshopActOnOrders(undefined, COMPLETE_ACCOUNT)).toBe(false);
  });
});
