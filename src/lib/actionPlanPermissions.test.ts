import { describe, expect, it } from 'vitest';

import {
  ACTION_PLAN_RESPONSIBLE_EXCLUDED_ROLES_FILTER,
  getActionPlanActionAvailability,
} from './actionPlanPermissions';

import type { ActionPlan } from '../types';

type Plan = Pick<ActionPlan, 'status' | 'claimedBy' | 'responsibleId'>;

describe('getActionPlanActionAvailability', () => {
  it('Yard Auditor responsável em plano pending pode assumir', () => {
    const plan: Plan = { status: 'pending', responsibleId: 'aud-1' };
    expect(getActionPlanActionAvailability('Yard Auditor', 'aud-1', plan)).toEqual({
      canClaim: true,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Yard Auditor responsável em plano in_progress pode concluir mesmo sem ser o autor da reivindicação', () => {
    const plan: Plan = { status: 'in_progress', responsibleId: 'aud-1', claimedBy: 'other-9' };
    expect(getActionPlanActionAvailability('Yard Auditor', 'aud-1', plan)).toEqual({
      canClaim: false,
      canConclude: true,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Yard Auditor responsável em plano awaiting_conclusion não pode concluir nem aprovar', () => {
    const plan: Plan = { status: 'awaiting_conclusion', responsibleId: 'aud-1' };
    expect(getActionPlanActionAvailability('Yard Auditor', 'aud-1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Yard Auditor responsável em plano completed não tem nenhuma ação', () => {
    const plan: Plan = { status: 'completed', responsibleId: 'aud-1' };
    expect(getActionPlanActionAvailability('Yard Auditor', 'aud-1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Yard Auditor de plano pending em que não é o responsável não pode assumir', () => {
    const plan: Plan = { status: 'pending', responsibleId: 'aud-2' };
    expect(getActionPlanActionAvailability('Yard Auditor', 'aud-1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Yard Auditor que reivindicou plano que não é seu não pode concluir', () => {
    const plan: Plan = { status: 'in_progress', responsibleId: 'aud-2', claimedBy: 'aud-1' };
    expect(getActionPlanActionAvailability('Yard Auditor', 'aud-1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('sem userId, Yard Auditor não tem nenhuma ação', () => {
    const plan: Plan = { status: 'pending', responsibleId: undefined };
    expect(getActionPlanActionAvailability('Yard Auditor', undefined, plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Fleet Assistant pode assumir plano pending', () => {
    const plan: Plan = { status: 'pending' };
    expect(getActionPlanActionAvailability('Fleet Assistant', 'u1', plan)).toEqual({
      canClaim: true,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Fleet Assistant pode concluir plano in_progress que reivindicou', () => {
    const plan: Plan = { status: 'in_progress', claimedBy: 'u1' };
    expect(getActionPlanActionAvailability('Fleet Assistant', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: true,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Fleet Assistant não pode concluir plano in_progress reivindicado por outro', () => {
    const plan: Plan = { status: 'in_progress', claimedBy: 'u2' };
    expect(getActionPlanActionAvailability('Fleet Assistant', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Fleet Analyst pode concluir plano in_progress mesmo reivindicado por outro', () => {
    const plan: Plan = { status: 'in_progress', claimedBy: 'u2' };
    expect(getActionPlanActionAvailability('Fleet Analyst', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: true,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Fleet Analyst pode aprovar ou rejeitar plano awaiting_conclusion', () => {
    const plan: Plan = { status: 'awaiting_conclusion' };
    expect(getActionPlanActionAvailability('Fleet Analyst', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: true,
      canReassignResponsible: false,
    });
  });

  it('Supervisor pode assumir plano pending', () => {
    const plan: Plan = { status: 'pending' };
    expect(getActionPlanActionAvailability('Supervisor', 'u1', plan)).toEqual({
      canClaim: true,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Coordinator pode aprovar ou rejeitar e reatribuir plano awaiting_conclusion', () => {
    const plan: Plan = { status: 'awaiting_conclusion' };
    expect(getActionPlanActionAvailability('Coordinator', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: true,
      canReassignResponsible: true,
    });
  });

  it('Coordinator não tem nenhuma ação em plano completed', () => {
    const plan: Plan = { status: 'completed' };
    expect(getActionPlanActionAvailability('Coordinator', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Admin Master pode concluir e reatribuir plano in_progress reivindicado por outro', () => {
    const plan: Plan = { status: 'in_progress', claimedBy: 'u2' };
    expect(getActionPlanActionAvailability('Admin Master', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: true,
      canApproveOrReject: false,
      canReassignResponsible: true,
    });
  });

  it('Driver não tem nenhuma ação em plano pending', () => {
    const plan: Plan = { status: 'pending' };
    expect(getActionPlanActionAvailability('Driver', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Operations Manager usa a tabela local do modal, não a oficial, e não tem nenhuma ação', () => {
    const plan: Plan = { status: 'awaiting_conclusion' };
    expect(getActionPlanActionAvailability('Operations Manager', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });

  it('Fleet Assistant não pode aprovar ou rejeitar plano awaiting_conclusion', () => {
    const plan: Plan = { status: 'awaiting_conclusion' };
    expect(getActionPlanActionAvailability('Fleet Assistant', 'u1', plan)).toEqual({
      canClaim: false,
      canConclude: false,
      canApproveOrReject: false,
      canReassignResponsible: false,
    });
  });
});

describe('ACTION_PLAN_RESPONSIBLE_EXCLUDED_ROLES_FILTER', () => {
  it('filtra os papéis excluídos para responsável', () => {
    expect(ACTION_PLAN_RESPONSIBLE_EXCLUDED_ROLES_FILTER).toBe('("Driver")');
  });
});