import { performOcr } from './ocr/ocrEngine';
import { loadPdfjs } from './ocr/pdfLoader';

export interface InvoiceExtractionResult {
  invoiceNumber?: string;
  method: 'regex' | 'gemini';
  warnings: string[];
}

const INVOICE_PROMPT = `Você está analisando uma nota fiscal ou fatura.
Extraia o número da nota fiscal/fatura do documento.
Retorne SOMENTE JSON válido:
{"invoice_number": "..."}
Regras:
- Se não encontrar, retorne {"invoice_number": null}.
- Ignore CNPJ, chave de acesso de 44 dígitos, valores monetários e datas.
- Retorne somente o JSON, sem markdown.`;

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n');
}

function normalizeInvoiceNumber(value: string | number | null | undefined): string | undefined {
  const normalized = String(value ?? '').replace(/[.\s]/g, '');
  return normalized.length >= 2 ? normalized : undefined;
}

function extractInvoiceNumberFromText(text: string): string | undefined {
  // Fixed invoice patterns with bounded captures; they run once per uploaded document.
  /* eslint-disable security/detect-unsafe-regex */
  const patterns = [
    /(?:nota\s*fiscal(?:\s*eletr[ôo]nica)?|nf-?e|nfs-?e)\s*n?[ºo.]?\s*[:#-]?\s*(\d{1,3}(?:[.\s]?\d{3})*|\d+)/i,
    /\bn[ºo]\.?\s*(?:da\s*)?(?:nota|fatura)\s*[:#-]?\s*(\d+)/i,
    /\bfatura\s*n?[ºo.]?\s*[:#-]?\s*([\w-]{2,})/i,
  ];
  /* eslint-enable security/detect-unsafe-regex */

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const invoiceNumber = normalizeInvoiceNumber(match[1]);
    if (invoiceNumber) return invoiceNumber;
  }

  return undefined;
}

async function extractInvoiceNumberViaGemini(file: File): Promise<InvoiceExtractionResult> {
  type InvoiceJson = { invoice_number?: string | number | null };
  const json = (await performOcr(file, INVOICE_PROMPT)) as InvoiceJson;
  return {
    invoiceNumber: json.invoice_number ? String(json.invoice_number) : undefined,
    method: 'gemini',
    warnings: [],
  };
}

export async function extractInvoiceNumber(file: File): Promise<InvoiceExtractionResult> {
  try {
    if (file.type === 'application/pdf') {
      try {
        const text = await extractPdfText(file);
        const invoiceNumber = extractInvoiceNumberFromText(text);
        if (invoiceNumber) {
          return { invoiceNumber, method: 'regex', warnings: [] };
        }
      } catch {
        // Fallback to Gemini below.
      }
    }

    return await extractInvoiceNumberViaGemini(file);
  } catch {
    return {
      invoiceNumber: undefined,
      method: 'gemini',
      warnings: ['Falha na extração automática da NF/Fatura. Preencha manualmente.'],
    };
  }
}
