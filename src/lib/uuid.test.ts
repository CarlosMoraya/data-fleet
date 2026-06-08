import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeRandomUUID, uuidV4Regex } from './uuid';

describe('safeRandomUUID', () => {
  // Preserve original crypto so we don't leak mocks between tests
  const originalCrypto = globalThis.crypto;

  function restoreCrypto() {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    restoreCrypto();
  });

  it('returns a valid UUID v4 when crypto.randomUUID is available (secure context)', () => {
    // In this environment crypto.randomUUID should exist
    const result = safeRandomUUID();
    expect(result).toMatch(uuidV4Regex);
  });

  it('returns a valid UUID v4 when crypto.randomUUID is unavailable but getRandomValues exists (non-secure context)', () => {
    const originalRandomUUID = globalThis.crypto?.randomUUID;
    // Remove randomUUID to simulate non-secure context
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        ...globalThis.crypto,
        getRandomValues: globalThis.crypto!.getRandomValues.bind(globalThis.crypto),
      },
      writable: true,
      configurable: true,
    });
    // Ensure randomUUID is gone
    expect(typeof (globalThis.crypto as any).randomUUID).toBe('undefined');

    const result = safeRandomUUID();
    expect(result).toMatch(uuidV4Regex);
  });

  it('returns a valid UUID v4 when neither randomUUID nor getRandomValues are available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      writable: true,
      configurable: true,
    });

    const result = safeRandomUUID();
    expect(result).toMatch(uuidV4Regex);
  });

  it('returns different values on consecutive calls (basic uniqueness)', () => {
    const a = safeRandomUUID();
    const b = safeRandomUUID();
    expect(a).not.toBe(b);
  });
});