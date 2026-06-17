import { describe, expect, it } from 'vitest';
import { shouldPersistQuery } from './cachePolicy';

const HOUR = 1000 * 60 * 60;
const now = 1_800_000_000_000;

describe('shouldPersistQuery', () => {
  it('returns true for an operational allowlisted query', () => {
    expect(shouldPersistQuery(['vehicles', 'clienteA'], now, now)).toBe(true);
  });

  it('returns true for a reference query inside its TTL', () => {
    expect(shouldPersistQuery(['vehicleSettings', 'c1'], now - 10 * HOUR, now)).toBe(true);
  });

  it('rejects PII queries', () => {
    expect(shouldPersistQuery(['drivers', 'c1'], now, now)).toBe(false);
    expect(shouldPersistQuery(['users', 'c1'], now, now)).toBe(false);
    expect(shouldPersistQuery(['admin-users'], now, now)).toBe(false);
    expect(shouldPersistQuery(['driverVehicleMap', 'c1'], now, now)).toBe(false);
  });

  it('rejects volatile workflow queries', () => {
    expect(shouldPersistQuery(['maintenanceOrders', 'c1'], now, now)).toBe(false);
    expect(shouldPersistQuery(['budgetApprovals', 'c1'], now, now)).toBe(false);
    expect(shouldPersistQuery(['dashboard-active-maintenance', 'c1'], now, now)).toBe(false);
    expect(shouldPersistQuery(['workshopSchedules', 'c1'], now, now)).toBe(false);
  });

  it('rejects queries without client scope and form helper queries', () => {
    expect(shouldPersistQuery(['vehicleTireConfigs'], now, now)).toBe(false);
    expect(shouldPersistQuery(['availableDrivers', 'c1'], now, now)).toBe(false);
  });

  it('rejects operational queries older than their TTL', () => {
    expect(shouldPersistQuery(['vehicles', 'c1'], now - 9 * HOUR, now)).toBe(false);
  });

  it('rejects dashboard queries older than their TTL', () => {
    expect(shouldPersistQuery(['dashboard-vehicles', 'c1'], now - 1000 * 60 * 90, now)).toBe(false);
  });

  it('rejects non-string query prefixes', () => {
    expect(shouldPersistQuery([123], now, now)).toBe(false);
  });

  it('rejects unknown keys by default', () => {
    expect(shouldPersistQuery(['chaveInexistente', 'c1'], now, now)).toBe(false);
  });

  it('rejects data without a reliable updated timestamp', () => {
    expect(shouldPersistQuery(['vehicles', 'c1'], 0, now)).toBe(false);
  });

  it('persists aggregated dashboard RPC queries inside dashboard TTL', () => {
    expect(shouldPersistQuery(['dashboard-last-checklists', 'c1'], now, now)).toBe(true);
    expect(shouldPersistQuery(['dashboard-vehicle-km', 'c1', '2026-06-01', '2026-06-30'], now, now)).toBe(true);
  });
});
