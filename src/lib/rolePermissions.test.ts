import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './rolePermissions';

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
});
