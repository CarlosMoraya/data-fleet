import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import OverviewPanel from './OverviewPanel';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  const root = (container as any).__reactRoot;
  if (root) {
    act(() => { root.unmount(); });
  }
  document.body.removeChild(container);
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  (container as any).__reactRoot = root;
  act(() => { root.render(ui); });
  return root;
}

const baseProps = {
  totalVehicles: 10,
  vehiclesInMaintenance: 2,
  availabilityRate: 80,
  openOrdersCount: 3,
  overdueOrdersCount: 1,
  pendingApprovalCount: 0,
  totalApprovedCost: 5000,
  complianceRate: 95,
  expiredDocsCount: 2,
  expiringSoonDocsCount: 5,
  actionItems: [],
  isLoading: false,
};

describe('OverviewPanel — "Documentos a Vencer (30d)" subtitle', () => {
  it('subtitle mentions CRLV, CNH and GR to match the calculation', () => {
    renderWithAct(<OverviewPanel {...baseProps} />);

    const text = container.textContent ?? '';

    expect(text).toContain('CRLV');
    expect(text).toContain('CNH');
    expect(text).toContain('GR');
    expect(text).toContain('Documentos a Vencer (30d)');
  });
});
