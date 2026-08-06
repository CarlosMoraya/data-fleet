import { describe, it, expect } from 'vitest';

import { matchesNameOrDocument } from './registrySearch';

describe('matchesNameOrDocument', () => {
  it('returns true for empty search term', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', '11222333000181', '')).toBe(true);
  });

  it('returns false when non-digit term does not match name', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', '11222333000181', 'zzz')).toBe(false);
  });

  it('matches name case-insensitively', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', '11222333000181', 'TURBO')).toBe(true);
  });

  it('matches by document digits', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', '11222333000181', '112223')).toBe(true);
  });

  it('returns false when digits do not match document', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', '11222333000181', '999999')).toBe(false);
  });

  it('matches by digits when search includes punctuation', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', '11222333000181', '11.222.333/0001-81')).toBe(true);
  });

  it('returns false when document is null and search has only digits', () => {
    expect(matchesNameOrDocument('Turbo Auto Center', null, '112223')).toBe(false);
  });

  it('returns false when name is null and search is textual', () => {
    expect(matchesNameOrDocument(null, '11222333000181', 'turbo')).toBe(false);
  });
});
