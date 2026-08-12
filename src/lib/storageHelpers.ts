import { supabase } from './supabase';

const BUCKET = 'vehicle-documents';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// ─────────────────────────────────────────────────────────────
// Private document buckets (V-01)
// 'vehicle-documents' and 'driver-documents' are PRIVATE buckets:
// the database stores the object PATH and the app resolves a
// short-lived signed URL on demand. Never use getPublicUrl here.
// ─────────────────────────────────────────────────────────────

export const PRIVATE_DOCUMENT_BUCKETS = ['vehicle-documents', 'driver-documents'] as const;

export type PrivateDocumentBucket = (typeof PRIVATE_DOCUMENT_BUCKETS)[number];

/** TTL, in seconds, of every signed URL generated for a private document. */
export const SIGNED_URL_TTL_SECONDS = 3600;

const STORAGE_OBJECT_PREFIXES = ['public', 'sign', 'authenticated'];

function isPrivateDocumentBucket(value: string): value is PrivateDocumentBucket {
  return (PRIVATE_DOCUMENT_BUCKETS as readonly string[]).includes(value);
}

function extractPathFromStorageUrl(value: string, bucket: PrivateDocumentBucket): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  // Expected shape: /storage/v1/object/{public|sign|authenticated}/{bucket}/{path}
  const segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const objectIdx = segments.findIndex(
    (segment, idx) =>
      segment === 'object' && segments[idx - 1] === 'v1' && segments[idx - 2] === 'storage',
  );
  if (objectIdx === -1) return null;

  const prefix = segments[objectIdx + 1];
  if (!prefix || !STORAGE_OBJECT_PREFIXES.includes(prefix)) return null;

  if (segments[objectIdx + 2] !== bucket) return null;

  const path = segments.slice(objectIdx + 3).join('/');
  return path || null;
}

/**
 * Resolves a persisted document pointer into a canonical Storage path.
 *
 * Accepts three historical formats:
 *  - a canonical path already stored as such (`{clientId}/{vehicleId}/crlv.pdf`);
 *  - a legacy Supabase public URL;
 *  - a legacy Supabase signed URL.
 *
 * Returns `null` when the value does not belong to the expected bucket, so an
 * arbitrary external URL is never promoted into a trusted document link.
 */
export function extractStoragePath(
  value: string | null | undefined,
  bucket: PrivateDocumentBucket,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes('://')) {
    return extractPathFromStorageUrl(trimmed, bucket);
  }

  // Bare path: reject absolute paths and traversal attempts.
  if (trimmed.startsWith('/') || trimmed.split('/').includes('..')) return null;

  return trimmed;
}

/**
 * Generates a short-lived signed URL for a private document pointer.
 * The pointer may be a canonical path or a legacy public/signed URL.
 * Never persist the returned URL — it is a temporary bearer link.
 */
export async function getPrivateDocumentSignedUrl(
  value: string | null | undefined,
  bucket: PrivateDocumentBucket,
): Promise<string> {
  const path = extractStoragePath(value, bucket);
  if (!path) throw new Error('Documento inválido ou fora do armazenamento esperado.');

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    throw new Error(`Erro ao gerar URL do documento: ${error?.message ?? 'desconhecido'}`);
  }

  return data.signedUrl;
}

/**
 * Resolves a private document pointer and opens it in a new tab.
 *
 * Used by links that used to point straight at a public URL: the signed URL is
 * generated on click, so listing screens never mint URLs for rows nobody opens.
 * Mirrors the existing `openSignedUrl` pattern of the Financeiro components.
 */
export async function openPrivateDocument(
  value: string | null | undefined,
  bucket: PrivateDocumentBucket,
): Promise<void> {
  try {
    const url = await getPrivateDocumentSignedUrl(value, bucket);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao abrir documento.';
    window.alert(msg);
  }
}

/** Narrowing helper for callers that receive the bucket name as a plain string. */
export function assertPrivateDocumentBucket(bucket: string): PrivateDocumentBucket {
  if (!isPrivateDocumentBucket(bucket)) {
    throw new Error(`Bucket não suportado para documentos privados: ${bucket}`);
  }
  return bucket;
}

/**
 * Compresses an image file using canvas API.
 * PDFs are returned as-is.
 */
async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file; // PDFs or other formats: no compression
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      cleanup();

      // Target max dimension of 1920px, maintaining aspect ratio
      const MAX_DIMENSION = 1920;
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // fallback: use original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            cleanup(); // cleanup on toBlob failure
            resolve(file); // fallback
            return;
          }
          cleanup(); // cleanup on toBlob success
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82 // 82% quality — good balance between size and quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível processar a imagem.'));
    };

    img.src = url;
  });
}

/**
 * Validates file type and size before upload.
 * Throws an error with a user-friendly message if invalid.
 */
export function validateFile(file: File): void {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formato não suportado. Envie um PDF ou imagem (JPG, PNG, WEBP).');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 10MB.');
  }
}

/**
 * Uploads a vehicle document to Supabase Storage.
 * Images are compressed before upload. PDFs are sent as-is.
 * Returns the storage PATH (bucket is private — resolve a signed URL to view).
 */
export async function uploadVehicleDocument(
  clientId: string,
  vehicleId: string,
  file: File,
  docType: 'crlv' | 'sanitary-inspection' | 'gr' | 'insurance-policy' | 'maintenance-contract' = 'crlv'
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${clientId}/${vehicleId}/${docType}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar documento: ${error.message}`);

  return path;
}

/**
 * Resolves a vehicle document pointer (path or legacy public URL) into a signed URL.
 */
export async function getVehicleDocumentSignedUrl(value: string): Promise<string> {
  return getPrivateDocumentSignedUrl(value, BUCKET);
}

/**
 * Deletes a vehicle document from Supabase Storage.
 * Accepts either the canonical path or a legacy public URL.
 * Silently ignores if the pointer is empty or does not belong to the bucket.
 */
export async function deleteVehicleDocument(crlvUrl: string): Promise<void> {
  const path = extractStoragePath(crlvUrl, BUCKET);
  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Aviso: não foi possível deletar o documento do Storage.', error.message);
}

// ─────────────────────────────────────────────────────────────
// Maintenance Budget PDF
// Bucket: vehicle-documents (reutiliza bucket existente)
// Path: {clientId}/maintenance/{orderId}/budget.{ext}
// ─────────────────────────────────────────────────────────────

/**
 * Uploads a maintenance budget PDF or image to Supabase Storage.
 * Images are compressed before upload. PDFs are sent as-is.
 * Returns the storage PATH (bucket is private — resolve a signed URL to view).
 */
export async function uploadMaintenanceBudget(
  clientId: string,
  orderId: string,
  file: File,
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${clientId}/maintenance/${orderId}/budget.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar orçamento: ${error.message}`);

  return path;
}

export function buildMaintenancePartPhotoPath(clientId: string, orderId: string, fileName: string): string {
  return `${clientId}/maintenance/${orderId}/parts/${fileName}`;
}

export async function uploadMaintenancePartPhoto(
  clientId: string,
  orderId: string,
  file: File,
): Promise<string> {
  validateFile(file);
  if (!file.type.startsWith('image/')) {
    throw new Error('Apenas imagens são permitidas nas fotos de peças.');
  }

  const prepared = await prepareFile(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = buildMaintenancePartPhotoPath(clientId, orderId, fileName);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { upsert: false, contentType: 'image/jpeg' });

  if (error) throw new Error(`Erro ao enviar foto da peça: ${error.message}`);

  return path;
}

// ─────────────────────────────────────────────────────────────
// Financial Documents (boleto / nota fiscal)
// Bucket: financial-documents (PRIVADO) — acesso só via signed URL.
// Path: {clientId}/payments/{orderId}/{kind}-{ts}-{rand}.{ext}
// ─────────────────────────────────────────────────────────────

const FINANCIAL_BUCKET = 'financial-documents';

/**
 * Uploads a financial document (boleto or nota fiscal) to the private bucket.
 * Images are compressed before upload. PDFs are sent as-is.
 * Returns the storage PATH (not a public URL — bucket is private).
 */
export async function uploadFinancialDocument(
  clientId: string,
  orderId: string,
  file: File,
  kind: 'boleto' | 'nota' | 'evidencia',
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const fileName = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${clientId}/payments/${orderId}/${fileName}`;

  const { error } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .upload(path, prepared, { upsert: false, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar documento financeiro: ${error.message}`);

  return path;
}

/**
 * Generates a short-lived (1h) signed URL for a private financial document path.
 */
export async function getFinancialDocumentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data) {
    throw new Error(`Erro ao gerar URL do documento: ${error?.message ?? 'desconhecido'}`);
  }

  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────
// Fleet Tickets (private attachments)
// Bucket: fleet-ticket-attachments (PRIVADO)
// Path: {clientId}/fleet-tickets/{ticketId}/{filename}
// ─────────────────────────────────────────────────────────────

const FLEET_TICKET_BUCKET = 'fleet-ticket-attachments';

export function buildFleetTicketAttachmentPath(
  clientId: string,
  ticketId: string,
  fileName: string,
): string {
  return `${clientId}/fleet-tickets/${ticketId}/${fileName}`;
}

/** Uploads a private ticket attachment and returns its storage path. */
export async function uploadFleetTicketAttachment(
  clientId: string,
  ticketId: string,
  file: File,
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const fileName = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = buildFleetTicketAttachmentPath(clientId, ticketId, fileName);

  const { error } = await supabase.storage
    .from(FLEET_TICKET_BUCKET)
    .upload(path, prepared, { upsert: false, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar anexo do chamado: ${error.message}`);

  return path;
}

/** Generates a short-lived (1h) signed URL for a private ticket attachment. */
export async function getFleetTicketAttachmentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FLEET_TICKET_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data) {
    throw new Error(`Erro ao gerar URL do anexo: ${error?.message ?? 'desconhecido'}`);
  }

  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────
// Driver Documents
// Bucket: driver-documents
// Mesma lógica de validação/compressão dos documentos de veículo
// ─────────────────────────────────────────────────────────────

const DRIVER_BUCKET = 'driver-documents';

/**
 * Uploads a driver document to Supabase Storage.
 * Images are compressed before upload (max 1920px, 82% JPEG). PDFs are sent as-is.
 * Accepted formats: PDF, JPG, PNG, WEBP. Max size: 10MB.
 * Returns the storage PATH (bucket is private — resolve a signed URL to view).
 */
export async function uploadDriverDocument(
  clientId: string,
  driverId: string,
  file: File,
  docType: 'cnh' | 'gr' | 'certificate-1' | 'certificate-2' | 'certificate-3' | 'service-contract'
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${clientId}/${driverId}/${docType}.${ext}`;

  const { error } = await supabase.storage
    .from(DRIVER_BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar documento: ${error.message}`);

  return path;
}

/**
 * Resolves a driver document pointer (path or legacy public URL) into a signed URL.
 */
export async function getDriverDocumentSignedUrl(value: string): Promise<string> {
  return getPrivateDocumentSignedUrl(value, DRIVER_BUCKET);
}

/**
 * Deletes a driver document from Supabase Storage.
 * Accepts either the canonical path or a legacy public URL.
 * Silently ignores if the pointer is empty or does not belong to the bucket.
 */
export async function deleteDriverDocument(url: string): Promise<void> {
  const path = extractStoragePath(url, DRIVER_BUCKET);
  if (!path) return;

  const { error } = await supabase.storage.from(DRIVER_BUCKET).remove([path]);
  if (error) console.warn('Aviso: não foi possível deletar o documento do Storage.', error.message);
}

// ─────────────────────────────────────────────────────────────
// Action Plan Evidence
// Bucket: vehicle-documents (reutiliza bucket existente)
// Path: {clientId}/action-plans/{planId}/evidence.{ext}
// ─────────────────────────────────────────────────────────────

/**
 * Uploads an action plan evidence file (image or PDF) to Supabase Storage.
 * Images are compressed before upload. PDFs are sent as-is.
 * Returns the storage PATH (bucket is private — resolve a signed URL to view).
 */
export async function uploadActionPlanEvidence(
  clientId: string,
  planId: string,
  file: File,
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${clientId}/action-plans/${planId}/evidence.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar evidência: ${error.message}`);

  return path;
}
