import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useMutationMock,
  useQueryClientMock,
  useQueryMock,
  invitationFromRowMock,
  locationGetterMock,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  useQueryMock: vi.fn(),
  invitationFromRowMock: vi.fn(),
  locationGetterMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: useMutationMock,
    useQuery: useQueryMock,
    useQueryClient: useQueryClientMock,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentClient: { id: 'client-1' },
  }),
}));

vi.mock('../lib/workshopAccountMappers', () => ({
  workshopInvitationFromRow: invitationFromRowMock,
}));

import InviteWorkshopModal from './InviteWorkshopModal';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

function setMockLocation(url: string) {
  locationGetterMock.mockReturnValue(new URL(url) as unknown as Location);
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  vi.spyOn(window, 'location', 'get').mockImplementation(locationGetterMock);
  setMockLocation('http://localhost:3000/checklists');

  useQueryClientMock.mockReturnValue({
    invalidateQueries: vi.fn(),
  });
  useMutationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
  useQueryMock
    .mockReturnValueOnce({
      data: [
        {
          id: 'invitation-1',
          token: 'token-123',
          expiresAt: '2026-08-04T00:00:00Z',
        },
      ],
      isLoading: false,
    })
    .mockReturnValueOnce({
      data: [],
      isLoading: false,
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
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function renderModal() {
  const root = createRoot(container);
  container.__reactRoot = root;

  act(() => {
    root.render(<InviteWorkshopModal onClose={() => {}} />);
  });
}

describe('InviteWorkshopModal', () => {
  it('shows a local invite URL and development warning on localhost', () => {
    renderModal();

    expect(container.textContent).toContain('http://localhost:3000/workshop/join?token=token-123');
    expect(container.textContent).toContain('Você está em um ambiente de desenvolvimento.');
  });

  it('uses the production origin and hides the development warning outside local hosts', () => {
    setMockLocation('https://app.betafleet.com.br/workshops');
    renderModal();

    expect(container.textContent).toContain('https://app.betafleet.com.br/workshop/join?token=token-123');
    expect(container.textContent).not.toContain('Você está em um ambiente de desenvolvimento.');
  });
});
