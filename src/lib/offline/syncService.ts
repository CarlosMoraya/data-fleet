import { offlineDb, type SyncOperation, type SyncQueueEntry } from './offlineDb';
import { supabase } from '../supabase';
import { uploadChecklistPhoto } from '../checklistStorageHelpers';

// ─── Concurrency guard ────────────────────────────────────────────────────────

let isFlushRunning = false;

// ─── Enqueue helpers ──────────────────────────────────────────────────────────

export async function enqueueOperation(
  op: SyncOperation,
  checklistId: string,
): Promise<number> {
  return offlineDb.syncQueue.add({
    createdAt: Date.now(),
    checklistId,
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
  const { op, checklistId } = entry;

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

      // Auto-concluir agendamento de oficina (mesma lógica do finishMutation online)
      if (op.templateContext === 'Entrada em Oficina' && op.workshopId && op.vehicleId) {
        const { data: matchingSchedule } = await supabase
          .from('workshop_schedules')
          .select('id')
          .eq('vehicle_id', op.vehicleId)
          .eq('workshop_id', op.workshopId)
          .eq('status', 'scheduled')
          .order('scheduled_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (matchingSchedule) {
          await supabase
            .from('workshop_schedules')
            .update({
              status: 'completed',
              completed_at: op.completedAt,
              checklist_id: checklistId,
            })
            .eq('id', matchingSchedule.id);
        }
      }
      break;
    }
  }
}

// ─── Pending count (for external use without Dexie liveQuery) ─────────────────

export async function getPendingCount(checklistId: string): Promise<number> {
  return offlineDb.syncQueue
    .where('checklistId')
    .equals(checklistId)
    .and(e => e.status === 'pending' || e.status === 'syncing')
    .count();
}
