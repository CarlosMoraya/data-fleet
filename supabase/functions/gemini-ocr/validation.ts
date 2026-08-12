// ============================================================
// Validação server-side da Edge Function 'gemini-ocr' (V-06).
//
// Funções PURAS: sem imports de React, Supabase ou APIs do
// navegador, para que possam rodar tanto no Deno da Edge Function
// quanto no Vitest (src/lib/ocr/geminiRequestValidation.test.ts).
//
// Regra: fail closed. Entrada inválida nunca chega ao Gemini.
// ============================================================

/** Limite aprovado por arquivo: 10 MB após decodificar o Base64. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Teto técnico do prompt, para evitar payloads de tamanho arbitrário. */
export const MAX_PROMPT_CHARS = 20_000;

/** Tipos aprovados: PDF, JPG, PNG e WEBP. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export type ValidationCode =
  | 'missing_fields'
  | 'invalid_base64'
  | 'unsupported_mime'
  | 'signature_mismatch'
  | 'file_too_large'
  | 'prompt_too_long';

export interface ValidationFailure {
  ok: false;
  code: ValidationCode;
  /** Status HTTP que a Edge Function deve devolver para este código. */
  status: 400 | 413 | 415;
  /** Mensagem para o usuário final — nunca inclui conteúdo do documento. */
  message: string;
}

export interface ValidationSuccess {
  ok: true;
  mimeType: AllowedMimeType;
  /** Base64 já normalizado (sem espaços em branco). */
  fileBase64: string;
  /** Tamanho REAL do arquivo decodificado, usado para a cota. */
  fileBytes: number;
  prompt: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

const FAILURES: Record<ValidationCode, { status: 400 | 413 | 415; message: string }> = {
  missing_fields: { status: 400, message: 'Requisição inválida: arquivo e instrução são obrigatórios.' },
  invalid_base64: { status: 400, message: 'Arquivo inválido: conteúdo não pôde ser lido.' },
  unsupported_mime: { status: 415, message: 'Formato não suportado. Envie um PDF ou imagem (JPG, PNG, WEBP).' },
  signature_mismatch: { status: 415, message: 'O conteúdo do arquivo não corresponde ao formato informado.' },
  file_too_large: { status: 413, message: 'Arquivo muito grande. O limite é 10MB.' },
  prompt_too_long: { status: 400, message: 'Instrução de extração acima do limite permitido.' },
};

function fail(code: ValidationCode): ValidationFailure {
  return { ok: false, code, ...FAILURES[code] };
}

export function isAllowedMimeType(value: unknown): value is AllowedMimeType {
  return typeof value === 'string' && (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Decodifica Base64 para bytes. Retorna null quando a string não é
 * Base64 válido — o caller trata isso como entrada rejeitada.
 */
export function decodeBase64(value: string): Uint8Array | null {
  const normalized = value.replace(/\s/g, '');
  if (normalized.length === 0) return null;
  if (normalized.length % 4 !== 0) return null;
  if (!BASE64_PATTERN.test(normalized)) return null;

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Confere a assinatura (magic number) do arquivo contra o MIME declarado.
 * Impede que um executável seja enviado como "application/pdf".
 */
export function matchesSignature(bytes: Uint8Array, mimeType: AllowedMimeType): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && // RIFF
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) // WEBP
      );
  }
}

/** Comprimento máximo do Base64 que ainda pode caber em MAX_FILE_BYTES. */
const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_BYTES / 3) * 4;

/**
 * Valida o corpo da requisição do OCR antes de qualquer chamada externa.
 * Devolve o tamanho real decodificado, que alimenta a cota por usuário.
 */
export function validateOcrRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return fail('missing_fields');

  const { file_base64: fileBase64, mime_type: mimeType, prompt } = body as Record<string, unknown>;

  if (typeof fileBase64 !== 'string' || fileBase64.length === 0) return fail('missing_fields');
  if (typeof prompt !== 'string' || prompt.trim().length === 0) return fail('missing_fields');

  if (prompt.length > MAX_PROMPT_CHARS) return fail('prompt_too_long');

  if (!isAllowedMimeType(mimeType)) return fail('unsupported_mime');

  // Barreira barata antes de materializar os bytes.
  const normalized = fileBase64.replace(/\s/g, '');
  if (normalized.length > MAX_BASE64_CHARS) return fail('file_too_large');

  const bytes = decodeBase64(normalized);
  if (!bytes) return fail('invalid_base64');

  if (bytes.length > MAX_FILE_BYTES) return fail('file_too_large');

  if (!matchesSignature(bytes, mimeType)) return fail('signature_mismatch');

  return {
    ok: true,
    mimeType,
    fileBase64: normalized,
    fileBytes: bytes.length,
    prompt,
  };
}
