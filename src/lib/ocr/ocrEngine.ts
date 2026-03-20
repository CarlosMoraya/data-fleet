import type { OcrProvider } from './types';
import { GeminiProvider } from './geminiProvider';
import { calculateFileHash } from '../hashUtils';
import { getOcrCache, saveOcrCache } from './cacheService';

// Atualmente usamos apenas o Gemini, mas fácil de trocar aqui:
const currentProvider: OcrProvider = new GeminiProvider();

/**
 * Executa OCR em um arquivo, utilizando cache se disponível.
 */
export async function performOcr(file: File, prompt: string): Promise<any> {
  // 1. Calcular Hash único do arquivo
  const hash = await calculateFileHash(file);

  // 2. Verificar Cache
  const cached = await getOcrCache(hash);
  if (cached) {
    console.log(`[OCR Cache] Hit ✓ (${hash}) — Usando resultado anterior.`);
    return cached.result;
  }

  // 3. Chamar IA
  console.log(`[OCR Cache] Miss ✗ — Chamando IA (${currentProvider.name})...`);
  const result = await currentProvider.extract(file, prompt);

  // 4. Salvar Cache
  await saveOcrCache({
    file_hash: hash,
    result,
    model_used: currentProvider.name
  });

  return result;
}
