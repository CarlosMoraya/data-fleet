import Dexie, { type Table } from 'dexie';
import type { ChecklistContext, ResponseStatus } from '../../types';

// ─── Sync operation types ─────────────────────────────────────────────────────

export type SyncOperation =
  | {
      type: 'save_response';
      itemId: string;
      status: ResponseStatus;
      observation: string;
      photoUrl: string;
      pendingPhotoKey?: string;
      respondedAt: string;
    }
  | {
      type: 'confirm_km';
      odometerKm: number;
    }
  | {
      type: 'confirm_workshop';
      workshopId: string;
    }
  | {
      type: 'finish_checklist';
      completedAt: string;
      templateContext: ChecklistContext | null;
      workshopId?: string;
      vehicleId?: string;
    };

// ─── Table row types ──────────────────────────────────────────────────────────

export interface SyncQueueEntry {
  id?: number;
  createdAt: number;
  checklistId: string;
  op: SyncOperation;
  status: 'pending' | 'syncing' | 'error';
  errorMessage?: string;
  retryCount: number;
}

export interface PhotoBlobEntry {
  key: string; // `${checklistId}/${itemId}/${timestamp}`
  blob: Blob;
  clientId: string;
  checklistId: string;
  itemId: string;
  capturedAt: number;
}

// ─── Dexie database ───────────────────────────────────────────────────────────

class OfflineDb extends Dexie {
  syncQueue!: Table<SyncQueueEntry, number>;
  photoBlobs!: Table<PhotoBlobEntry, string>;

  constructor() {
    super('betafleet-offline-v1');
    this.version(1).stores({
      syncQueue: '++id, checklistId, status, createdAt',
      photoBlobs: 'key, checklistId',
    });
  }
}

export const offlineDb = new OfflineDb();
