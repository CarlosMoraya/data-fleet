import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractInvoiceNumber } from './invoiceOcr';
import { performOcr } from './ocr/ocrEngine';
import { loadPdfjs } from './ocr/pdfLoader';

vi.mock('./ocr/ocrEngine', () => ({
  performOcr: vi.fn(),
}));

vi.mock('./ocr/pdfLoader', () => ({
  loadPdfjs: vi.fn(),
}));

const performOcrMock = vi.mocked(performOcr);
const loadPdfjsMock = vi.mocked(loadPdfjs);

function makeFile(type = 'application/pdf'): File {
  return new File(['content'], 'invoice.pdf', { type });
}

function mockPdfText(text: string): void {
  loadPdfjsMock.mockResolvedValue({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: () => Promise.resolve({
          getTextContent: () => Promise.resolve({
            items: [{ str: text }],
          }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof loadPdfjs>>);
}

describe('extractInvoiceNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extrai por regex de PDF sem chamar OCR', async () => {
    mockPdfText('Nota Fiscal Nº 000123');

    const result = await extractInvoiceNumber(makeFile());

    expect(result).toEqual({ invoiceNumber: '000123', method: 'regex', warnings: [] });
    expect(performOcrMock).not.toHaveBeenCalled();
  });

  it('usa fallback Gemini quando PDF não tem número reconhecível', async () => {
    mockPdfText('Documento sem número reconhecível');
    performOcrMock.mockResolvedValue({ invoice_number: '456' });

    const result = await extractInvoiceNumber(makeFile());

    expect(performOcrMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ invoiceNumber: '456', method: 'gemini', warnings: [] });
  });

  it('retorna warning quando OCR falha sem lançar', async () => {
    loadPdfjsMock.mockRejectedValue(new Error('pdf failed'));
    performOcrMock.mockRejectedValue(new Error('ocr failed'));

    const result = await extractInvoiceNumber(makeFile());

    expect(result.invoiceNumber).toBeUndefined();
    expect(result.method).toBe('gemini');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('retorna undefined quando Gemini devolve invoice_number null', async () => {
    mockPdfText('Documento sem número reconhecível');
    performOcrMock.mockResolvedValue({ invoice_number: null });

    const result = await extractInvoiceNumber(makeFile());

    expect(result.invoiceNumber).toBeUndefined();
    expect(result.method).toBe('gemini');
  });
});
