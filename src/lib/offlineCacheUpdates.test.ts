import { describe, expect, it } from 'vitest';
import { applyOfflineKm, applyOfflineWorkshop, upsertResponse } from './offlineCacheUpdates';

describe('offline cache updates', () => {
  it('applyOfflineKm injects odometerKm and preserves undefined input', () => {
    expect(applyOfflineKm(undefined, 123)).toBeUndefined();
    expect(applyOfflineKm({ id: 'checklist-1', odometerKm: null }, 123)).toEqual({
      id: 'checklist-1',
      odometerKm: 123,
    });
  });

  it('applyOfflineWorkshop injects workshopId', () => {
    expect(applyOfflineWorkshop({ id: 'checklist-1', workshopId: null }, 'workshop-1')).toEqual({
      id: 'checklist-1',
      workshopId: 'workshop-1',
    });
  });

  it('upsertResponse adds and replaces responses by item_id without duplicating', () => {
    const first = upsertResponse(undefined, { item_id: 'item-1', status: 'ok' });
    expect(first).toEqual([{ item_id: 'item-1', status: 'ok' }]);

    const second = upsertResponse(first, { item_id: 'item-1', status: 'issue' });
    expect(second).toEqual([{ item_id: 'item-1', status: 'issue' }]);
  });
});
