export function resolveExportSelection<T extends { id: string }>(
  filtered: T[],
  selectedIds: Set<string>,
): T[] {
  if (selectedIds.size === 0) return filtered;
  return filtered.filter((item) => selectedIds.has(item.id));
}
