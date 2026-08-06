/**
 * Matches a registry record by free-text name or by document digits.
 *
 * The digit guard is essential: `''.includes('')` is always true in JS, so a
 * search term without digits would otherwise match every record and silently
 * disable the whole filter.
 */
export function matchesNameOrDocument(
  name: string | null | undefined,
  document: string | null | undefined,
  search: string
): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  const digits = search.replace(/\D/g, '');
  const nameMatch = (name ?? '').toLowerCase().includes(q);
  const documentMatch = digits.length > 0 && (document ?? '').includes(digits);
  return nameMatch || documentMatch;
}
