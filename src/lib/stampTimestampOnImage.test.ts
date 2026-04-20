import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stampTimestampOnImage } from './stampTimestampOnImage';

// ─── Mock canvas API (jsdom não implementa toBlob com conteúdo real) ──────────

beforeEach(() => {
  // createImageBitmap mock: retorna bitmap com dimensões fixas
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
    width: 1280,
    height: 720,
    close: vi.fn(),
  }));

  // canvas mock: toBlob retorna JPEG fake
  const fakeBlob = new Blob(['fake-jpeg-content'], { type: 'image/jpeg' });
  const mockCtx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 200 }),
    font: '',
    fillStyle: '',
  };

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toBlob: vi.fn().mockImplementation((cb: (b: Blob) => void) => cb(fakeBlob)),
  };

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
    return document.createElement(tag);
  });
});

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('stampTimestampOnImage', () => {
  it('retorna um File (não null, não undefined)', async () => {
    const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    const result = await stampTimestampOnImage(blob, 'foto.jpg');

    expect(result).not.toBeNull();
    expect(result).not.toBeUndefined();
    expect(result).toBeInstanceOf(File);
  });

  it('output é do tipo image/jpeg', async () => {
    const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    const result = await stampTimestampOnImage(blob, 'foto.jpg');

    expect(result.type).toBe('image/jpeg');
  });

  it('tamanho do arquivo é maior que zero', async () => {
    const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    const result = await stampTimestampOnImage(blob, 'foto.jpg');

    expect(result.size).toBeGreaterThan(0);
  });

  it('preserva o nome do arquivo', async () => {
    const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    const result = await stampTimestampOnImage(blob, 'inspecao_E1_photo.jpg');

    expect(result.name).toBe('inspecao_E1_photo.jpg');
  });

  it('chama drawImage com bitmap correto', async () => {
    const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    await stampTimestampOnImage(blob, 'foto.jpg');

    const createElement = vi.mocked(document.createElement);
    const canvas = createElement.mock.results.find(r => r.type === 'return')?.value as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d') as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> };

    expect(ctx?.drawImage).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1280, height: 720 }),
      0, 0,
    );
  });

  it('fallback: retorna File com blob original se getContext retorna null', async () => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(null),
      toBlob: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });

    const blob = new Blob(['original'], { type: 'image/jpeg' });
    const result = await stampTimestampOnImage(blob, 'fallback.jpg');

    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe('fallback.jpg');
  });
});
