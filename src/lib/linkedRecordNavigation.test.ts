import { describe, expect, it } from 'vitest';

import {
  buildDriverRecordLink,
  buildVehicleRecordLink,
  parseOpenRecordId,
  withoutOpenRecordParam,
} from './linkedRecordNavigation';

describe('linkedRecordNavigation', () => {
  it('builds a vehicle record link', () => {
    expect(buildVehicleRecordLink('abc-123')).toBe('/cadastros/veiculos?open=abc-123');
  });

  it('builds a driver record link', () => {
    expect(buildDriverRecordLink('abc-123')).toBe('/cadastros/motoristas?open=abc-123');
  });

  it('escapes an id with a character that requires encoding', () => {
    expect(buildDriverRecordLink('a b')).toContain('a%20b');
  });

  it('parses an open record id', () => {
    expect(parseOpenRecordId(new URLSearchParams('open=abc-123'))).toBe('abc-123');
  });

  it('returns null when the open record id is absent', () => {
    expect(parseOpenRecordId(new URLSearchParams(''))).toBeNull();
  });

  it('returns null when the open record id is empty', () => {
    expect(parseOpenRecordId(new URLSearchParams('open='))).toBeNull();
  });

  it('returns null when the open record id contains only spaces', () => {
    expect(parseOpenRecordId(new URLSearchParams('open=%20%20'))).toBeNull();
  });

  it('removes only the open record parameter', () => {
    const result = withoutOpenRecordParam(new URLSearchParams('q=teste&open=abc&issue=no_driver'));

    expect(result.toString()).not.toContain('open');
    expect(result.get('q')).toBe('teste');
    expect(result.get('issue')).toBe('no_driver');
  });

  it('does not mutate the original params', () => {
    const original = new URLSearchParams('open=abc&q=teste');

    withoutOpenRecordParam(original);

    expect(original.get('open')).toBe('abc');
  });
});
