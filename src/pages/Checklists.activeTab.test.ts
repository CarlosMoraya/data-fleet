import { describe, expect, it } from 'vitest';
import { getStoredChecklistTab } from './Checklists';

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
