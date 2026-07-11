import { describe, it, expect } from 'vitest';

import { shouldReloadProfile } from './AuthContext';

describe('shouldReloadProfile', () => {
  it('returns false when the incoming SIGNED_IN is for the same user already loaded', () => {
    expect(shouldReloadProfile('u1', 'u1')).toBe(false);
  });

  it('returns true when the incoming user id differs from the loaded one', () => {
    expect(shouldReloadProfile('u1', 'u2')).toBe(true);
  });

  it('returns true when no user was previously loaded', () => {
    expect(shouldReloadProfile(undefined, 'u1')).toBe(true);
    expect(shouldReloadProfile(null, 'u1')).toBe(true);
  });
});
