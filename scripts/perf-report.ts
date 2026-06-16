import fs from 'fs';
import path from 'path';
import {
  summarizeBundle,
  diffAgainstBaseline,
  formatPerfMarkdown,
  type PerfRun,
  type Thresholds,
} from '../src/lib/perfReport';

const PERF_DIR = path.resolve('docs/reports/perf');
const BUNDLE_JSON = path.join(PERF_DIR, '.last-bundle.json');
const ROUTES_JSON = path.join(PERF_DIR, '.last-routes.json');
const BASELINE_JSON = path.join(PERF_DIR, 'perf-baseline.json');
const THRESHOLDS_JSON = path.join(PERF_DIR, 'perf-thresholds.json');
const LATEST_MD = path.join(PERF_DIR, 'perf-latest.md');
const LATEST_JSON = path.join(PERF_DIR, 'perf-latest.json');
const HISTORY_DIR = path.join(PERF_DIR, 'history');

function loadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function main() {
  const bundleData = loadJson<{ generatedAt: string; files: { name: string; raw: number; gzip: number }[] }>(BUNDLE_JSON);
  if (!bundleData) {
    console.error(`Arquivo não encontrado: ${BUNDLE_JSON}`);
    process.exit(1);
  }

  const routesData = loadJson<{
    generatedAt: string;
    coldStart: PerfRun['coldStart'];
    routes: PerfRun['routes'];
    returnBehavior: PerfRun['returnBehavior'];
  }>(ROUTES_JSON);
  if (!routesData) {
    console.error(`Arquivo não encontrado: ${ROUTES_JSON}`);
    process.exit(1);
  }

  const buildMs = process.env.PERF_BUILD_MS ? Number(process.env.PERF_BUILD_MS) : 0;

  const perfRun: PerfRun = {
    generatedAt: new Date().toISOString(),
    buildMs,
    bundle: summarizeBundle(bundleData.files),
    coldStart: routesData.coldStart,
    routes: routesData.routes,
    returnBehavior: routesData.returnBehavior,
  };

  const baseline = loadJson<PerfRun>(BASELINE_JSON);
  const thresholds = loadJson<Thresholds>(THRESHOLDS_JSON)!;

  const diff = diffAgainstBaseline(perfRun, baseline, thresholds);
  const md = formatPerfMarkdown(perfRun, diff, thresholds);

  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const historyFile = path.join(HISTORY_DIR, `perf-${stamp}.md`);

  fs.writeFileSync(LATEST_MD, md);
  fs.writeFileSync(historyFile, md);
  fs.writeFileSync(LATEST_JSON, JSON.stringify(perfRun, null, 2));

  const updateBaseline = process.argv.includes('--update-baseline');

  if (updateBaseline) {
    fs.writeFileSync(BASELINE_JSON, JSON.stringify(perfRun, null, 2));
    console.log('Baseline atualizado com a medição atual.');
  }

  const regressions = diff.filter((r) => r.status === 'regression');
  if (regressions.length > 0 && !updateBaseline) {
    console.error('Regressões detectadas:');
    for (const r of regressions) {
      console.error(`  ${r.metric}: ${r.current} (baseline: ${r.baseline}, delta: ${r.deltaPct?.toFixed(1)}%)`);
    }
    process.exit(1);
  }

  console.log(`Relatório gerado: ${LATEST_MD}`);
  console.log(`Histórico: ${historyFile}`);
}

main();
