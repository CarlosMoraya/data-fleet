import { describe, expect, it } from 'vitest';

import { matchesChecklistActionPlanFilter } from './checklistActionPlanFilter';

describe('matchesChecklistActionPlanFilter', () => {
  it('não filtra quando a seleção está vazia', () => {
    expect(matchesChecklistActionPlanFilter({ stamp: 'completed', hasIssues: false, selected: [] })).toBe(true);
  });

  it.each([
    ['none', true],
    ['in_progress', false],
    ['completed', false],
    ['treated_by_ticket', false],
  ] as const)('aceita a seleção isolada %s quando o carimbo corresponde', (stamp, hasIssues) => {
    expect(matchesChecklistActionPlanFilter({ stamp, hasIssues, selected: [stamp] })).toBe(true);
  });

  it.each([
    ['none', 'completed', true],
    ['in_progress', 'completed', true],
    ['completed', 'in_progress', true],
    ['treated_by_ticket', 'completed', true],
  ] as const)('rejeita %s quando o carimbo é %s', (selected, stamp, hasIssues) => {
    expect(matchesChecklistActionPlanFilter({ stamp, hasIssues, selected: [selected] })).toBe(false);
  });

  it('não inclui checklist sem inconformidades na opção Sem plano', () => {
    expect(matchesChecklistActionPlanFilter({ stamp: 'none', hasIssues: false, selected: ['none'] })).toBe(false);
  });

  it('inclui checklist com inconformidades na opção Sem plano', () => {
    expect(matchesChecklistActionPlanFilter({ stamp: 'none', hasIssues: true, selected: ['none'] })).toBe(true);
  });

  it.each(['in_progress', 'completed'] as const)('aceita %s em seleção múltipla', (stamp) => {
    expect(matchesChecklistActionPlanFilter({
      stamp,
      hasIssues: true,
      selected: ['in_progress', 'completed'],
    })).toBe(true);
  });

  it('rejeita none em seleção múltipla que não contém none', () => {
    expect(matchesChecklistActionPlanFilter({
      stamp: 'none',
      hasIssues: true,
      selected: ['in_progress', 'completed'],
    })).toBe(false);
  });

  it.each(['treated_by_ticket', 'completed'] as const)('ignora hasIssues para %s', (stamp) => {
    expect(matchesChecklistActionPlanFilter({ stamp, hasIssues: false, selected: [stamp] })).toBe(true);
  });
});
