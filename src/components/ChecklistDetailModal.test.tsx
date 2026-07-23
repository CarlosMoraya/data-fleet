import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, selectMock, eqMock, orderMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  orderMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import ChecklistDetailModal from './ChecklistDetailModal';

import type { Checklist } from '../types';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

const checklist: Checklist = {
  id: 'checklist-1',
  clientId: 'client-1',
  templateId: 'template-1',
  templateName: 'Checklist Diário',
  versionNumber: 1,
  vehicleId: 'vehicle-1',
  vehicleLicensePlate: 'ABC1D23',
  filledBy: 'user-1',
  filledByName: 'Motorista Teste',
  startedAt: '2026-06-12T12:00:00Z',
  completedAt: '2026-06-12T12:10:00Z',
  status: 'completed',
  odometerKm: 12345,
  odometerPhotoUrl: 'https://storage.example.com/odometer-photo.jpg',
};

const responsePhotoUrl = 'https://storage.example.com/checklist-photo.jpg';

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  orderMock.mockResolvedValue({
    data: [
      {
        id: 'response-1',
        checklist_id: checklist.id,
        item_id: 'item-1',
        status: 'issue',
        observation: 'Pneu com desgaste',
        photo_url: responsePhotoUrl,
        responded_at: '2026-06-12T12:05:00Z',
        checklist_items: { title: 'Pneus' },
      },
    ],
  });
  eqMock.mockReturnValue({ order: orderMock });
  selectMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ select: selectMock });
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

async function renderModal(overrideChecklist: Checklist = checklist) {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(<ChecklistDetailModal checklist={overrideChecklist} onClose={() => {}} />);
  });

  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForAssertion(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }
  }

  throw lastError;
}

describe('ChecklistDetailModal', () => {
  it('opens and closes the internal lightbox without external links', async () => {
    await renderModal();

    await waitForAssertion(() => {
    expect(container.textContent).toContain('Visualizar foto');
    });

    expect(container.querySelector('a[target="_blank"]')).toBeNull();

    const responsePhoto = container.querySelector(`img[src="${responsePhotoUrl}"]`);
    const openPhotoButton = responsePhoto?.parentElement?.querySelector('button');

    expect(openPhotoButton).not.toBeUndefined();

    act(() => {
      openPhotoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitForAssertion(() => {
      expect(container.querySelectorAll(`img[src="${responsePhotoUrl}"]`)).toHaveLength(2);
    });

    const closeLightboxButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Fechar',
    );

    expect(closeLightboxButton).not.toBeUndefined();

    act(() => {
      closeLightboxButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelectorAll(`img[src="${responsePhotoUrl}"]`)).toHaveLength(1);
    expect(container.textContent).toContain('Checklist Diário');
  });

  it('com cnhPhotoUrl e signatureUrl, exibe o bloco de evidências e as duas imagens', async () => {
    const handoverChecklist: Checklist = {
      ...checklist,
      driverName: 'João Motorista',
      cnhPhotoUrl: 'https://storage.example.com/cnh.jpg',
      signatureUrl: 'https://storage.example.com/assinatura.jpg',
    };

    await renderModal(handoverChecklist);

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Evidências de Entrega/Devolução');
    });

    expect(container.querySelector('img[src="https://storage.example.com/cnh.jpg"]')).not.toBeNull();
    expect(container.querySelector('img[src="https://storage.example.com/assinatura.jpg"]')).not.toBeNull();
  });

  it('checklist antigo sem os campos novos renderiza normalmente e não exibe o bloco de evidências', async () => {
    await renderModal();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Checklist Diário');
    });

    expect(container.textContent).not.toContain('Evidências de Entrega/Devolução');
  });

  it('com vehicleDriverName, exibe o motorista vinculado ao veículo', async () => {
    await renderModal({ ...checklist, vehicleDriverName: 'Jorge Santana' });

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Motorista do veículo');
      expect(container.textContent).toContain('Jorge Santana');
    });
  });

  it('sem vehicleDriverName, não exibe o campo do motorista vinculado ao veículo', async () => {
    await renderModal();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Checklist Diário');
    });

    expect(container.textContent).not.toContain('Motorista do veículo');
  });

  it('com vehicleLinkDivergenceReasons preenchido, exibe o texto de divergência e o nome do motorista vinculado', async () => {
    const divergentChecklist: Checklist = {
      ...checklist,
      vehicleLinkDivergenceReasons: ['other_driver_assigned'],
      vehicleLinkAssignedDriverName: 'Outro Motorista',
      vehicleLinkExecutorVehiclePlate: 'XYZ9A87',
    };

    await renderModal(divergentChecklist);

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Divergência de vínculo');
    });
    expect(container.textContent).toContain('Outro Motorista');
  });

  it('sem vehicleLinkDivergenceReasons, o bloco de divergência não é renderizado', async () => {
    await renderModal();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('Checklist Diário');
    });

    expect(container.textContent).not.toContain('Divergência de vínculo');
  });
});
