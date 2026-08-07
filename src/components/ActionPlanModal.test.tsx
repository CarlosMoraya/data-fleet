import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, fromMock, selectMock, eqMock, notMock, orderMock, signedUrlMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  notMock: vi.fn(),
  orderMock: vi.fn(),
  signedUrlMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

vi.mock('../lib/storageHelpers', () => ({
  uploadActionPlanEvidence: vi.fn(),
  getFleetTicketAttachmentSignedUrl: signedUrlMock,
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
  signedUrlMock.mockReset();
  signedUrlMock.mockResolvedValue('https://signed.example.com/foto.jpg');

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

describe('ActionPlanModal — origem do plano', () => {
  it('exibe o campo Origem com o número do chamado e oculta Template/Item inspecionado para origem chamado', () => {
    authRole = 'Coordinator';
    renderWithAct(
      <ActionPlanModal
        plan={basePlan({
          checklistId: undefined,
          fleetTicketId: 'ticket-1',
          fleetTicketNumber: 'CH-2608-0001',
          fleetTicketTitle: 'Vazamento de óleo',
        })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(container.textContent).toContain('Origem');
    expect(container.textContent).toContain('Chamado CH-2608-0001');
    expect(container.textContent).not.toContain('Template');
    expect(container.textContent).not.toContain('Item inspecionado');
  });

  it('resolve o caminho bruto do Storage em URL assinada para foto de plano de origem chamado', async () => {
    authRole = 'Coordinator';
    renderWithAct(
      <ActionPlanModal
        plan={basePlan({
          checklistId: undefined,
          fleetTicketId: 'ticket-1',
          fleetTicketNumber: 'CH-2608-0001',
          photoUrl: 'client-1/fleet-tickets/ticket-1/attachment-123.jpg',
        })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(container.textContent).toContain('Carregando foto...');

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(signedUrlMock).toHaveBeenCalledWith('client-1/fleet-tickets/ticket-1/attachment-123.jpg');
    const img = container.querySelector('img[alt="foto"]') as HTMLImageElement;
    expect(img.src).toBe('https://signed.example.com/foto.jpg');
  });

  it('exibe mensagem de erro quando a URL assinada da foto falha', async () => {
    authRole = 'Coordinator';
    signedUrlMock.mockRejectedValue(new Error('falha ao assinar'));
    renderWithAct(
      <ActionPlanModal
        plan={basePlan({
          checklistId: undefined,
          fleetTicketId: 'ticket-1',
          photoUrl: 'client-1/fleet-tickets/ticket-1/attachment-123.jpg',
        })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain('Não foi possível carregar a foto.');
    expect(container.querySelector('img[alt="foto"]')).toBeNull();
  });

  it('usa plan.photoUrl diretamente (sem gerar URL assinada) para origem checklist', async () => {
    authRole = 'Coordinator';
    renderWithAct(
      <ActionPlanModal
        plan={basePlan({
          checklistId: 'checklist-1',
          photoUrl: 'https://public.example.com/checklist-photo.jpg',
        })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await act(async () => { await Promise.resolve(); });

    expect(signedUrlMock).not.toHaveBeenCalled();
    const img = container.querySelector('img[alt="foto"]') as HTMLImageElement;
    expect(img.src).toBe('https://public.example.com/checklist-photo.jpg');
  });
});

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
