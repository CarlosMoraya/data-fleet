import { supabase } from './supabase';

const BUCKET = 'vehicle-documents';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

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

    img.onload = () => {
      URL.revokeObjectURL(url);

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
            resolve(file); // fallback
            return;
          }
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
 * Returns the public URL of the uploaded file.
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

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Deletes a vehicle document from Supabase Storage using its public URL.
 * Silently ignores if the URL is empty or invalid.
 */
export async function deleteVehicleDocument(crlvUrl: string): Promise<void> {
  if (!crlvUrl) return;

  // Extract the path after the bucket name from the full URL
  // e.g. https://.../storage/v1/object/public/vehicle-documents/clientId/vehicleId/crlv.pdf
  const marker = `/vehicle-documents/`;
  const idx = crlvUrl.indexOf(marker);
  if (idx === -1) return;

  const path = crlvUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Aviso: não foi possível deletar o documento do Storage.', error.message);
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
 * Returns the public URL of the uploaded file.
 */
export async function uploadDriverDocument(
  clientId: string,
  driverId: string,
  file: File,
  docType: 'cnh' | 'gr' | 'certificate-1' | 'certificate-2' | 'certificate-3'
): Promise<string> {
  validateFile(file);

  const prepared = await prepareFile(file);
  const ext = prepared.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${clientId}/${driverId}/${docType}.${ext}`;

  const { error } = await supabase.storage
    .from(DRIVER_BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type });

  if (error) throw new Error(`Erro ao enviar documento: ${error.message}`);

  const { data } = supabase.storage.from(DRIVER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Deletes a driver document from Supabase Storage using its public URL.
 * Silently ignores if the URL is empty or invalid.
 */
export async function deleteDriverDocument(url: string): Promise<void> {
  if (!url) return;

  const marker = `/driver-documents/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;

  const path = url.slice(idx + marker.length);
  const { error } = await supabase.storage.from(DRIVER_BUCKET).remove([path]);
  if (error) console.warn('Aviso: não foi possível deletar o documento do Storage.', error.message);
}
