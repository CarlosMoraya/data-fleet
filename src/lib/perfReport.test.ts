import { describe, expect, it } from 'vitest';
import {
  summarizeBundle,
  diffAgainstBaseline,
  formatPerfMarkdown,
  type AssetFile,
  type PerfRun,
  type Thresholds,
} from './perfReport';

const threshold: Thresholds = {
  shellMs: 2500,
  firstUsefulMs: 3500,
  routeEntryMs: 1500,
  largestChunkRawBytes: 819200,
  regressionTolerance: 0.15,
};

function makePerfRun(overrides?: Partial<PerfRun>): PerfRun {
  return {
    generatedAt: '2026-06-16T12:00:00Z',
    buildMs: 8000,
    bundle: {
      totalJsRaw: 2000000,
      totalJsGzip: 600000,
      totalCssRaw: 50000,
      totalCssGzip: 10000,
      largestChunk: { name: 'index-abc.js', raw: 1960000, gzip: 580000 },
      files: [
        { name: 'index-abc.js', raw: 1960000, gzip: 580000 },
        { name: 'vendor-def.js', raw: 40000, gzip: 15000 },
        { name: 'style-ghi.css', raw: 50000, gzip: 10000 },
      ],
    },
    coldStart: { shellMs: 1200, firstUsefulMs: 2000, requestCount: 8 },
    routes: [
      { key: 'dashboard', label: 'Dashboard', url: '/', entryMs: 500, requestCount: 3 },
      { key: 'veiculos', label: 'Veículos', url: '/cadastros/veiculos', entryMs: 600, requestCount: 4 },
    ],
    returnBehavior: {
      route: 'veiculos',
      firstEntryMs: 600,
      firstRequestCount: 4,
      returnEntryMs: 300,
      returnRequestCount: 1,
    },
    ...overrides,
  };
}

describe('summarizeBundle', () => {
  it('computes totals and largestChunk for 2 JS + 1 CSS', () => {
    const files: AssetFile[] = [
      { name: 'index-abc.js', raw: 1960000, gzip: 580000 },
      { name: 'vendor-def.js', raw: 40000, gzip: 15000 },
      { name: 'style-ghi.css', raw: 50000, gzip: 10000 },
    ];

    const summary = summarizeBundle(files);

    expect(summary.totalJsRaw).toBe(2000000);
    expect(summary.totalJsGzip).toBe(595000);
    expect(summary.totalCssRaw).toBe(50000);
    expect(summary.totalCssGzip).toBe(10000);
    expect(summary.largestChunk.name).toBe('index-abc.js');
    expect(summary.largestChunk.raw).toBe(1960000);
    expect(summary.files).toBe(files);
  });

  it('picks .mjs worker as largestChunk', () => {
    const files: AssetFile[] = [
      { name: 'index-abc.js', raw: 100, gzip: 50 },
      { name: 'worker-xyz.mjs', raw: 500, gzip: 200 },
    ];

    const summary = summarizeBundle(files);

    expect(summary.largestChunk.name).toBe('worker-xyz.mjs');
    expect(summary.largestChunk.raw).toBe(500);
    expect(summary.totalJsRaw).toBe(600);
  });
});

describe('diffAgainstBaseline', () => {
  it('returns ok with 0 delta when current equals baseline', () => {
    const current = makePerfRun();
    const baseline = makePerfRun();

    const diff = diffAgainstBaseline(current, baseline, threshold);

    for (const row of diff) {
      expect(row.status).toBe('ok');
      expect(row.deltaPct).toBe(0);
    }
  });

  it('flags regression when metric exceeds tolerance', () => {
    const base = makePerfRun();
    const current = makePerfRun({
      coldStart: { shellMs: 1560, firstUsefulMs: 2600, requestCount: 10 },
    });

    const diff = diffAgainstBaseline(current, base, threshold);

    const shellRow = diff.find((r) => r.metric === 'coldStart.shellMs')!;
    expect(shellRow.status).toBe('regression');
    expect(shellRow.current).toBe(1560);
    expect(shellRow.deltaPct).toBeGreaterThan(0);
  });

  it('returns no-baseline for all rows when baseline is null', () => {
    const current = makePerfRun();

    const diff = diffAgainstBaseline(current, null, threshold);

    for (const row of diff) {
      expect(row.status).toBe('no-baseline');
      expect(row.baseline).toBeNull();
      expect(row.deltaPct).toBeNull();
    }
  });
});

describe('formatPerfMarkdown', () => {
  it('produces markdown with all sections', () => {
    const current = makePerfRun();
    const diff = diffAgainstBaseline(current, null, threshold);

    const md = formatPerfMarkdown(current, diff, threshold);

    expect(md).toContain('# Performance Report');
    expect(md).toContain('## Bundle');
    expect(md).toContain('## Cold Start');
    expect(md).toContain('## Routes');
    expect(md).toContain('## Return Behavior');
    expect(md).toContain('## Diff vs Baseline');
    expect(md).toContain('## Metas absolutas');
    expect(md).toContain('no-baseline');
  });
});
