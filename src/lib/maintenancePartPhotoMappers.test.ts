import { describe, expect, it } from 'vitest';

import { partPhotoFromRow } from './maintenanceMappers';

describe('partPhotoFromRow', () => {
  it('maps snake_case row to camelCase photo', () => {
    expect(partPhotoFromRow({
      id: 'photo-1',
      maintenance_order_id: 'order-1',
      client_id: 'client-1',
      type: 'broken',
      url: 'https://example.com/photo.jpg',
      caption: 'Peça quebrada',
      taken_at: '2026-06-25T10:00:00.000Z',
      uploaded_by: 'user-1',
      created_at: '2026-06-25T10:05:00.000Z',
    })).toEqual({
      id: 'photo-1',
      maintenanceOrderId: 'order-1',
      clientId: 'client-1',
      type: 'broken',
      url: 'https://example.com/photo.jpg',
      caption: 'Peça quebrada',
      takenAt: '2026-06-25T10:00:00.000Z',
      uploadedBy: 'user-1',
      createdAt: '2026-06-25T10:05:00.000Z',
    });
  });

  it('converts nullable caption and uploaded_by to undefined', () => {
    expect(partPhotoFromRow({
      id: 'photo-2',
      maintenance_order_id: 'order-2',
      client_id: 'client-2',
      type: 'new',
      url: 'https://example.com/photo-2.jpg',
      caption: null,
      taken_at: '2026-06-25T11:00:00.000Z',
      uploaded_by: null,
      created_at: '2026-06-25T11:05:00.000Z',
    })).toEqual({
      id: 'photo-2',
      maintenanceOrderId: 'order-2',
      clientId: 'client-2',
      type: 'new',
      url: 'https://example.com/photo-2.jpg',
      caption: undefined,
      takenAt: '2026-06-25T11:00:00.000Z',
      uploadedBy: undefined,
      createdAt: '2026-06-25T11:05:00.000Z',
    });
  });
});
