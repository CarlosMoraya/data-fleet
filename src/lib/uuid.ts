/**
 * Safe UUID v4 generation with fallback for non-secure contexts.
 *
 * crypto.randomUUID() is only available in secure contexts (HTTPS or localhost).
 * When accessed via HTTP over a local IP (e.g. 192.168.x.x), the function is
 * undefined, causing runtime errors. This helper mirrors the fallback pattern
 * already used in hashUtils.ts for crypto.subtle.
 */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Generates a UUID v4 string. Uses crypto.randomUUID() in secure contexts,
 * falls back to crypto.getRandomValues or Math.random when unavailable.
 */
export function safeRandomUUID(): string {
  // Preferred: native crypto.randomUUID (secure context)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback 1: crypto.getRandomValues (available in most non-secure contexts)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version nibble to 4 (UUID v4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant nibble to 8, 9, a, or b (RFC 4122 variant)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  // Fallback 2: Math.random (environments without any crypto API)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x03) | 0x08;
    return v.toString(16);
  });
}

/** Exposed for testing only — validates the UUID v4 format. */
export const uuidV4Regex = UUID_V4_REGEX;