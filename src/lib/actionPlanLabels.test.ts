import { describe, expect, it } from 'vitest';

import { actionPlanLabelsFromRow, mergeActionPlanLabels } from './actionPlanLabels';

import type { ActionPlan } from '../types';

const plan = (overrides: Partial<ActionPlan> = {}) =>
  ({
    id: 'p1',
    clientId: 'c1',
    suggestedAction: 'Verificar freio',
    status: 'pending',
    ...overrides,
  }) as ActionPlan;

describe('actionPlanLabelsFromRow', () => {
  it('converte nulls em undefined', () => {
    expect(
      actionPlanLabelsFromRow({
        action_plan_id: 'p1',
        reported_by_name: 'Beatriz Lima',
        assigned_by_name: null,
        claimed_by_name: null,
        completed_by_name: null,
        responsible_name: 'Carlos Auditor',
        template_name: null,
        item_title: 'Pneus',
      }),
    ).toEqual({
      actionPlanId: 'p1',
      reportedByName: 'Beatriz Lima',
      assignedByName: undefined,
      claimedByName: undefined,
      completedByName: undefined,
      responsibleName: 'Carlos Auditor',
      templateName: undefined,
      itemTitle: 'Pneus',
    });
  });
});

describe('mergeActionPlanLabels', () => {
  it('junta os rótulos no plano quando há correspondência por id', () => {
    const merged = mergeActionPlanLabels([plan()], [
      {
        actionPlanId: 'p1',
        reportedByName: 'Beatriz Lima',
        assignedByName: 'Beatriz Lima',
        responsibleName: 'Carlos Auditor',
        templateName: 'Checklist Diário',
        itemTitle: 'Pneus',
      },
    ])[0];
    expect(merged.reportedByName).toBe('Beatriz Lima');
    expect(merged.assignedByName).toBe('Beatriz Lima');
    expect(merged.responsibleName).toBe('Carlos Auditor');
    expect(merged.templateName).toBe('Checklist Diário');
    expect(merged.itemTitle).toBe('Pneus');
    expect(merged.claimedByName).toBeUndefined();
    expect(merged.suggestedAction).toBe('Verificar freio');
  });

  it('o valor já presente no plano vence o rótulo', () => {
    const merged = mergeActionPlanLabels([plan({ responsibleName: 'Nome do Join' })], [
      { actionPlanId: 'p1', responsibleName: 'Outro Nome' },
    ])[0];
    expect(merged.responsibleName).toBe('Nome do Join');
  });

  it('sem rótulo correspondente, devolve o próprio plano', () => {
    const p2 = plan({ id: 'p2' });
    const merged = mergeActionPlanLabels([p2], [{ actionPlanId: 'p1', reportedByName: 'X' }])[0];
    expect(merged).toBe(p2);
    expect(merged.reportedByName).toBeUndefined();
  });

  it('não muta a entrada', () => {
    const original = plan();
    const result = mergeActionPlanLabels([original], [{ actionPlanId: 'p1', reportedByName: 'Beatriz Lima' }]);
    expect(original.reportedByName).toBeUndefined();
    expect(result[0]).not.toBe(original);
  });
});