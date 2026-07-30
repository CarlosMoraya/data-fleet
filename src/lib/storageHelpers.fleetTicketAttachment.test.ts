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

import {
  buildFleetTicketAttachmentPath,
  getFleetTicketAttachmentSignedUrl,
  uploadFleetTicketAttachment,
} from './storageHelpers';

function pdfFile(name = 'evidence.pdf'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' });
}

describe('fleet ticket attachment storage helpers', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    createSignedUrlMock.mockReset();
    fromMock.mockClear();
  });

  it('builds the mandatory private path', () => {
    expect(buildFleetTicketAttachmentPath('client-1', 'ticket-1', 'file.pdf'))
      .toBe('client-1/fleet-tickets/ticket-1/file.pdf');
  });

  it('uploads to the private bucket and returns a path, not a public URL', async () => {
    uploadMock.mockResolvedValue({ error: null });

    const path = await uploadFleetTicketAttachment('client-1', 'ticket-1', pdfFile());

    expect(fromMock).toHaveBeenCalledWith('fleet-ticket-attachments');
    expect(path).toMatch(/^client-1\/fleet-tickets\/ticket-1\/attachment-\d+-[a-z0-9]+\.pdf$/);
    expect(path).not.toContain('http');
    expect(uploadMock).toHaveBeenCalledWith(path, expect.any(File), {
      upsert: false,
      contentType: 'application/pdf',
    });
  });

  it('generates a signed URL for one hour', async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });

    const url = await getFleetTicketAttachmentSignedUrl('client-1/fleet-tickets/ticket-1/file.pdf');

    expect(fromMock).toHaveBeenCalledWith('fleet-ticket-attachments');
    expect(createSignedUrlMock).toHaveBeenCalledWith('client-1/fleet-tickets/ticket-1/file.pdf', 3600);
    expect(url).toBe('https://signed/url');
  });

  it('rejects unsupported file types before uploading', async () => {
    const invalid = new File([new Uint8Array([1])], 'script.txt', { type: 'text/plain' });

    await expect(uploadFleetTicketAttachment('client-1', 'ticket-1', invalid))
      .rejects.toThrow('Formato não suportado');
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
