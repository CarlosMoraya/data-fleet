import { offlineDb, type SyncOperation, type SyncQueueEntry } from './offlineDb';
import { supabase } from '../supabase';
import { uploadChecklistPhoto } from '../checklistStorageHelpers';
import { autoCompleteWorkshopSchedule } from '../workshopScheduleUtils';

// ─── Concurrency guard ────────────────────────────────────────────────────────

let isFlushRunning = false;

// ─── Enqueue helpers ──────────────────────────────────────────────────────────

export async function enqueueOperation(
  op: SyncOperation,
  checklistId: string,
  inspectionId?: string,
): Promise<number> {
  return offlineDb.syncQueue.add({
    createdAt: Date.now(),
    checklistId,
    inspectionId,
    op,
    status: 'pending',
    retryCount: 0,
  });
}

export async function enqueuePhoto(
  blob: Blob,
  clientId: string,
  checklistId: string,
  itemId: string,
): Promise<string> {
  const key = `${checklistId}/${itemId}/${Date.now()}`;
  await offlineDb.photoBlobs.put({
    key,
    blob,
    clientId,
    checklistId,
    itemId,
    capturedAt: Date.now(),
  });
  return key;
}

// ─── Flush queue ─────────────────────────────────────────────────────────────

export async function flushQueue(): Promise<void> {
  if (isFlushRunning) return;
  isFlushRunning = true;

  try {
    // Process entries one by one in FIFO order
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Atomically claim one pending entry
      let entry: SyncQueueEntry | undefined;
      await offlineDb.transaction('rw', offlineDb.syncQueue, async () => {
        entry = await offlineDb.syncQueue
          .where('status')
          .equals('pending')
          .first();
        if (entry?.id != null) {
          await offlineDb.syncQueue.update(entry.id, { status: 'syncing' });
        }
      });

      if (!entry) break;

      try {
        await processEntry(entry);
        await offlineDb.syncQueue.delete(entry.id!);
      } catch (err) {
        const newRetryCount = (entry.retryCount ?? 0) + 1;
        await offlineDb.syncQueue.update(entry.id!, {
          status: newRetryCount >= 3 ? 'error' : 'pending',
          errorMessage: err instanceof Error ? err.message : String(err),
          retryCount: newRetryCount,
        });
        // Continue processing remaining entries even if one fails
      }
    }
  } finally {
    isFlushRunning = false;
  }
}

// ─── Process a single entry ───────────────────────────────────────────────────

async function processEntry(entry: SyncQueueEntry): Promise<void> {
  const { op, checklistId, inspectionId } = entry;

  switch (op.type) {
    case 'save_response': {
      let photoUrl = op.photoUrl;

      // Upload pending photo blob if any
      if (op.pendingPhotoKey) {
        const photoRecord = await offlineDb.photoBlobs.get(op.pendingPhotoKey);
        if (photoRecord) {
          const file = new File([photoRecord.blob], 'foto.jpg', { type: 'image/jpeg' });
          photoUrl = await uploadChecklistPhoto(
            photoRecord.clientId,
            photoRecord.checklistId,
            photoRecord.itemId,
            file,
          );
          await offlineDb.photoBlobs.delete(op.pendingPhotoKey);
        }
      }

      const { error } = await supabase.from('checklist_responses').upsert(
        {
          checklist_id: checklistId,
          item_id: op.itemId,
          status: op.status,
          observation: op.observation.trim() || null,
          photo_url: photoUrl || null,
          responded_at: op.respondedAt,
        },
        { onConflict: 'checklist_id,item_id' },
      );
      if (error) throw error;
      break;
    }

    case 'confirm_km': {
      const { error } = await supabase
        .from('checklists')
        .update({ odometer_km: op.odometerKm })
        .eq('id', checklistId);
      if (error) throw error;
      break;
    }

    case 'confirm_workshop': {
      const { error } = await supabase
        .from('checklists')
        .update({ workshop_id: op.workshopId })
        .eq('id', checklistId);
      if (error) throw error;
      break;
    }

    case 'finish_checklist': {
      const { error: chkErr } = await supabase
        .from('checklists')
        .update({ status: 'completed', completed_at: op.completedAt })
        .eq('id', checklistId);
      if (chkErr) throw chkErr;

      // Auto-concluir agendamento de oficina
      if (op.templateContext === 'Entrada em Oficina' && op.workshopId && op.vehicleId) {
        await autoCompleteWorkshopSchedule(
          op.vehicleId,
          op.workshopId,
          op.completedAt,
          checklistId,
        );
      }
      break;
    }

    // ── Tire inspection operations ──────────────────────────────────────────

    case 'save_tire_response': {
      if (!inspectionId) throw new Error('inspectionId missing for save_tire_response');

      let photoUrl = op.photoUrl;

      if (op.pendingPhotoKey) {
        const photoRecord = await offlineDb.photoBlobs.get(op.pendingPhotoKey);
        if (photoRecord) {
          const safeCode = op.positionCode.replace(/\s+/g, '_');
          const path = `${photoRecord.clientId}/tire-inspections/${inspectionId}/${safeCode}/${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from('checklist-photos')
            .upload(path, photoRecord.blob, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;
          photoUrl = supabase.storage.from('checklist-photos').getPublicUrl(path).data.publicUrl;
          await offlineDb.photoBlobs.delete(op.pendingPhotoKey);
        }
      }

      const { error: respErr } = await supabase.from('tire_inspection_responses').upsert(
        {
          inspection_id: inspectionId,
          position_code: op.positionCode,
          position_label: op.positionCode,
          tire_id: op.tireId ?? null,
          dot: op.dot ?? null,
          fire_marking: op.fireMarking ?? null,
          manufacturer: op.manufacturer,
          brand: op.brand,
          photo_url: photoUrl,
          photo_timestamp: op.photoTimestamp,
          status: op.status,
          observation: op.observation ?? null,
          responded_at: op.respondedAt,
        },
        { onConflict: 'inspection_id,position_code' },
      );
      if (respErr) throw respErr;
      break;
    }

    case 'confirm_tire_km': {
      if (!inspectionId) throw new Error('inspectionId missing for confirm_tire_km');
      const { error: kmErr } = await supabase
        .from('tire_inspections')
        .update({ odometer_km: op.odometerKm })
        .eq('id', inspectionId);
      if (kmErr) throw kmErr;
      break;
    }

    case 'finish_tire_inspection': {
      if (!inspectionId) throw new Error('inspectionId missing for finish_tire_inspection');
      const { error: finErr } = await supabase
        .from('tire_inspections')
        .update({ status: 'completed', completed_at: op.completedAt })
        .eq('id', inspectionId);
      if (finErr) throw finErr;
      break;
    }
  }
}

