import { describe, expect, it } from 'vitest';

import { buildUiStateKey } from '../lib/uiStateStorage';

import { getStoredChecklistTab, isOdometerUpdateChecklist, isValidChecklistTab } from './Checklists';

describe('getStoredChecklistTab', () => {
  it('falls back to checklists when storage is empty', () => {
    expect(getStoredChecklistTab(null)).toBe('checklists');
  });

  it('falls back to checklists when storage has an invalid value', () => {
    expect(getStoredChecklistTab('lixo')).toBe('checklists');
  });

  it('keeps tire inspections when stored', () => {
    expect(getStoredChecklistTab('tireInspections')).toBe('tireInspections');
  });

  it('keeps checklists when stored', () => {
    expect(getStoredChecklistTab('checklists')).toBe('checklists');
  });
});

describe('isValidChecklistTab', () => {
  it('accepts checklists', () => {
    expect(isValidChecklistTab('checklists')).toBe(true);
  });

  it('accepts tireInspections', () => {
    expect(isValidChecklistTab('tireInspections')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidChecklistTab('other')).toBe(false);
    expect(isValidChecklistTab(42)).toBe(false);
    expect(isValidChecklistTab(null)).toBe(false);
  });
});

describe('checklists tab scoped key', () => {
  it('builds the correct scoped key for the active tab', () => {
    const key = buildUiStateKey({
      scope: 'session',
      userId: 'user-1',
      clientId: 'client-1',
      module: 'checklists',
      stateKind: 'tab',
      name: 'active',
    });
    expect(key).toBe('bf:v1:ui:session:user-1:client-1:checklists:tab:active');
  });
});

describe('isOdometerUpdateChecklist', () => {
  it('seleciona apenas checklists de Atualizacao de Hodometro', () => {
    expect(isOdometerUpdateChecklist({ templateContext: 'Atualização de Hodômetro' })).toBe(true);
    expect(isOdometerUpdateChecklist({ templateContext: 'Rotina' })).toBe(false);
    expect(isOdometerUpdateChecklist({ templateContext: undefined })).toBe(false);
  });
});
