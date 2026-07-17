import { describe, expect, it } from 'vitest';

import { resolveExportSelection } from './exportSelection';

type Item = { id: string; name: string };

describe('resolveExportSelection', () => {
  it('returns the whole filtered list when nothing is selected', () => {
    const filtered: Item[] = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
    expect(resolveExportSelection(filtered, new Set())).toEqual(filtered);
  });

  it('returns only the selected items, preserving filtered order', () => {
    const filtered: Item[] = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];
    const selected = new Set(['3', '1']);
    expect(resolveExportSelection(filtered, selected)).toEqual([
      { id: '1', name: 'A' },
      { id: '3', name: 'C' },
    ]);
  });

  it('ignores selected ids that are not present in filtered', () => {
    const filtered: Item[] = [{ id: '1', name: 'A' }];
    const selected = new Set(['1', 'nonexistent']);
    expect(resolveExportSelection(filtered, selected)).toEqual([{ id: '1', name: 'A' }]);
  });
});
