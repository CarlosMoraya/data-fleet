import { describe, expect, it, vi, afterEach } from 'vitest';

import { downloadBlobFile } from './downloadBlobFile';

describe('downloadBlobFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a link with the correct filename, clicks it, and cleans up', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

    const anchor = document.createElement('a');
    const clickSpy = vi.spyOn(anchor, 'click');
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    downloadBlobFile(new Blob(['x']), 'teste.xlsx');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('teste.xlsx');
    expect(anchor.href).toBe('blob:test');
    expect(appendSpy).toHaveBeenCalledWith(anchor);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');
  });

  it('does not leave residual anchor elements in document.body', () => {
    const before = document.body.querySelectorAll('a').length;
    downloadBlobFile(new Blob(['x']), 'teste.xlsx');
    const after = document.body.querySelectorAll('a').length;
    expect(after).toBe(before);
  });
});
