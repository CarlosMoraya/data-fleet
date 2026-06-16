import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { summarizeBundle, type AssetFile } from '../src/lib/perfReport';

const DIST_ASSETS = path.resolve('dist/assets');
const OUTPUT = path.resolve('docs/reports/perf/.last-bundle.json');

function readAssetFiles(dir: string): AssetFile[] {
  const entries = fs.readdirSync(dir);
  const files: AssetFile[] = [];

  for (const entry of entries) {
    const ext = path.extname(entry);
    if (!['.js', '.mjs', '.css'].includes(ext)) continue;

    const fullPath = path.join(dir, entry);
    const raw = fs.readFileSync(fullPath);
    const gziped = zlib.gzipSync(raw);

    files.push({ name: entry, raw: raw.length, gzip: gziped.length });
  }

  return files;
}

function main() {
  if (!fs.existsSync(DIST_ASSETS)) {
    console.error("Bundle não encontrado. Rode 'npm run build' antes.");
    process.exit(1);
  }

  const files = readAssetFiles(DIST_ASSETS);
  const summary = summarizeBundle(files);

  console.log(`Total JS (gzip): ${(summary.totalJsGzip / 1024).toFixed(1)} KB`);
  console.log(`Largest chunk: ${summary.largestChunk.name} (${(summary.largestChunk.raw / 1024).toFixed(1)} KB raw, ${(summary.largestChunk.gzip / 1024).toFixed(1)} KB gzip)`);

  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2),
  );
}

main();
