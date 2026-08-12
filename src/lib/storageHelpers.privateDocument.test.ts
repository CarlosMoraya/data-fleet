import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadMock, removeMock, createSignedUrlMock, getPublicUrlMock, fromMock } = vi.hoisted(() => {
  const upload = vi.fn();
  const remove = vi.fn();
  const createSignedUrl = vi.fn();
  const getPublicUrl = vi.fn();
  return {
    uploadMock: upload,
    removeMock: remove,
    createSignedUrlMock: createSignedUrl,
    getPublicUrlMock: getPublicUrl,
    fromMock: vi.fn(() => ({ upload, remove, createSignedUrl, getPublicUrl })),
  };
});

vi.mock('./supabase', () => ({
  supabase: { storage: { from: fromMock } },
}));

import {
  deleteDriverDocument,
  deleteVehicleDocument,
  extractStoragePath,
  getPrivateDocumentSignedUrl,
  openPrivateDocument,
  SIGNED_URL_TTL_SECONDS,
  uploadDriverDocument,
  uploadVehicleDocument,
} from './storageHelpers';

const PUBLIC_URL =
  'https://abc.supabase.co/storage/v1/object/public/vehicle-documents/client-1/vehicle-1/crlv.pdf';
const SIGNED_URL =
  'https://abc.supabase.co/storage/v1/object/sign/vehicle-documents/client-1/vehicle-1/crlv.pdf?token=xyz';

function pdfFile(name = 'crlv.pdf'): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: 'application/pdf' });
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
});

describe('extractStoragePath', () => {
  it('mantém um caminho puro como caminho', () => {
    expect(extractStoragePath('client-1/vehicle-1/crlv.pdf', 'vehicle-documents')).toBe(
      'client-1/vehicle-1/crlv.pdf',
    );
  });

  it('converte URL pública legada em caminho', () => {
    expect(extractStoragePath(PUBLIC_URL, 'vehicle-documents')).toBe('client-1/vehicle-1/crlv.pdf');
  });

  it('converte URL assinada legada em caminho, descartando o token', () => {
    expect(extractStoragePath(SIGNED_URL, 'vehicle-documents')).toBe('client-1/vehicle-1/crlv.pdf');
  });

  it('rejeita URL de outro bucket', () => {
    expect(extractStoragePath(PUBLIC_URL, 'driver-documents')).toBeNull();
  });

  it('rejeita URL externa arbitrária', () => {
    expect(extractStoragePath('https://evil.example/vehicle-documents/x.pdf', 'vehicle-documents')).toBeNull();
  });

  it('rejeita caminho absoluto e tentativa de traversal', () => {
    expect(extractStoragePath('/client-1/crlv.pdf', 'vehicle-documents')).toBeNull();
    expect(extractStoragePath('client-1/../../secret.pdf', 'vehicle-documents')).toBeNull();
  });

  it('rejeita valores vazios', () => {
    expect(extractStoragePath('', 'vehicle-documents')).toBeNull();
    expect(extractStoragePath(null, 'vehicle-documents')).toBeNull();
    expect(extractStoragePath(undefined, 'vehicle-documents')).toBeNull();
  });
});

describe('getPrivateDocumentSignedUrl', () => {
  it('chama createSignedUrl com o caminho e TTL de 3600 segundos', async () => {
    await getPrivateDocumentSignedUrl('client-1/vehicle-1/crlv.pdf', 'vehicle-documents');

    expect(fromMock).toHaveBeenCalledWith('vehicle-documents');
    expect(createSignedUrlMock).toHaveBeenCalledWith('client-1/vehicle-1/crlv.pdf', 3600);
    expect(SIGNED_URL_TTL_SECONDS).toBe(3600);
  });

  it('resolve URL pública legada antes de assinar', async () => {
    await getPrivateDocumentSignedUrl(PUBLIC_URL, 'vehicle-documents');

    expect(createSignedUrlMock).toHaveBeenCalledWith('client-1/vehicle-1/crlv.pdf', 3600);
  });

  it('falha sem chamar o Storage quando o valor não pertence ao bucket', async () => {
    await expect(
      getPrivateDocumentSignedUrl('https://evil.example/x.pdf', 'vehicle-documents'),
    ).rejects.toThrow(/inválido/i);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });
});

describe('uploads dos buckets privados', () => {
  it('uploadVehicleDocument devolve o caminho e não usa getPublicUrl', async () => {
    const result = await uploadVehicleDocument('client-1', 'vehicle-1', pdfFile(), 'crlv');

    expect(result).toBe('client-1/vehicle-1/crlv.pdf');
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });

  it('uploadDriverDocument devolve o caminho e não usa getPublicUrl', async () => {
    const result = await uploadDriverDocument('client-1', 'driver-1', pdfFile('cnh.pdf'), 'cnh');

    expect(result).toBe('client-1/driver-1/cnh.pdf');
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });
});

describe('openPrivateDocument', () => {
  it('abre a URL assinada em nova aba, sem expor o caminho', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    await openPrivateDocument('client-1/maintenance/os-1/budget.pdf', 'vehicle-documents');

    expect(createSignedUrlMock).toHaveBeenCalledWith('client-1/maintenance/os-1/budget.pdf', 3600);
    expect(open).toHaveBeenCalledWith('https://signed.example/x', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('resolve URL pública legada antes de abrir', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    await openPrivateDocument(PUBLIC_URL, 'vehicle-documents');

    expect(open).toHaveBeenCalledWith('https://signed.example/x', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('avisa e não abre aba quando o ponteiro é inválido', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await openPrivateDocument('https://evil.example/x.pdf', 'vehicle-documents');

    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/inválido/i));
    open.mockRestore();
    alert.mockRestore();
  });

  it('avisa quando o Storage nega a assinatura', async () => {
    createSignedUrlMock.mockResolvedValueOnce({ data: null, error: { message: 'Object not found' } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await openPrivateDocument('client-1/maintenance/os-1/budget.pdf', 'vehicle-documents');

    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
    open.mockRestore();
    alert.mockRestore();
  });
});

describe('exclusão compatível', () => {
  it('deleta usando o caminho novo', async () => {
    await deleteVehicleDocument('client-1/vehicle-1/crlv.pdf');

    expect(removeMock).toHaveBeenCalledWith(['client-1/vehicle-1/crlv.pdf']);
  });

  it('deleta usando a URL pública antiga', async () => {
    await deleteVehicleDocument(PUBLIC_URL);

    expect(removeMock).toHaveBeenCalledWith(['client-1/vehicle-1/crlv.pdf']);
  });

  it('deleta documento de motorista pelo caminho', async () => {
    await deleteDriverDocument('client-1/driver-1/cnh.pdf');

    expect(removeMock).toHaveBeenCalledWith(['client-1/driver-1/cnh.pdf']);
  });

  it('ignora ponteiro vazio ou de outro bucket', async () => {
    await deleteVehicleDocument('');
    await deleteVehicleDocument('https://evil.example/x.pdf');

    expect(removeMock).not.toHaveBeenCalled();
  });
});
