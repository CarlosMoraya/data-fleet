import { describe, expect, it } from 'vitest';

import { filterByActive } from './registryActiveFilter';

describe('filterByActive', () => {
  it('returns only active items when showInactive=false', () => {
    expect(
      filterByActive(
        [
          { id: '1', active: true },
          { id: '2', active: false },
          { id: '3', active: true },
        ],
        false,
      ).map((item) => item.id),
    ).toEqual(['1', '3']);
  });

  it('returns all items when showInactive=true', () => {
    expect(
      filterByActive(
        [
          { id: '1', active: true },
          { id: '2', active: false },
        ],
        true,
      ).map((item) => item.id),
    ).toEqual(['1', '2']);
  });

  it('treats items without active as active', () => {
    expect(
      filterByActive(
        [
          { id: '1' },
          { id: '2', active: false },
        ],
        false,
      ).map((item) => item.id),
    ).toEqual(['1']);
  });
});
