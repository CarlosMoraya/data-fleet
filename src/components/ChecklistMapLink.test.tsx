import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ChecklistMapLink from './ChecklistMapLink';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  if (container.__reactRoot) {
    act(() => {
      container.__reactRoot?.unmount();
    });
  }
  container.remove();
});

function render(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

describe('ChecklistMapLink', () => {
  it('renders the link with coordinates in the href', () => {
    render(<ChecklistMapLink latitude={-23.5} longitude={-46.6} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://www.google.com/maps?q=-23.5,-46.6');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.textContent).toContain('Ver no mapa');
  });

  it('renders nothing when coordinates are missing', () => {
    render(<ChecklistMapLink latitude={undefined} longitude={undefined} />);
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders the link when coordinates are zero', () => {
    render(<ChecklistMapLink latitude={0} longitude={0} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://www.google.com/maps?q=0,0');
  });
});
