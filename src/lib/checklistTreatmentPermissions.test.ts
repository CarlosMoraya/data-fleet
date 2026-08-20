import { describe, expect, it } from 'vitest';

import {
  canCreateActionPlanFromChecklist,
  canMarkTreatedByTicket,
  canUnmarkTreatedByTicket,
} from './checklistTreatmentPermissions';

const baseInput = {
  role: 'Fleet Analyst',
  checklistStatus: 'completed' as const,
  hasIssues: true,
  blockWrite: false,
  stamp: 'none' as const,
};

function permissions(input: Parameters<typeof canCreateActionPlanFromChecklist>[0]) {
  return {
    create: canCreateActionPlanFromChecklist(input),
    mark: canMarkTreatedByTicket(input),
    unmark: canUnmarkTreatedByTicket(input),
  };
}

describe('checklist treatment permissions', () => {
  it('não permite nenhuma ação para Fleet Assistant', () => {
    expect(permissions({ ...baseInput, role: 'Fleet Assistant' })).toEqual({
      create: false,
      mark: false,
      unmark: false,
    });
  });

  it('permite criar plano e marcar para Fleet Analyst sem carimbo', () => {
    expect(permissions(baseInput)).toEqual({ create: true, mark: true, unmark: false });
  });

  it('permite somente desmarcar quando tratado por chamado', () => {
    expect(permissions({ ...baseInput, stamp: 'treated_by_ticket' })).toEqual({
      create: false,
      mark: false,
      unmark: true,
    });
  });

  it('permite somente criar plano quando já há plano em andamento', () => {
    expect(permissions({ ...baseInput, stamp: 'in_progress' })).toEqual({
      create: true,
      mark: false,
      unmark: false,
    });
  });

  it('não permite ações em checklist em andamento', () => {
    expect(permissions({ ...baseInput, checklistStatus: 'in_progress' })).toEqual({
      create: false,
      mark: false,
      unmark: false,
    });
  });

  it('não permite ações quando a escrita está bloqueada', () => {
    expect(permissions({ ...baseInput, blockWrite: true })).toEqual({
      create: false,
      mark: false,
      unmark: false,
    });
  });

  it('permite as ações correspondentes para Admin Master', () => {
    expect(permissions({ ...baseInput, role: 'Admin Master' })).toEqual({
      create: true,
      mark: true,
      unmark: false,
    });
    expect(permissions({ ...baseInput, role: 'Admin Master', stamp: 'treated_by_ticket' })).toEqual({
      create: false,
      mark: false,
      unmark: true,
    });
  });
});
