import { describe, expect, it } from 'vitest';

import { ODOMETER_UPDATE_CONTEXT, type ChecklistContext } from '../types';

import { canSaveTemplateWithoutItems } from './checklistTemplateRules';

describe('canSaveTemplateWithoutItems', () => {
  it('permite template sem itens para Atualizacao de Hodometro', () => {
    expect(canSaveTemplateWithoutItems(ODOMETER_UPDATE_CONTEXT)).toBe(true);
  });

  it.each<ChecklistContext>([
    'Rotina',
    'Auditoria',
    'Guincho',
    'Entrada em Oficina',
    'Saída de Oficina',
    'Segurança',
  ])('bloqueia template sem itens para %s', context => {
    expect(canSaveTemplateWithoutItems(context)).toBe(false);
  });
});
