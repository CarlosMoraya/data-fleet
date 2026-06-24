import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TireInspectionDetailModal from './TireInspectionDetailModal';

import type { TireInspection } from '../types';

const { fetchTireInspectionComparison, fetchTireInspectionResponses } = vi.hoisted(() => ({
  fetchTireInspectionComparison: vi.fn(),
  fetchTireInspectionResponses: vi.fn(),
}));

vi.mock('../services/tireInspectionService', () => ({
  fetchTireInspectionComparison,
  fetchTireInspectionResponses,
}));

let container: HTMLDivElement;
let queryClient: QueryClient;

const photoUrl = 'https://storage.example.com/tire-photo.jpg';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const inspection: TireInspection = {
  id: 'inspection-1',
  clientId: 'client-1',
  vehicleId: 'vehicle-1',
  vehicleLicensePlate: 'ABC1D23',
  filledBy: 'user-1',
  filledByName: 'Inspector One',
  startedAt: '2026-06-12T12:00:00Z',
  status: 'completed',
  odometerKm: 12345,
  axleConfigSnapshot: [],
  stepsCountSnapshot: 0,
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  fetchTireInspectionResponses.mockResolvedValue([
    {
      id: 'response-1',
      inspectionId: inspection.id,
      positionCode: 'E1',
      positionLabel: 'Eixo 1 esquerdo',
      dot: 'DOT1234',
      fireMarking: 'FOGO-99',
      manufacturer: 'Michelin',
      brand: 'X Line',
      photoUrl,
      photoTimestamp: '2026-06-12T12:01:00Z',
      status: 'conforme',
      observation: 'Sem avarias',
      respondedAt: '2026-06-12T12:02:00Z',
    },
  ]);
  fetchTireInspectionComparison.mockResolvedValue([
    {
      positionCode: 'E1',
      positionLabel: 'Eixo 1 esquerdo',
      photos: [
        {
          inspectionId: inspection.id,
          inspectionDate: '2026-06-08T22:41:00Z',
          photoUrl,
          photoTimestamp: '2026-06-12T12:01:00Z',
          status: 'conforme',
          isCurrent: true,
        },
      ],
    },
  ]);
});

afterEach(() => {
  const root = (container as any).__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  queryClient.clear();
  document.body.removeChild(container);
  vi.clearAllMocks();
});

async function renderModal() {
  const root = createRoot(container);
  (container as any).__reactRoot = root;

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TireInspectionDetailModal inspection={inspection} onClose={() => {}} />
      </QueryClientProvider>,
    );
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

describe('TireInspectionDetailModal', () => {
  it('renders textual tire response details by position', async () => {
    await renderModal();

    await waitForAssertion(() => {
      expect(container.textContent).toContain('DOT1234');
    });
    expect(container.textContent).toContain('FOGO-99');
    expect(container.textContent).toContain('Michelin');
    expect(container.textContent).toContain('X Line');
    expect(container.textContent).toContain('Sem avarias');
  });

  it('opens and closes a photo lightbox', async () => {
    await renderModal();

    await waitForAssertion(() => {
      expect(container.querySelector(`img[src="${photoUrl}"]`)).not.toBeNull();
    });

    const photo = container.querySelector(`img[src="${photoUrl}"]`);

    await act(async () => {
      photo.closest('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelectorAll(`img[src="${photoUrl}"]`)).toHaveLength(2);

    const overlay = container.querySelector('.z-\\[60\\]');
    expect(overlay).not.toBeNull();

    await act(async () => {
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelectorAll(`img[src="${photoUrl}"]`)).toHaveLength(1);
  });

  it('renders the photo timestamp in comparison cards instead of the inspection date', async () => {
    await renderModal();

    await waitForAssertion(() => {
      expect(container.textContent).toContain(formatDate('2026-06-12T12:01:00Z'));
    });
    expect(container.textContent).not.toContain(formatDate('2026-06-08T22:41:00Z'));
  });
});
