import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadMock, createSignedUrlMock, fromMock } = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const createSignedUrlMock = vi.fn();
  const fromMock = vi.fn(() => ({
    upload: uploadMock,
    createSignedUrl: createSignedUrlMock,
  }));
  return { uploadMock, createSignedUrlMock, fromMock };
});

vi.mock('./supabase', () => ({
  supabase: {
    storage: { from: fromMock },
  },
}));

import { getFinancialDocumentSignedUrl, uploadFinancialDocument } from './storageHelpers';

function pdfFile(name = 'boleto.pdf'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' });
}

describe('uploadFinancialDocument', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    createSignedUrlMock.mockReset();
    fromMock.mockClear();
  });

  it('sobe no bucket privado e retorna o path {clientId}/payments/{orderId}/...', async () => {
    uploadMock.mockResolvedValue({ error: null });

    const path = await uploadFinancialDocument('c1', 'o1', pdfFile(), 'boleto');

    expect(fromMock).toHaveBeenCalledWith('financial-documents');
    expect(path).toMatch(/^c1\/payments\/o1\/boleto-\d+-[a-z0-9]+\.pdf$/);
    // O path enviado ao upload é o mesmo retornado.
    expect(uploadMock).toHaveBeenCalledWith(path, expect.any(File), {
      upsert: false,
      contentType: 'application/pdf',
    });
  });

  it('propaga erro de upload', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'boom' } });

    await expect(uploadFinancialDocument('c1', 'o1', pdfFile(), 'nota')).rejects.toThrow('boom');
  });
});

describe('getFinancialDocumentSignedUrl', () => {
  beforeEach(() => {
    createSignedUrlMock.mockReset();
    fromMock.mockClear();
  });

  it('gera signed URL com expiração de 3600s', async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });

    const url = await getFinancialDocumentSignedUrl('c1/payments/o1/boleto-1-abc.pdf');

    expect(fromMock).toHaveBeenCalledWith('financial-documents');
    expect(createSignedUrlMock).toHaveBeenCalledWith('c1/payments/o1/boleto-1-abc.pdf', 3600);
    expect(url).toBe('https://signed/url');
  });

  it('lança erro quando o Supabase falha', async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: { message: 'nope' } });

    await expect(getFinancialDocumentSignedUrl('x')).rejects.toThrow('nope');
  });
});
