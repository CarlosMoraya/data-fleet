import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock, selectMock, eqMock, notMock, orderMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  notMock: vi.fn(),
  orderMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

let authRole = 'Coordinator';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: authRole },
    currentClient: { id: 'client-1' },
  }),
}));

import ActionPlanModal from './ActionPlanModal';

import type { ActionPlan } from '../types';

interface RootedDiv extends HTMLDivElement {
  __reactRoot?: Root;
}

let container: RootedDiv;

beforeEach(() => {
  container = document.createElement('div') as RootedDiv;
  document.body.appendChild(container);

  rpcMock.mockReset();
  fromMock.mockReset();
  selectMock.mockReset();
  eqMock.mockReset();
  notMock.mockReset();
  orderMock.mockReset();

  orderMock.mockResolvedValue({ data: [{ id: 'resp-2', name: 'Ana Coordenadora' }], error: null });
  notMock.mockReturnValue({ order: orderMock });
  eqMock.mockReturnValue({ not: notMock });
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
});

function renderWithAct(ui: React.ReactElement) {
  const root = createRoot(container);
  container.__reactRoot = root;
  act(() => {
    root.render(ui);
  });
}

function basePlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    id: 'plan-1',
    clientId: 'client-1',
    checklistId: 'checklist-1',
    suggestedAction: 'Trocar pastilha de freio',
    status: 'pending',
    responsibleId: 'resp-1',
    responsibleName: 'João Responsável',
    ...overrides,
  } as ActionPlan;
}

describe('ActionPlanModal — reatribuição de responsável', () => {
  it('exibe o controle de reatribuição para Coordinator+', () => {
    authRole = 'Coordinator';
    renderWithAct(
      <ActionPlanModal plan={basePlan()} onClose={() => {}} onSaved={() => {}} />,
    );

    expect(container.textContent).toContain('Alterar responsável');
  });

  it('não exibe o controle de reatribuição para perfil abaixo de Coordinator', () => {
    authRole = 'Fleet Analyst';
    renderWithAct(
      <ActionPlanModal plan={basePlan()} onClose={() => {}} onSaved={() => {}} />,
    );

    expect(container.textContent).not.toContain('Alterar responsável');
  });

  it('não exibe o controle de reatribuição quando o plano está concluído, mesmo para Coordinator+', () => {
    authRole = 'Coordinator';
    renderWithAct(
      <ActionPlanModal plan={basePlan({ status: 'completed' })} onClose={() => {}} onSaved={() => {}} />,
    );

    expect(container.textContent).not.toContain('Alterar responsável');
  });

  it('dispara o caminho de persistência via RPC dedicada ao salvar a reatribuição', async () => {
    authRole = 'Coordinator';
    rpcMock.mockResolvedValue({ data: null, error: null });
    const onReassigned = vi.fn();

    renderWithAct(
      <ActionPlanModal plan={basePlan()} onClose={() => {}} onSaved={() => {}} onReassigned={onReassigned} />,
    );

    const openButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Alterar responsável',
    )!;
    await act(async () => {
      openButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'resp-2';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Salvar',
    )!;
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rpcMock).toHaveBeenCalledWith('reassign_action_plan_responsible', {
      p_action_plan_id: 'plan-1',
      p_responsible_id: 'resp-2',
    });
    expect(onReassigned).toHaveBeenCalled();
  });
});
