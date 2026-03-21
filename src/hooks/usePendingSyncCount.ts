import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import { offlineDb } from '../lib/offline/offlineDb';

export function usePendingSyncCount(checklistId: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!checklistId) return;

    const subscription = liveQuery(() =>
      offlineDb.syncQueue
        .where('checklistId')
        .equals(checklistId)
        .and(e => e.status === 'pending' || e.status === 'syncing')
        .count(),
    ).subscribe({
      next: setCount,
      error: console.error,
    });

    return () => subscription.unsubscribe();
  }, [checklistId]);

  return count;
}
