export function requiresClientSelection(
  role: string | undefined,
  currentClientId: string | null | undefined,
): boolean {
  return role === 'Admin Master' && !currentClientId;
}

export function showsAggregatedData(
  role: string | undefined,
  currentClientId: string | null | undefined,
): boolean {
  return !!currentClientId || role === 'Admin Master';
}