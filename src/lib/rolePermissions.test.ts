import { describe, expect, it } from 'vitest';

import {
  ROLE_RANK,
  canAccessRoute,
  canCorrectOdometer,
  canFillCoupling,
  getCreatableRoles,
  hasRoleAccess,
} from './rolePermissions';

import type { Role } from '../types';

describe('canAccessRoute', () => {
  it('allows Operations Manager to access the password page', () => {
    expect(canAccessRoute('Operations Manager', '/conta/senha')).toBe(true);
  });

  it('keeps Operations Manager blocked from registrations', () => {
    expect(canAccessRoute('Operations Manager', '/cadastros')).toBe(false);
  });

  it('allows Driver to access the password page', () => {
    expect(canAccessRoute('Driver', '/conta/senha')).toBe(true);
  });

  it('keeps Coupling Agent restricted to /engate', () => {
    expect(canAccessRoute('Coupling Agent', '/engate')).toBe(true);
    expect(canAccessRoute('Coupling Agent', '/checklists/preencher/abc')).toBe(true);
    expect(canAccessRoute('Coupling Agent', '/cadastros/veiculos')).toBe(false);
  });
});

describe('canCorrectOdometer', () => {
  it('permite Coordinator, Manager, Director e Admin Master', () => {
    const allowed: Role[] = ['Coordinator', 'Manager', 'Director', 'Admin Master'];
    for (const role of allowed) {
      expect(canCorrectOdometer(role)).toBe(true);
    }
  });

  it('bloqueia papeis abaixo de Coordinator e undefined', () => {
    const denied: Array<Role | undefined> = [
      'Driver',
      'Yard Auditor',
      'Workshop',
      'Fleet Assistant',
      'Fleet Analyst',
      'Supervisor',
      'Operations Manager',
      undefined,
    ];
    for (const role of denied) {
      expect(canCorrectOdometer(role)).toBe(false);
    }
  });
});

describe('Financeiro role', () => {
  it('tem rank 1 (fora da escada de hierarquia operacional)', () => {
    expect(ROLE_RANK['Financeiro']).toBe(1);
  });

  it('pode ser criado por Coordinator', () => {
    expect(getCreatableRoles('Coordinator')).toContain('Financeiro');
  });

  it('não herda acesso operacional', () => {
    expect(hasRoleAccess('Financeiro')).toBe(false);
  });
});

describe('canFillCoupling', () => {
  it('allows Coupling Agent and fleet roles configured for coupling', () => {
    expect(canFillCoupling('Coupling Agent')).toBe(true);
    expect(canFillCoupling('Fleet Assistant')).toBe(true);
    expect(canFillCoupling('Coordinator')).toBe(true);
  });

  it('blocks roles outside the coupling flow', () => {
    expect(canFillCoupling('Driver')).toBe(false);
    expect(canFillCoupling('Workshop')).toBe(false);
    expect(canFillCoupling(undefined)).toBe(false);
  });
});
