import { supabase } from '../supabase';
import type { OcrProvider } from './types';

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

  async extract(file: File, prompt: string): Promise<any> {
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
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        file_base64: base64,
        mime_type: mimeType,
        prompt,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`gemini-ocr edge function error: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    return data.result;
  }
}
