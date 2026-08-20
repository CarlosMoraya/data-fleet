import { describe, expect, it } from 'vitest';

import {
  checklistActionPlanStampColor,
  checklistActionPlanStampLabel,
  computeChecklistActionPlanStamp,
} from './checklistActionPlanStamp';

describe('computeChecklistActionPlanStamp', () => {
  it('prioriza tratamento por chamado sobre planos abertos', () => {
    expect(computeChecklistActionPlanStamp({ planStatuses: ['pending'], treatedByTicket: true }))
      .toBe('treated_by_ticket');
  });

  it.each(['pending', 'awaiting_conclusion'] as const)('considera %s como plano em andamento', (status) => {
    expect(computeChecklistActionPlanStamp({ planStatuses: [status], treatedByTicket: false }))
      .toBe('in_progress');
  });

  it('prioriza plano em andamento quando também há planos concluídos', () => {
    expect(computeChecklistActionPlanStamp({
      planStatuses: ['completed', 'completed', 'pending'],
      treatedByTicket: false,
    })).toBe('in_progress');
  });

  it.each([
    [['completed']],
    [['completed', 'cancelled']],
  ] as const)('considera %j como plano concluído', (planStatuses) => {
    expect(computeChecklistActionPlanStamp({ planStatuses, treatedByTicket: false })).toBe('completed');
  });

  it('não carimba quando todos os planos estão cancelados', () => {
    expect(computeChecklistActionPlanStamp({
      planStatuses: ['cancelled', 'cancelled'],
      treatedByTicket: false,
    })).toBe('none');
  });

  it('não carimba quando não há planos', () => {
    expect(computeChecklistActionPlanStamp({ planStatuses: [], treatedByTicket: false })).toBe('none');
  });
});

describe('checklistActionPlanStampLabel', () => {
  it.each([
    ['none', null],
    ['in_progress', 'Plano de ação em andamento'],
    ['completed', 'Plano de ação concluído'],
    ['treated_by_ticket', 'Tratado por chamado'],
  ] as const)('retorna o rótulo correto para %s', (stamp, expected) => {
    expect(checklistActionPlanStampLabel(stamp)).toBe(expected);
  });
});

describe('checklistActionPlanStampColor', () => {
  it.each([
    ['none', ''],
    ['in_progress', 'bg-amber-100 text-amber-800'],
    ['completed', 'bg-emerald-100 text-emerald-800'],
    ['treated_by_ticket', 'bg-orange-100 text-orange-800'],
  ] as const)('retorna a cor correta para %s', (stamp, expected) => {
    expect(checklistActionPlanStampColor(stamp)).toBe(expected);
  });
});
