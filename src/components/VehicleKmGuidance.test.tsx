import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import VehicleKmGuidance from './VehicleKmGuidance';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);
});

afterEach(() => {
  const root = container.__reactRoot;
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

describe('VehicleKmGuidance', () => {
  it('renderiza exatamente os 2 textos padronizados de aviso', () => {
    renderWithAct(<VehicleKmGuidance />);

    expect(container.textContent).toContain('Preencha apenas com números, sem pontos ou vírgulas.');
    expect(container.textContent).toContain(
      'Não confunda o Km do veículo com o Km da viagem. Observe o último Km registrado.',
    );
  });

  it('pode ser usado sem depender de props de tela específica', () => {
    expect(() => renderWithAct(<VehicleKmGuidance />)).not.toThrow();
  });
});
