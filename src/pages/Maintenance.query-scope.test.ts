import { beforeAll, describe, expect, it } from 'vitest';

let shouldEnableMaintenanceOrdersQuery: typeof import('./Maintenance').shouldEnableMaintenanceOrdersQuery;

beforeAll(async () => {
  class MockDOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    multiplySelf() {
      return this;
    }
    preMultiplySelf() {
      return this;
    }
    translateSelf() {
      return this;
    }
    scaleSelf() {
      return this;
    }
    rotateSelf() {
      return this;
    }
    invertSelf() {
      return this;
    }
  }

  Object.defineProperty(globalThis, 'DOMMatrix', {
    configurable: true,
    writable: true,
    value: MockDOMMatrix,
  });

  ({ shouldEnableMaintenanceOrdersQuery } = await import('./Maintenance'));
});

describe('shouldEnableMaintenanceOrdersQuery', () => {
  it('returns true for Admin Master without selected client', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: false,
        isMultiWorkshop: false,
        currentClientId: null,
        role: 'Admin Master',
      })
    ).toBe(true);
  });

  it('returns true for Admin Master with selected client', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: false,
        isMultiWorkshop: false,
        currentClientId: 'client-1',
        role: 'Admin Master',
      })
    ).toBe(true);
  });

  it('returns false for non-workshop regular user without selected client', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: false,
        isMultiWorkshop: false,
        currentClientId: null,
        role: 'Manager',
      })
    ).toBe(false);
  });

  it('returns true for non-workshop regular user with selected client', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: false,
        isMultiWorkshop: false,
        currentClientId: 'client-1',
        role: 'Manager',
      })
    ).toBe(true);
  });

  it('returns true for multi-tenant workshop without selected client', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: true,
        isMultiWorkshop: true,
        currentClientId: null,
        role: 'Workshop',
      })
    ).toBe(true);
  });

  it('returns true for single-tenant workshop with activeWorkshopId', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: true,
        isMultiWorkshop: false,
        activeWorkshopId: 'workshop-1',
        workshopId: null,
        role: 'Workshop',
      })
    ).toBe(true);
  });

  it('returns false for single-tenant workshop without activeWorkshopId or workshopId', () => {
    expect(
      shouldEnableMaintenanceOrdersQuery({
        isWorkshopUser: true,
        isMultiWorkshop: false,
        activeWorkshopId: null,
        workshopId: null,
        role: 'Workshop',
      })
    ).toBe(false);
  });
});
