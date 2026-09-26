import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadMock, fromMock } = vi.hoisted(() => {
  const upload = vi.fn();
  return {
    uploadMock: upload,
    fromMock: vi.fn(() => ({ upload })),
  };
});

vi.mock('./supabase', () => ({
  supabase: { storage: { from: fromMock } },
}));

import { isTransientStorageError, uploadMaintenanceBudget } from './storageHelpers';

const PATH = 'c1/maintenance/os-1/budget.pdf';
const error520 = { status: 520, statusCode: '520', message: 'HTTP 520 error' };
const error403 = { status: 403, statusCode: '403', message: 'new row violates row-level security policy' };

function pdf(): File {
  return new File(['%PDF-1.4'], 'orcamento.pdf', { type: 'application/pdf' });
}

describe('isTransientStorageError', () => {
  it.each([
    [{ status: 520, message: 'HTTP 520 error' }, true],
    [{ status: 503, message: 'Service Unavailable' }, true],
    [{ status: 500, message: 'Internal Server Error' }, true],
    [{ status: 403, message: 'Forbidden' }, false],
    [{ status: 413, message: 'Payload too large' }, false],
    [new Error('Failed to fetch'), true],
  ])('%o → %s', (error, expected) => {
    expect(isTransientStorageError(error)).toBe(expected);
  });
});

describe('uploadMaintenanceBudget — novas tentativas', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    fromMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sucesso na 1ª tentativa: uma chamada, mesmo caminho e opções de hoje', async () => {
    uploadMock.mockResolvedValue({ data: { path: PATH }, error: null });
    const file = pdf();

    await expect(uploadMaintenanceBudget('c1', 'os-1', file)).resolves.toBe(PATH);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledWith(PATH, file, { upsert: true, contentType: 'application/pdf' });
  });

  it('520 seguido de sucesso: resolve com o caminho após 2 chamadas', async () => {
    uploadMock
      .mockResolvedValueOnce({ data: null, error: error520 })
      .mockResolvedValueOnce({ data: { path: PATH }, error: null });

    const promise = uploadMaintenanceBudget('c1', 'os-1', pdf());
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe(PATH);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock.mock.calls.map((call) => call[0] as string)).toEqual([PATH, PATH]);
  });

  it('520 três vezes: desiste após 3 chamadas com a mensagem de hoje', async () => {
    uploadMock.mockResolvedValue({ data: null, error: error520 });

    const promise = uploadMaintenanceBudget('c1', 'os-1', pdf());
    const assertion = expect(promise).rejects.toThrow('Erro ao enviar orçamento: HTTP 520 error');
    await vi.runAllTimersAsync();
    await assertion;

    expect(uploadMock).toHaveBeenCalledTimes(3);
  });

  it('403 (RLS) não é repetido: falha na 1ª chamada', async () => {
    uploadMock.mockResolvedValue({ data: null, error: error403 });

    const promise = uploadMaintenanceBudget('c1', 'os-1', pdf());
    const assertion = expect(promise).rejects.toThrow(
      'Erro ao enviar orçamento: new row violates row-level security policy',
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(uploadMock).toHaveBeenCalledTimes(1);
  });
});
