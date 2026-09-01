export function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
