import { describe, expect, it } from 'vitest';

import {
  MAX_FILE_BYTES,
  MAX_PROMPT_CHARS,
  matchesSignature,
  validateOcrRequest,
} from '../../../supabase/functions/gemini-ocr/validation';

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46];
const JPEG_HEADER = [0xff, 0xd8, 0xff];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // tamanho
  0x57, 0x45, 0x42, 0x50, // WEBP
];

/** Monta um Base64 com a assinatura pedida e preenchimento até `size` bytes. */
function base64Of(header: number[], size = header.length): string {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    file_base64: base64Of(PDF_HEADER),
    mime_type: 'application/pdf',
    prompt: 'Extraia os campos do documento.',
    ...overrides,
  };
}

describe('validateOcrRequest — formatos permitidos', () => {
  it.each([
    ['application/pdf', PDF_HEADER],
    ['image/jpeg', JPEG_HEADER],
    ['image/png', PNG_HEADER],
    ['image/webp', WEBP_HEADER],
  ])('aceita %s com assinatura correta', (mime, header) => {
    const result = validateOcrRequest(request({ mime_type: mime, file_base64: base64Of(header) }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe(mime);
      expect(result.fileBytes).toBe(header.length);
    }
  });
});

describe('validateOcrRequest — rejeições', () => {
  it('rejeita MIME não permitido com 415', () => {
    const result = validateOcrRequest(request({ mime_type: 'application/zip' }));

    expect(result).toMatchObject({ ok: false, code: 'unsupported_mime', status: 415 });
  });

  it('rejeita assinatura incompatível com o MIME declarado com 415', () => {
    const result = validateOcrRequest(request({ file_base64: base64Of(PNG_HEADER) }));

    expect(result).toMatchObject({ ok: false, code: 'signature_mismatch', status: 415 });
  });

  it('rejeita Base64 inválido com 400', () => {
    const result = validateOcrRequest(request({ file_base64: 'não-é-base64!!' }));

    expect(result).toMatchObject({ ok: false, code: 'invalid_base64', status: 400 });
  });

  it('rejeita campos obrigatórios ausentes com 400', () => {
    expect(validateOcrRequest(request({ file_base64: '' }))).toMatchObject({ code: 'missing_fields', status: 400 });
    expect(validateOcrRequest(request({ prompt: '   ' }))).toMatchObject({ code: 'missing_fields', status: 400 });
    expect(validateOcrRequest(null)).toMatchObject({ code: 'missing_fields', status: 400 });
  });

  it('rejeita prompt acima do limite técnico com 400', () => {
    const result = validateOcrRequest(request({ prompt: 'a'.repeat(MAX_PROMPT_CHARS + 1) }));

    expect(result).toMatchObject({ ok: false, code: 'prompt_too_long', status: 400 });
  });
});

describe('validateOcrRequest — limite de 10 MB', () => {
  it('aceita exatamente 10 MB', () => {
    const result = validateOcrRequest(
      request({ file_base64: base64Of(PDF_HEADER, MAX_FILE_BYTES) }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fileBytes).toBe(MAX_FILE_BYTES);
  });

  it('rejeita acima de 10 MB com 413', () => {
    const result = validateOcrRequest(
      request({ file_base64: base64Of(PDF_HEADER, MAX_FILE_BYTES + 1) }),
    );

    expect(result).toMatchObject({ ok: false, code: 'file_too_large', status: 413 });
  });
});

describe('matchesSignature', () => {
  it('rejeita arquivo vazio', () => {
    expect(matchesSignature(new Uint8Array(0), 'application/pdf')).toBe(false);
  });

  it('exige RIFF e WEBP no offset correto', () => {
    const riffOnly = new Uint8Array(12);
    riffOnly.set([0x52, 0x49, 0x46, 0x46]);

    expect(matchesSignature(riffOnly, 'image/webp')).toBe(false);
    expect(matchesSignature(new Uint8Array(WEBP_HEADER), 'image/webp')).toBe(true);
  });
});
