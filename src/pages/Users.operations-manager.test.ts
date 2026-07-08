import { describe, expect, it } from 'vitest';

import {
  getCreateUserRoleOptions,
  getEditableRoleOptions,
  getOperationsManagerScopeError,
  pruneOperationsManagerOperationalUnits,
} from './Users';

describe('Users operations manager helpers', () => {
  it('shows Operations Manager as creatable for Coordinator and above', () => {
    expect(getCreateUserRoleOptions('Coordinator')).toContain('Operations Manager');
    expect(getCreateUserRoleOptions('Manager')).toContain('Operations Manager');
    expect(getCreateUserRoleOptions('Director')).toContain('Operations Manager');
    expect(getCreateUserRoleOptions('Admin Master')).toContain('Operations Manager');
    expect(getCreateUserRoleOptions('Supervisor')).not.toContain('Operations Manager');
    expect(getCreateUserRoleOptions('Fleet Analyst')).not.toContain('Operations Manager');
  });

  it('shows Coupling Agent in the existing new-user flow for creator roles', () => {
    expect(getCreateUserRoleOptions('Fleet Assistant')).toContain('Coupling Agent');
    expect(getCreateUserRoleOptions('Fleet Analyst')).toContain('Coupling Agent');
    expect(getCreateUserRoleOptions('Supervisor')).toContain('Coupling Agent');
    expect(getCreateUserRoleOptions('Coordinator')).toContain('Coupling Agent');
    expect(getCreateUserRoleOptions('Manager')).toContain('Coupling Agent');
    expect(getCreateUserRoleOptions('Director')).toContain('Coupling Agent');
    expect(getCreateUserRoleOptions('Admin Master')).toContain('Coupling Agent');
  });

  it('blocks save without shipper selection', () => {
    expect(
      getOperationsManagerScopeError({
        shipperIds: [],
        operationalUnitIds: [],
      })
    ).toBe('Selecione ao menos 1 embarcador.');
  });

  it('blocks save without operational unit selection', () => {
    expect(
      getOperationsManagerScopeError({
        shipperIds: ['shipper-1'],
        operationalUnitIds: [],
      })
    ).toBe('Selecione ao menos 1 base operacional.');
  });

  it('getEditableRoleOptions exclui Operations Manager para todos os papéis de CAN_MANAGE_PERMISSIONS', () => {
    (['Manager', 'Coordinator', 'Director', 'Admin Master'] as const).forEach((role) => {
      const options = getEditableRoleOptions(role);
      expect(options).not.toContain('Operations Manager');
      expect(options.length).toBeGreaterThan(0);
    });
  });

  it('Manager pode atribuir cargos de rank inferior', () => {
    const options = getEditableRoleOptions('Manager');
    expect(options).toContain('Coordinator');
    expect(options).toContain('Supervisor');
    expect(options).toContain('Fleet Analyst');
    expect(options).not.toContain('Manager');
    expect(options).not.toContain('Director');
    expect(options).not.toContain('Admin Master');
  });

  it('Admin Master não pode atribuir o próprio Admin Master', () => {
    const options = getEditableRoleOptions('Admin Master');
    expect(options).not.toContain('Admin Master');
    expect(options).not.toContain('Operations Manager');
    expect(options).toContain('Director');
    expect(options).toContain('Manager');
  });

  it('removes orphan operational units when a shipper is removed', () => {
    expect(
      pruneOperationsManagerOperationalUnits(
        ['unit-1', 'unit-2'],
        ['shipper-1'],
        [
          { id: 'unit-1', shipperId: 'shipper-1' },
          { id: 'unit-2', shipperId: 'shipper-2' },
        ]
      )
    ).toEqual(['unit-1']);
  });
});
