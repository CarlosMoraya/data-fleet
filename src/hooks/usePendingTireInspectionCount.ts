import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { offlineDb } from '../lib/offline/offlineDb';

export function usePendingTireInspectionCount(inspectionId: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inspectionId) return;

    const subscription = liveQuery(() =>
      offlineDb.syncQueue
        .where('inspectionId')
        .equals(inspectionId)
        .and(e => e.status === 'pending' || e.status === 'syncing')
        .count(),
    ).subscribe({
      next: setCount,
      error: console.error,
    });

    return () => subscription.unsubscribe();
  }, [inspectionId]);

  return count;
}
