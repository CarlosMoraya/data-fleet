const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseHistoryRange(body: unknown): { from: string; to: string } | null {
  if (!body || typeof body !== "object") return null;

  const { from, to } = body as Record<string, unknown>;
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    !ISO_DATE_PATTERN.test(from) ||
    !ISO_DATE_PATTERN.test(to) ||
    from > to
  ) return null;

  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  if ((toTime - fromTime) / DAY_IN_MS + 1 > 92) return null;

  return { from, to };
}
