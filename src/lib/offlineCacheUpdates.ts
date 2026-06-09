export function applyOfflineKm<T extends { odometerKm?: number | null }>(checklist: T | undefined, km: number): T | undefined {
  return checklist ? { ...checklist, odometerKm: km } : checklist;
}

export function applyOfflineWorkshop<T extends { workshopId?: string | null }>(checklist: T | undefined, workshopId: string): T | undefined {
  return checklist ? { ...checklist, workshopId } : checklist;
}

export function upsertResponse<R extends { item_id: string }>(list: R[] | undefined, response: R): R[] {
  const base = list ?? [];
  const rest = base.filter(r => r.item_id !== response.item_id);
  return [...rest, response];
}
