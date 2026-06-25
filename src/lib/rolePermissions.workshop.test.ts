import { describe, expect, it } from 'vitest';

import { canEditWorkshopOrder, canManagePartPhotos, canViewPartPhotos } from './rolePermissions';

describe('rolePermissions workshop helpers', () => {
  it('allows only Workshop to edit workshop order', () => {
    expect(canEditWorkshopOrder('Workshop')).toBe(true);
    expect(canEditWorkshopOrder('Fleet Assistant')).toBe(false);
    expect(canEditWorkshopOrder('Fleet Analyst')).toBe(false);
    expect(canEditWorkshopOrder('Director')).toBe(false);
    expect(canEditWorkshopOrder('Admin Master')).toBe(false);
    expect(canEditWorkshopOrder(undefined)).toBe(false);
  });

  it('allows Workshop and Fleet Assistant+ to view part photos', () => {
    expect(canViewPartPhotos('Workshop')).toBe(true);
    expect(canViewPartPhotos('Fleet Assistant')).toBe(true);
    expect(canViewPartPhotos('Director')).toBe(true);
    expect(canViewPartPhotos('Admin Master')).toBe(true);
    expect(canViewPartPhotos('Driver')).toBe(false);
    expect(canViewPartPhotos('Yard Auditor')).toBe(false);
  });

  it('allows only Fleet Assistant+ to manage part photos in modal', () => {
    expect(canManagePartPhotos('Fleet Assistant')).toBe(true);
    expect(canManagePartPhotos('Fleet Analyst')).toBe(true);
    expect(canManagePartPhotos('Director')).toBe(true);
    expect(canManagePartPhotos('Admin Master')).toBe(true);
    expect(canManagePartPhotos('Workshop')).toBe(false);
    expect(canManagePartPhotos('Driver')).toBe(false);
    expect(canManagePartPhotos('Yard Auditor')).toBe(false);
  });
});
