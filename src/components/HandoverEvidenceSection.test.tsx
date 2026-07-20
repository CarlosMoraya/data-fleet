import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadChecklistPhotoMock, stampTimestampOnImageMock } = vi.hoisted(() => ({
  uploadChecklistPhotoMock: vi.fn(),
  stampTimestampOnImageMock: vi.fn(),
}));

vi.mock('../lib/checklistStorageHelpers', () => ({
  uploadChecklistPhoto: uploadChecklistPhotoMock,
}));

vi.mock('../lib/stampTimestampOnImage', () => ({
  stampTimestampOnImage: stampTimestampOnImageMock,
}));

vi.mock('./CameraCapture', () => ({
  default: ({ onCapture }: { onCapture: (file: File, lat?: number, lng?: number) => void }) => (
    <button
      type="button"
      data-testid="mock-camera-capture"
      onClick={() => onCapture(new File(['fake'], 'cnh.jpg', { type: 'image/jpeg' }), -23.55052, -46.63331)}
    >
      mock-capture
    </button>
  ),
}));

import HandoverEvidenceSection from './HandoverEvidenceSection';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
  uploadChecklistPhotoMock.mockReset().mockResolvedValue('https://storage.example.com/cnh.jpg');
  stampTimestampOnImageMock.mockReset().mockImplementation(async (file: File) => file);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderSection(props: Partial<React.ComponentProps<typeof HandoverEvidenceSection>> = {}) {
  const root = createRoot(container);
  container.__reactRoot = root;

  await act(async () => {
    root.render(
      <HandoverEvidenceSection
        clientId="client-1"
        checklistId="checklist-1"
        onCnhPhotoUploaded={() => {}}
        onSignatureUploaded={() => {}}
        {...props}
      />,
    );
    await Promise.resolve();
  });
}

describe('HandoverEvidenceSection', () => {
  it('com cnhPhotoUrl e signatureUrl preenchidos, exibe as duas miniaturas e nenhum botão de captura', async () => {
    await renderSection({
      driverName: 'João Motorista',
      cnhPhotoUrl: 'https://storage.example.com/cnh.jpg',
      signatureUrl: 'https://storage.example.com/assinatura.jpg',
    });

    const images = container.querySelectorAll('img');
    expect(images.length).toBe(2);
    expect(container.textContent).not.toContain('Tirar foto');
    expect(container.textContent).not.toContain('Coletar assinatura');
  });

  it('sem driverName, exibe "Motorista não informado"', async () => {
    await renderSection({});

    expect(container.textContent).toContain('Motorista não informado');
  });

  it('ao capturar a foto, stampTimestampOnImage é chamado com as coordenadas recebidas do onCapture', async () => {
    const onCnhPhotoUploaded = vi.fn();
    await renderSection({ onCnhPhotoUploaded });

    const captureButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Tirar foto')) as HTMLButtonElement;
    await act(async () => {
      captureButton.click();
      await Promise.resolve();
    });

    const mockCameraButton = container.querySelector('[data-testid="mock-camera-capture"]') as HTMLButtonElement;
    await act(async () => {
      mockCameraButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stampTimestampOnImageMock).toHaveBeenCalledWith(
      expect.any(File),
      expect.any(String),
      { latitude: -23.55052, longitude: -46.63331 },
    );
    expect(uploadChecklistPhotoMock).toHaveBeenCalledWith('client-1', 'checklist-1', 'cnh', expect.any(File));
    expect(onCnhPhotoUploaded).toHaveBeenCalledWith('https://storage.example.com/cnh.jpg');
  });
});
