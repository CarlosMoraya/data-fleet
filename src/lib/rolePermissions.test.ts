import { describe, expect, it } from 'vitest';

import {
  ROLE_RANK,
  canAccessRoute,
  canApproveExtraPayments,
  canApprovePayments,
  canCorrectOdometer,
  canCreateExtraPayments,
  canFillCoupling,
  canMarkExtraPaymentsPaid,
  canMarkPaid,
  canViewBudgetTab,
  canViewExtraPayments,
  getCreatableRoles,
  getDefaultRouteForRole,
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

  it('keeps Coupling Agent restricted to /controle-carretas/engate', () => {
    expect(canAccessRoute('Coupling Agent', '/controle-carretas/engate')).toBe(true);
    expect(canAccessRoute('Coupling Agent', '/controle-carretas/historico')).toBe(false);
    expect(canAccessRoute('Coupling Agent', '/checklists/preencher/abc')).toBe(true);
    expect(canAccessRoute('Coupling Agent', '/cadastros/veiculos')).toBe(false);
  });
});

describe('getDefaultRouteForRole', () => {
  it('leva Operador de Engate a /controle-carretas/engate', () => {
    expect(getDefaultRouteForRole('Coupling Agent')).toBe('/controle-carretas/engate');
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

describe('permissões do módulo financeiro', () => {
  it('canApprovePayments permite Coordinator e bloqueia Fleet Assistant', () => {
    expect(canApprovePayments('Coordinator')).toBe(true);
    expect(canApprovePayments('Fleet Assistant')).toBe(false);
  });

  it('canMarkPaid permite Financeiro e bloqueia Coordinator', () => {
    expect(canMarkPaid('Financeiro')).toBe(true);
    expect(canMarkPaid('Coordinator')).toBe(false);
  });

  it('canViewBudgetTab bloqueia Workshop', () => {
    expect(canViewBudgetTab('Workshop')).toBe(false);
  });

  it('canAccessRoute restringe Financeiro a /financeiro', () => {
    expect(canAccessRoute('Financeiro', '/manutencao')).toBe(false);
    expect(canAccessRoute('Financeiro', '/financeiro')).toBe(true);
  });

  it('canAccessRoute bloqueia Financeiro na rota raiz "/"', () => {
    expect(canAccessRoute('Financeiro', '/')).toBe(false);
  });
});

describe('permissões de Pagamentos Extras', () => {
  it('Workshop não cria extras', () => {
    expect(canCreateExtraPayments('Workshop')).toBe(false);
  });

  it('Financeiro não cria nem aprova extras', () => {
    expect(canCreateExtraPayments('Financeiro')).toBe(false);
    expect(canApproveExtraPayments('Financeiro')).toBe(false);
  });

  it('Financeiro pode marcar extra como pago', () => {
    expect(canMarkExtraPaymentsPaid('Financeiro')).toBe(true);
  });

  it('Fleet Assistant cria extra, mas não aprova', () => {
    expect(canCreateExtraPayments('Fleet Assistant')).toBe(true);
    expect(canApproveExtraPayments('Fleet Assistant')).toBe(false);
  });

  it('Coordinator aprova extra', () => {
    expect(canApproveExtraPayments('Coordinator')).toBe(true);
  });

  it('canViewExtraPayments inclui Financeiro e exclui Workshop', () => {
    expect(canViewExtraPayments('Financeiro')).toBe(true);
    expect(canViewExtraPayments('Workshop')).toBe(false);
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
