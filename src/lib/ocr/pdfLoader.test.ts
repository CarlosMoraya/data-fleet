import { describe, it, expect, vi } from 'vitest';
import { loadPdfjs } from './pdfLoader';

const mockState = vi.hoisted(() => ({
  pdfjsImportCount: 0,
  pdfjsLib: {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
  },
}));

vi.mock('pdfjs-dist', () => {
  mockState.pdfjsImportCount += 1;
  return mockState.pdfjsLib;
});

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'worker-url',
}));

describe('loadPdfjs', () => {
  it('memoizes pdfjs loading and configures the worker once', async () => {
    const first = loadPdfjs();
    const second = loadPdfjs();

    expect(first).toBe(second);

    const pdfjsLib = await first;
    const secondPdfjsLib = await second;

    expect(pdfjsLib).toBe(secondPdfjsLib);
    expect(mockState.pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('worker-url');
    expect(mockState.pdfjsImportCount).toBe(1);
  });
});
