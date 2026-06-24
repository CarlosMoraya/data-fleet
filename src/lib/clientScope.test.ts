import { describe, it, expect } from 'vitest';

import { requiresClientSelection, showsAggregatedData } from './clientScope';

describe('requiresClientSelection', () => {
  it('returns true for Admin Master without client', () => {
    expect(requiresClientSelection('Admin Master', null)).toBe(true);
    expect(requiresClientSelection('Admin Master', undefined)).toBe(true);
  });

  it('returns false for Admin Master with client', () => {
    expect(requiresClientSelection('Admin Master', 'abc-123')).toBe(false);
  });

  it('returns false for other roles with client', () => {
    expect(requiresClientSelection('Manager', 'abc-123')).toBe(false);
  });

  it('returns false for other roles without client (defensive)', () => {
    expect(requiresClientSelection('Manager', null)).toBe(false);
    expect(requiresClientSelection('Manager', undefined)).toBe(false);
  });
});

describe('showsAggregatedData', () => {
  it('returns true for Admin Master without client', () => {
    expect(showsAggregatedData('Admin Master', null)).toBe(true);
    expect(showsAggregatedData('Admin Master', undefined)).toBe(true);
  });

  it('returns true for Admin Master with client', () => {
    expect(showsAggregatedData('Admin Master', 'abc-123')).toBe(true);
  });

  it('returns true for other roles with client', () => {
    expect(showsAggregatedData('Manager', 'abc-123')).toBe(true);
  });

  it('returns false for other roles without client (defensive)', () => {
    expect(showsAggregatedData('Manager', null)).toBe(false);
    expect(showsAggregatedData('Manager', undefined)).toBe(false);
  });
});