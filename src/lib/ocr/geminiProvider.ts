import { GoogleGenAI } from '@google/genai';
import type { OcrProvider } from './types';

export class GeminiProvider implements OcrProvider {
  readonly name = 'gemini-2.5-flash';

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  async extract(file: File, prompt: string): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

    const genai = new GoogleGenAI({ apiKey });
    const base64 = await this.fileToBase64(file);

    const response = await genai.models.generateContent({
      model: this.name,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: base64, mimeType: file.type } },
          { text: prompt },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    });

    const raw = response.text ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  }
}
