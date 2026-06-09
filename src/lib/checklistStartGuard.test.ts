import { describe, it, expect } from 'vitest';
import {
  getChecklistStartBlockMessage,
  getTireInspectionStartBlockMessage,
  OFFLINE_CHECKLIST_START_MESSAGE,
  OFFLINE_TIRE_INSPECTION_START_MESSAGE,
} from './checklistStartGuard';

describe('getChecklistStartBlockMessage', () => {
  it('returns null when online', () => {
    expect(getChecklistStartBlockMessage(true)).toBeNull();
  });

  it('returns block message when offline', () => {
    expect(getChecklistStartBlockMessage(false)).toBe(OFFLINE_CHECKLIST_START_MESSAGE);
  });
});

describe('getTireInspectionStartBlockMessage', () => {
  it('returns null when online', () => {
    expect(getTireInspectionStartBlockMessage(true)).toBeNull();
  });

  it('returns block message when offline', () => {
    expect(getTireInspectionStartBlockMessage(false)).toBe(OFFLINE_TIRE_INSPECTION_START_MESSAGE);
  });
});
