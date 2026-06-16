export interface AssetFile {
  name: string;
  raw: number;
  gzip: number;
}

export interface BundleSummary {
  totalJsRaw: number;
  totalJsGzip: number;
  totalCssRaw: number;
  totalCssGzip: number;
  largestChunk: AssetFile;
  files: AssetFile[];
}

export interface RouteMetric {
  key: string;
  label: string;
  url: string;
  entryMs: number;
  requestCount: number;
}

export interface ColdStart {
  shellMs: number;
  firstUsefulMs: number;
  requestCount: number;
}

export interface ReturnBehavior {
  route: string;
  firstEntryMs: number;
  firstRequestCount: number;
  returnEntryMs: number;
  returnRequestCount: number;
}

export interface PerfRun {
  generatedAt: string;
  buildMs: number;
  bundle: BundleSummary;
  coldStart: ColdStart;
  routes: RouteMetric[];
  returnBehavior: ReturnBehavior;
}

export interface Thresholds {
  shellMs: number;
  firstUsefulMs: number;
  routeEntryMs: number;
  largestChunkRawBytes: number;
  regressionTolerance: number;
}

export interface DiffRow {
  metric: string;
  current: number;
  baseline: number | null;
  deltaPct: number | null;
  status: 'ok' | 'regression' | 'no-baseline';
  unit: 'ms' | 'bytes' | 'count';
}

export function summarizeBundle(files: AssetFile[]): BundleSummary {
  const jsFiles = files.filter((f) => f.name.endsWith('.js') || f.name.endsWith('.mjs'));
  const cssFiles = files.filter((f) => f.name.endsWith('.css'));

  const totalJsRaw = jsFiles.reduce((s, f) => s + f.raw, 0);
  const totalJsGzip = jsFiles.reduce((s, f) => s + f.gzip, 0);
  const totalCssRaw = cssFiles.reduce((s, f) => s + f.raw, 0);
  const totalCssGzip = cssFiles.reduce((s, f) => s + f.gzip, 0);

  const largestChunk = jsFiles.reduce(
    (max, f) => (f.raw > max.raw ? f : max),
    jsFiles[0],
  );

  return {
    totalJsRaw,
    totalJsGzip,
    totalCssRaw,
    totalCssGzip,
    largestChunk,
    files,
  };
}

export function diffAgainstBaseline(
  current: PerfRun,
  baseline: PerfRun | null,
  thresholds: Thresholds,
): DiffRow[] {
  const tol = thresholds.regressionTolerance;

  const row = (
    metric: string,
    cur: number,
    base: number | null | undefined,
    unit: 'ms' | 'bytes' | 'count',
  ): DiffRow => {
    if (base == null) {
      return { metric, current: cur, baseline: null, deltaPct: null, status: 'no-baseline', unit };
    }
    const deltaPct = (cur - base) / base * 100;
    const status: DiffRow['status'] =
      cur > base * (1 + tol) ? 'regression' : 'ok';
    return { metric, current: cur, baseline: base, deltaPct, status, unit };
  };

  const rows: DiffRow[] = [
    row('totalJsGzip', current.bundle.totalJsGzip, baseline?.bundle.totalJsGzip, 'bytes'),
    row('largestChunk.raw', current.bundle.largestChunk.raw, baseline?.bundle.largestChunk.raw, 'bytes'),
    row('coldStart.shellMs', current.coldStart.shellMs, baseline?.coldStart.shellMs, 'ms'),
    row('coldStart.firstUsefulMs', current.coldStart.firstUsefulMs, baseline?.coldStart.firstUsefulMs, 'ms'),
  ];

  for (const r of current.routes) {
    const baseRoute = baseline?.routes.find((b) => b.key === r.key);
    rows.push(row(`route.${r.key}.entryMs`, r.entryMs, baseRoute?.entryMs, 'ms'));
    rows.push(row(`route.${r.key}.requestCount`, r.requestCount, baseRoute?.requestCount, 'count'));
  }

  rows.push(
    row('returnBehavior.returnEntryMs', current.returnBehavior.returnEntryMs, baseline?.returnBehavior.returnEntryMs, 'ms'),
    row('returnBehavior.returnRequestCount', current.returnBehavior.returnRequestCount, baseline?.returnBehavior.returnRequestCount, 'count'),
  );

  return rows;
}

function fmtBytes(n: number): string {
  return (n / 1024).toFixed(1) + ' KB';
}

function fmtMs(n: number): string {
  return n + ' ms';
}

function fmtPct(n: number | null): string {
  return n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function fmtStatus(s: DiffRow['status']): string {
  return s === 'ok' ? '✅ ok' : s === 'regression' ? '❌ regression' : '⚠️ no-baseline';
}

function fmtValue(row: DiffRow): string {
  return row.unit === 'bytes' ? fmtBytes(row.current) : row.unit === 'ms' ? fmtMs(row.current) : String(row.current);
}

function fmtBaseline(row: DiffRow): string {
  if (row.baseline == null) return '—';
  return row.unit === 'bytes' ? fmtBytes(row.baseline) : row.unit === 'ms' ? fmtMs(row.baseline) : String(row.baseline);
}

export function formatPerfMarkdown(
  current: PerfRun,
  diff: DiffRow[],
  thresholds: Thresholds,
): string {
  const b = current.bundle;
  const cs = current.coldStart;
  const rb = current.returnBehavior;
  const date = current.generatedAt;

  let md = `# Performance Report — ${date}\n\n`;

  md += `## Bundle\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Total JS (raw) | ${fmtBytes(b.totalJsRaw)} |\n`;
  md += `| Total JS (gzip) | ${fmtBytes(b.totalJsGzip)} |\n`;
  md += `| Total CSS (raw) | ${fmtBytes(b.totalCssRaw)} |\n`;
  md += `| Total CSS (gzip) | ${fmtBytes(b.totalCssGzip)} |\n`;
  md += `| Largest chunk | ${b.largestChunk.name} (${fmtBytes(b.largestChunk.raw)}) |\n`;
  md += `| Build time | ${current.buildMs} ms |\n\n`;

  md += `## Cold Start\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Shell visible | ${fmtMs(cs.shellMs)} |\n`;
  md += `| First useful screen | ${fmtMs(cs.firstUsefulMs)} |\n`;
  md += `| Requests | ${cs.requestCount} |\n\n`;

  md += `## Routes\n`;
  md += `| Route | Entry (ms) | Requests |\n|---|---|---|\n`;
  for (const r of current.routes) {
    md += `| ${r.label} | ${r.entryMs} | ${r.requestCount} |\n`;
  }
  md += `\n`;

  md += `## Return Behavior (${rb.route})\n`;
  md += `| Metric | First | Return |\n|---|---|---|\n`;
  md += `| Entry (ms) | ${rb.firstEntryMs} | ${rb.returnEntryMs} |\n`;
  md += `| Requests | ${rb.firstRequestCount} | ${rb.returnRequestCount} |\n\n`;

  md += `## Diff vs Baseline\n`;
  md += `| Metric | Current | Baseline | Delta | Status |\n|---|---|---|---|---|\n`;
  for (const d of diff) {
    md += `| ${d.metric} | ${fmtValue(d)} | ${fmtBaseline(d)} | ${fmtPct(d.deltaPct)} | ${fmtStatus(d.status)} |\n`;
  }
  md += `\n`;

  md += `## Metas absolutas (informativo)\n`;
  md += `| Metric | Threshold | Current |\n|---|---|---|\n`;
  md += `| Shell visible | ${fmtMs(thresholds.shellMs)} | ${fmtMs(cs.shellMs)} |\n`;
  md += `| First useful screen | ${fmtMs(thresholds.firstUsefulMs)} | ${fmtMs(cs.firstUsefulMs)} |\n`;
  md += `| Route entry (any) | ${fmtMs(thresholds.routeEntryMs)} | ${Math.max(...current.routes.map((r) => r.entryMs))} ms |\n`;
  md += `| Largest chunk (raw) | ${fmtBytes(thresholds.largestChunkRawBytes)} | ${fmtBytes(b.largestChunk.raw)} |\n`;

  return md;
}
