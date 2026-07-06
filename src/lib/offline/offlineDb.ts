import Dexie, { type Table } from 'dexie';

import type { ChecklistContext, ChecklistLocationStatus, ResponseStatus } from '../../types';
import type { TireInspectionResponseStatus } from '../../types/tireInspection';

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
      latitude: number | null;
      longitude: number | null;
      locationStatus: ChecklistLocationStatus;
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
    }
  | {
      type: 'save_tire_response';
      positionCode: string;
      tireId?: string;
      dot?: string;
      fireMarking?: string;
      manufacturer: string;
      brand: string;
      photoUrl: string;
      pendingPhotoKey?: string;
      photoTimestamp: string;
      status: TireInspectionResponseStatus;
      observation?: string;
      respondedAt: string;
    }
  | {
      type: 'confirm_tire_km';
      odometerKm: number;
      startedAt: string;
    }
  | {
      type: 'finish_tire_inspection';
      completedAt: string;
      vehicleId: string;
    };

// ─── Table row types ──────────────────────────────────────────────────────────

export interface SyncQueueEntry {
  id?: number;
  createdAt: number;
  /** ID do checklist regular. Para operações de inspeção de pneus, use inspectionId. */
  checklistId: string;
  /** ID da inspeção de pneus. Preenchido apenas para operações save_tire_response, confirm_tire_km e finish_tire_inspection. */
  inspectionId?: string;
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

export interface VehicleDraftFileEntry {
  key: string;
  file: File;
  savedAt: number;
}

export interface CouplingPlateHashEntry {
  hash: string;
  plateHint: string;
  validatedAt: number;
}

export interface CouplingDraftEntry {
  checklistId: string;
  action: 'Engate' | 'Desengate';
  clientId: string;
  trailerId: string;
  trailerPlate: string;
  tractorId?: string | null;
  tractorPlate: string;
  tractorDriverName: string;
  thirdPartyTractorId?: string | null;
  thirdPartyDriverId?: string | null;
  platePhotoUrl?: string;
  platePhotoPath?: string;
  platePhotoLat?: number;
  platePhotoLng?: number;
  openCouplingId?: string | null;
  openCouplingOdometer?: number | null;
  savedAt: number;
}

// ─── Dexie database ───────────────────────────────────────────────────────────

class OfflineDb extends Dexie {
  syncQueue!: Table<SyncQueueEntry, number>;
  photoBlobs!: Table<PhotoBlobEntry, string>;
  vehicleDraftFiles!: Table<VehicleDraftFileEntry, string>;
  couplingPlateHashes!: Table<CouplingPlateHashEntry, string>;
  couplingDrafts!: Table<CouplingDraftEntry, string>;

  constructor() {
    super('betafleet-offline-v1');
    this.version(1).stores({
      syncQueue: '++id, checklistId, status, createdAt',
      photoBlobs: 'key, checklistId',
    });
    // v2: adiciona índice em inspectionId (campo opcional, sem migration de dados)
    this.version(2).stores({
      syncQueue: '++id, checklistId, inspectionId, status, createdAt',
      photoBlobs: 'key, checklistId',
    });
    this.version(3).stores({
      syncQueue: '++id, checklistId, inspectionId, status, createdAt',
      photoBlobs: 'key, checklistId',
      vehicleDraftFiles: 'key',
    });
    this.version(4).stores({
      syncQueue: '++id, checklistId, inspectionId, status, createdAt',
      photoBlobs: 'key, checklistId',
      vehicleDraftFiles: 'key',
      couplingPlateHashes: 'hash, validatedAt',
      couplingDrafts: 'checklistId, action, trailerId, savedAt',
    });
  }
}

export const offlineDb = new OfflineDb();
