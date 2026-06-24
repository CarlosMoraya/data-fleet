/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// ── RPC contract: every supabase.rpc('<name>') called in src/** must have a
// matching `CREATE [OR REPLACE] FUNCTION <name>` in supabase/migrations/**.
//
// This guards against "ghost" RPCs written in the frontend but never created
// in the database (the exact class of bug that caused the 404 on
// `get_vehicle_odometer_readings_batch` in Revisões de Garantia).
//
// Exceptions (RPCs that exist in the DB at runtime but were applied manually
// outside of versioned migrations) must be declared here explicitly so the
// contract remains a regressão net for the whole fleet of RPCs while not
// exposing out-of-scope gaps as failures of this test.

const EXCEPTIONS = new Set<string>([
  // Applied out-of-band; tracked as a known migration gap in docs/MEMORY.md.
  'get_vehicle_last_odometer_reading_at',
]);

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SRC_DIR = join(ROOT, 'src');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

// Captures the RPC name literal in any `supabase.rpc('<name>', ...)` call.
const RPC_CALL_RE = /\.rpc\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;

function listFilesRecursively(
  dir: string,
  ext: RegExp,
  out: string[] = [],
): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listFilesRecursively(full, ext, out);
    } else if (ext.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function collectRpcCalls(srcDir: string): Map<string, string[]> {
  const called = new Map<string, string[]>();
  for (const file of listFilesRecursively(srcDir, /\.(t|mj|cj)sx?$/i)) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(RPC_CALL_RE)) {
      const name = match[1];
      const files = called.get(name) ?? [];
      files.push(file);
      called.set(name, files);
    }
  }
  return called;
}

function findMigrationDefinition(name: string, migrations: string[]): string | null {
  // Matches `CREATE [OR REPLACE] FUNCTION [schema.]<name>(` with optional
  // whitespace/newlines between `FUNCTION` and the name.
  const re = new RegExp(
    `CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+([a-zA-Z0-9_]+\\.)?${name}\\s*\\(`,
    'i',
  );
  for (const file of migrations) {
    const sql = readFileSync(file, 'utf8');
    if (re.test(sql)) return file;
  }
  return null;
}

describe('RPC contract — supabase.rpc calls vs migrations', () => {
  const called = collectRpcCalls(SRC_DIR);
  const migrations = listFilesRecursively(MIGRATIONS_DIR, /\.sql$/i);

  it('there are RPC calls to verify (sanity)', () => {
    expect(called.size).toBeGreaterThan(0);
  });

  it('every supabase.rpc(\'<name>\') has a CREATE FUNCTION in migrations (or is an explicit exception)', () => {
    const missing: Array<{ name: string; callers: string[] }> = [];
    for (const [name, callers] of called) {
      if (EXCEPTIONS.has(name)) continue;
      if (findMigrationDefinition(name, migrations) == null) {
        missing.push({ name, callers });
      }
    }

    expect(missing, JSON.stringify(missing, null, 2)).toEqual([]);
  });

  it('all exception RPCs are actually called from src (no stale allowlist)', () => {
    const stale = [...EXCEPTIONS].filter((name) => !called.has(name));
    expect(stale, `stale exceptions: ${stale.join(', ')}`).toEqual([]);
  });
});