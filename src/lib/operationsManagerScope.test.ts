import { describe, expect, it } from 'vitest';

import {
  filterOperationalUnitsByShippers,
  hasOperationsManagerScopeChanged,
  normalizeOperationsManagerScope,
  validateOperationsManagerScope,
} from './operationsManagerScope';

describe('operationsManagerScope', () => {
  it('removes operational units outside the selected shippers', () => {
    expect(
      filterOperationalUnitsByShippers(
        ['ou-1', 'ou-2', 'ou-3'],
        ['shipper-1'],
        [
          { id: 'ou-1', shipperId: 'shipper-1' },
          { id: 'ou-2', shipperId: 'shipper-2' },
          { id: 'ou-3', shipperId: 'shipper-1' },
        ]
      )
    ).toEqual(['ou-1', 'ou-3']);
  });

  it('validates empty payloads', () => {
    expect(validateOperationsManagerScope({ shipperIds: [], operationalUnitIds: [] })).toBe(
      'Selecione ao menos 1 embarcador.'
    );
    expect(validateOperationsManagerScope({ shipperIds: ['shipper-1'], operationalUnitIds: [] })).toBe(
      'Selecione ao menos 1 base operacional.'
    );
  });

  it('normalizes scope deterministically', () => {
    expect(
      normalizeOperationsManagerScope({
        shipperIds: ['shipper-2', 'shipper-1', 'shipper-1'],
        operationalUnitIds: ['ou-2', 'ou-1', 'ou-2'],
      })
    ).toEqual({
      shipperIds: ['shipper-1', 'shipper-2'],
      operationalUnitIds: ['ou-1', 'ou-2'],
    });
  });

  it('compares normalized scopes', () => {
    expect(
      hasOperationsManagerScopeChanged(
        {
          shipperIds: ['shipper-2', 'shipper-1'],
          operationalUnitIds: ['ou-2', 'ou-1'],
        },
        {
          shipperIds: ['shipper-1', 'shipper-2'],
          operationalUnitIds: ['ou-1', 'ou-2'],
        }
      )
    ).toBe(false);

    expect(
      hasOperationsManagerScopeChanged(
        {
          shipperIds: ['shipper-1'],
          operationalUnitIds: ['ou-1'],
        },
        {
          shipperIds: ['shipper-1', 'shipper-2'],
          operationalUnitIds: ['ou-1'],
        }
      )
    ).toBe(true);
  });
});
