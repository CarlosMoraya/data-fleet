export function filterByActive<T extends { active?: boolean }>(items: T[], showInactive: boolean): T[] {
  if (showInactive) return items;
  return items.filter((item) => item.active !== false);
}
