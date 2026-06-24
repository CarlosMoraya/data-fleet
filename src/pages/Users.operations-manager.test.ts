import { describe, expect, it } from 'vitest';

import {
  getCreateUserRoleOptions,
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
