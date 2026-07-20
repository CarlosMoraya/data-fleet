import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CameraCapture from './CameraCapture';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: undefined,
    geolocation: { getCurrentPosition: vi.fn() },
  });
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderCapture(requireLiveCapture: boolean) {
  const root = createRoot(container);
  container.__reactRoot = root;

  await act(async () => {
    root.render(
      <CameraCapture onCapture={() => {}} onClose={() => {}} requireLiveCapture={requireLiveCapture} />,
    );
    await Promise.resolve();
  });
}

describe('CameraCapture strict mode', () => {
  it('com requireLiveCapture e sem mediaDevices, bloqueia e não renderiza input de arquivo', async () => {
    await renderCapture(true);

    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.textContent).toContain('A câmera ao vivo é obrigatória');
  });

  it('sem requireLiveCapture e sem mediaDevices, mantém o input de arquivo (regressão)', async () => {
    await renderCapture(false);

    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });
});
