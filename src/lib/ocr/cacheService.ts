import { supabase } from '../supabase';

export interface OcrCacheEntry {
  file_hash: string;
  result: unknown;
  model_used: string;
}

/**
 * Busca um resultado de OCR no cache do Supabase.
 */
export async function getOcrCache(fileHash: string): Promise<OcrCacheEntry | null> {
  const { data, error } = await supabase
    .from('ocr_cache')
    .select('file_hash, result, model_used')
    .eq('file_hash', fileHash)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Salva um novo resultado de OCR no cache do Supabase.
 */
export async function saveOcrCache(entry: OcrCacheEntry): Promise<void> {
  const { error } = await supabase
    .from('ocr_cache')
    .insert(entry);

  if (error) {
    console.warn('[OCR Cache] Falha ao salvar no cache:', error.message);
  }
}
