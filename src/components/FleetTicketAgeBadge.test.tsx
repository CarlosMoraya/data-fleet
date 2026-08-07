import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import FleetTicketAgeBadge from './FleetTicketAgeBadge';

import type { FleetTicketSlaEvaluation } from '../lib/fleetTicketSla';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

function render(evaluation: FleetTicketSlaEvaluation | null) {
  const root = createRoot(container);
  act(() => {
    root.render(<FleetTicketAgeBadge evaluation={evaluation} />);
  });
  return root;
}

describe('FleetTicketAgeBadge', () => {
  it('renders nothing when evaluation is null', () => {
    const root = render(null);
    expect(container.innerHTML).toBe('');
    act(() => root.unmount());
  });

  it('renders a discreet label without icon or background when within SLA', () => {
    const evaluation: FleetTicketSlaEvaluation = {
      scope: 'open',
      elapsedHours: 5,
      slaHours: 24,
      breached: false,
      label: 'há 5 h',
      description: 'Aberto há 5 h',
    };
    const root = render(evaluation);
    expect(container.textContent).toBe('há 5 h');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.bg-red-50')).toBeNull();
    expect(container.querySelector('.bg-amber-50')).toBeNull();
    act(() => root.unmount());
  });

  it('renders a red pill with aria-label containing "sem responsável" when breached and scope is open', () => {
    const evaluation: FleetTicketSlaEvaluation = {
      scope: 'open',
      elapsedHours: 30,
      slaHours: 24,
      breached: true,
      label: 'há 1 dia',
      description: 'Aberto há 1 dia — SLA de 24 h para chamados sem responsável foi ultrapassado',
    };
    const root = render(evaluation);
    const span = container.querySelector('span') as HTMLSpanElement;
    expect(span.className).toContain('text-red-700');
    expect(span.getAttribute('aria-label')).toContain('sem responsável');
    act(() => root.unmount());
  });

  it('renders an amber pill with aria-label containing "assumidos" when breached and scope is assigned', () => {
    const evaluation: FleetTicketSlaEvaluation = {
      scope: 'assigned',
      elapsedHours: 80,
      slaHours: 72,
      breached: true,
      label: 'há 3 dias',
      description: 'Aberto há 3 dias — SLA de 72 h para chamados assumidos foi ultrapassado',
    };
    const root = render(evaluation);
    const span = container.querySelector('span') as HTMLSpanElement;
    expect(span.className).toContain('text-amber-700');
    expect(span.getAttribute('aria-label')).toContain('assumidos');
    act(() => root.unmount());
  });
});
