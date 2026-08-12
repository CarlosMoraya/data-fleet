import { validateFile } from '../storageHelpers';
import { supabase } from '../supabase';

import type { OcrProvider } from './types';

/**
 * Traduz o status da Edge Function em mensagem compreensível.
 * Nunca inclui token, conteúdo do documento ou prompt — o corpo da
 * resposta do backend só é usado quando ele mesmo traz um `error` textual.
 */
export function messageForOcrStatus(status: number, serverMessage?: string): string {
  switch (status) {
    case 401:
      return 'Sessão expirada. Faça login novamente.';
    case 413:
      return 'Arquivo muito grande. O limite é 10MB.';
    case 415:
      return 'Formato não suportado. Envie um PDF ou imagem (JPG, PNG, WEBP).';
    case 429:
      return 'Limite de leituras automáticas atingido. Aguarde e tente novamente, ou preencha os campos manualmente.';
    case 502:
      return 'Serviço de leitura de documentos indisponível. Preencha os campos manualmente.';
    default:
      return serverMessage?.trim() || 'Não foi possível ler o documento. Preencha os campos manualmente.';
  }
}

async function readServerMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

export class GeminiProvider implements OcrProvider {
  readonly name = 'gemini-2.5-flash';

  private async fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string).split(',')[1];
        resolve({ base64: result, mimeType: file.type });
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  async extract(file: File, prompt: string): Promise<unknown> {
    // Falha cedo na interface reaproveitando a validação existente.
    // A validação server-side continua sendo a autoridade real.
    validateFile(file);

    const { base64, mimeType } = await this.fileToBase64(file);

    // Obter sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const fnUrl = `${supabaseUrl}/functions/v1/gemini-ocr`;

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        file_base64: base64,
        mime_type: mimeType,
        prompt,
      }),
    });

    if (!res.ok) {
      throw new Error(messageForOcrStatus(res.status, await readServerMessage(res)));
    }

    const data = (await res.json()) as { result: unknown };
    return data.result;
  }
}
