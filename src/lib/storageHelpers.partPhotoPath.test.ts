import { describe, expect, it } from 'vitest';

import { buildMaintenancePartPhotoPath } from './storageHelpers';

describe('buildMaintenancePartPhotoPath', () => {
  it('builds maintenance part photo storage path with parts segment', () => {
    expect(buildMaintenancePartPhotoPath('c1', 'o1', '123-abc.jpg')).toBe('c1/maintenance/o1/parts/123-abc.jpg');
  });
});
