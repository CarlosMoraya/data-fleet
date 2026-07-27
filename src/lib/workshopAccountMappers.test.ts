import { describe, expect, it } from 'vitest';

import { workshopAccountFromRow, workshopAccountToRow } from './workshopAccountMappers';

import type { WorkshopAccountRow } from './workshopAccountMappers';

const FULL_ROW: WorkshopAccountRow = {
  id: 'wa-1',
  profile_id: 'profile-1',
  name: 'Oficina Central Ltda',
  cnpj: '11222333000181',
  phone: '11999998888',
  email: 'contato@oficina.com',
  contact_person: 'Carlos Silva',
  address_street: 'Rua das Flores',
  address_number: '123',
  address_complement: 'Galpão 2',
  address_neighborhood: 'Centro',
  address_city: 'São Paulo',
  address_state: 'SP',
  address_zip: '01001000',
  specialties: ['Mecânica Geral', 'Freios'],
  notes: 'Atende frota pesada',
  active: true,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-20T00:00:00Z',
};

describe('workshopAccountFromRow', () => {
  it('converts a complete row to the domain object', () => {
    const account = workshopAccountFromRow(FULL_ROW);

    expect(account).toEqual({
      id: 'wa-1',
      profileId: 'profile-1',
      name: 'Oficina Central Ltda',
      cnpj: '11222333000181',
      phone: '11999998888',
      email: 'contato@oficina.com',
      contactPerson: 'Carlos Silva',
      addressStreet: 'Rua das Flores',
      addressNumber: '123',
      addressComplement: 'Galpão 2',
      addressNeighborhood: 'Centro',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZip: '01001000',
      specialties: ['Mecânica Geral', 'Freios'],
      notes: 'Atende frota pesada',
      active: true,
    });
  });

  it('maps every null optional to undefined and preserves the active boolean', () => {
    const row: WorkshopAccountRow = {
      ...FULL_ROW,
      phone: null,
      email: null,
      contact_person: null,
      address_street: null,
      address_number: null,
      address_complement: null,
      address_neighborhood: null,
      address_city: null,
      address_state: null,
      address_zip: null,
      specialties: null,
      notes: null,
      active: false,
    };

    const account = workshopAccountFromRow(row);

    expect(account.phone).toBeUndefined();
    expect(account.email).toBeUndefined();
    expect(account.contactPerson).toBeUndefined();
    expect(account.addressStreet).toBeUndefined();
    expect(account.addressNumber).toBeUndefined();
    expect(account.addressComplement).toBeUndefined();
    expect(account.addressNeighborhood).toBeUndefined();
    expect(account.addressCity).toBeUndefined();
    expect(account.addressState).toBeUndefined();
    expect(account.addressZip).toBeUndefined();
    expect(account.specialties).toBeUndefined();
    expect(account.notes).toBeUndefined();
    expect(account.active).toBe(false);
  });
});

describe('workshopAccountToRow', () => {
  it('never emits identity/immutable keys (security contract)', () => {
    const payload = workshopAccountToRow({
      id: 'wa-1',
      profileId: 'profile-1',
      cnpj: '00000000000191',
      active: false,
      name: 'Oficina Segura',
      phone: '11999998888',
    });

    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('cnpj');
    expect(payload).not.toHaveProperty('active');
    expect(payload).not.toHaveProperty('profile_id');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload.name).toBe('Oficina Segura');
  });

  it('uppercases address_state and trims surrounding spaces from text fields', () => {
    const payload = workshopAccountToRow({
      addressState: 'sp',
      addressCity: '  São Paulo  ',
      name: '  Oficina Central  ',
    });

    expect(payload.address_state).toBe('SP');
    expect(payload.address_city).toBe('São Paulo');
    expect(payload.name).toBe('Oficina Central');
  });

  it('maps empty text to null and empty specialties to null', () => {
    const payload = workshopAccountToRow({
      phone: '   ',
      specialties: [],
    });

    expect(payload.phone).toBeNull();
    expect(payload.specialties).toBeNull();
  });
});
