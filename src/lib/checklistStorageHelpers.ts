import { supabase } from './supabase';

const BUCKET = 'checklist-photos';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Image compression (same pattern as storageHelpers.ts) ───────────────────

async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1920;
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82,
      );
    });
  } catch {
    return file;
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload de foto de checklist.
 * Path: {clientId}/{checklistId}/{itemId}/{timestamp}.jpg
 */
export async function uploadChecklistPhoto(
  clientId: string,
  checklistId: string,
  itemId: string,
  file: File,
): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Formato inválido. Use JPG, PNG ou WEBP.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 10MB.');
  }

  const prepared = await prepareFile(file);
  const ext = prepared.name.split('.').pop() ?? 'jpg';
  const timestamp = Date.now();
  const path = `${clientId}/${checklistId}/${itemId}/${timestamp}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared, {
    upsert: true,
    contentType: prepared.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

