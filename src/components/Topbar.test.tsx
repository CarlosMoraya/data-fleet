import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authState } = vi.hoisted(() => ({
  authState: {
    user: { name: 'Ana Operadora', role: 'Fleet Analyst' as const },
    currentClient: { id: 'client-1', name: 'Beta Fleet' },
    clients: [{ id: 'client-1', name: 'Beta Fleet' }],
    switchClient: vi.fn(),
    canSwitchClient: false,
    workshopPartnerships: [],
  },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./FleetTicketBell', () => ({ default: () => <span data-testid="fleet-ticket-bell">Sino</span> }));
vi.mock('./LocalWeatherChip', () => ({ default: () => <span data-testid="local-weather-chip">Clima local</span> }));

import Topbar from './Topbar';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  authState.canSwitchClient = false;
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
});

function renderTopbar() {
  act(() => root.render(<Topbar onMenuClick={vi.fn()} />));
}

describe('Topbar', () => {
  it('renderiza o chip entre o sino e o usuário', () => {
    renderTopbar();
    const rightBlock = container.querySelector('header > div:last-child') as HTMLDivElement;
    expect(rightBlock.children[0].getAttribute('data-testid')).toBe('fleet-ticket-bell');
    expect(rightBlock.children[1].getAttribute('data-testid')).toBeNull();
    expect(rightBlock.children[1].textContent).toContain('Clima local');
    expect(rightBlock.children[2].textContent).toContain('Ana Operadora');
    expect(container.textContent).toContain('Fleet Analyst');
  });

  it('mantém a seleção de cliente quando canSwitchClient é true', () => {
    authState.canSwitchClient = true;
    renderTopbar();
    expect(container.querySelector('select[aria-label="Selecionar transportadora"]')).not.toBeNull();
    expect(container.textContent).toContain('Clima local');
  });

  it('mantém o cliente fixo quando canSwitchClient é false', () => {
    authState.canSwitchClient = false;
    renderTopbar();
    expect(container.querySelector('select[aria-label="Selecionar transportadora"]')).toBeNull();
    expect(container.textContent).toContain('Beta Fleet');
  });
});
