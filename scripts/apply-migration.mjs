#!/usr/bin/env node
/**
 * Aplica uma migration SQL ao banco Dev via `supabase db query`, usando a
 * connection string definida em .env.local (SUPABASE_DB_URL).
 *
 * Uso:
 *   node scripts/apply-migration.mjs <arquivo.sql> [arquivo.sql...] [--env .env.production]
 *   node scripts/apply-migration.mjs                    # lista migrations disponíveis
 *
 * A connection string precisa incluir a senha do Postgres:
 *   postgresql://postgres.<project-ref>:<SENHA_DB>@<host>:5432/postgres
 */
import { spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { config } from 'dotenv';

// Permite escolher o ambiente via --env <arquivo> (padrão: .env.local)
const args = process.argv.slice(2);
const envIdx = args.indexOf('--env');
const envFile = envIdx !== -1 ? args[envIdx + 1] : '.env.local';
const targets = args.filter((a) => a !== '--env' && a !== envFile && a !== '--');

config({ path: envFile });

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

function listMigrations() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  console.log('Migrations disponíveis em supabase/migrations/:');
  for (const f of files) console.log('  - ' + f);
  console.log('\nUso: node scripts/apply-migration.mjs <arquivo.sql>');
}

if (targets.length === 0) {
  listMigrations();
  process.exit(0);
}

if (envIdx !== -1 && !envFile) {
  console.error('❌ --env requer um argumento (ex.: --env .env.production)');
  process.exit(1);
}

console.log('🌍 Ambiente:', envFile);

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl || !dbUrl.includes(':')) {
  console.error('❌ SUPABASE_DB_URL ausente ou sem senha em ' + envFile);
  console.error('   Preencha SUPABASE_DB_URL=postgresql://postgres.<ref>:<SENHA>@<host>:5432/postgres');
  process.exit(1);
}

for (const target of targets) {
  const file = target.includes('/') ? resolve(target) : join(migrationsDir, target);
  if (!existsSync(file)) {
    console.error('❌ Arquivo não encontrado:', file);
    process.exit(1);
  }
  console.log('📄 Migration:', file);
  console.log('🔗 DB URL encontrada em ' + envFile + ' (senha oculta).');

  // `supabase db query -f` rejeita múltiplos comandos por prepared statement
  // ("cannot insert multiple commands into a prepared statement"). Dividimos a
  // migration em statements individuais (split por ';' de fim de linha) e
  // aplicamos um a um via arquivos temporários.
  const raw = readFileSync(file, 'utf8');
  // Remove blocos de comentários de linha (-- ...) e quebra por ';'
  const statements = raw
    .split(';')
    .map((s) => s
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n')
      .trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) {
    console.log('   (migration sem statements executáveis, pulando)');
    continue;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'bf-migration-'));
  let failed = false;
  for (let i = 0; i < statements.length; i++) {
    const stmtFile = join(tmpDir, `stmt-${String(i + 1).padStart(3, '0')}.sql`);
    writeFileSync(stmtFile, statements[i] + ';\n');
    console.log(`\n[${i + 1}/${statements.length}] Aplicando statement...`);
    const code = await new Promise((resolveChild) => {
      const child = spawn(
        'supabase',
        ['db', 'query', '-f', stmtFile, '--db-url', dbUrl, '--agent=no', '-o', 'table'],
        { stdio: 'inherit', shell: true },
      );
      child.on('close', (c) => resolveChild(c ?? 1));
    });
    if (code !== 0) {
      console.log('❌ Falha no statement ' + (i + 1) + '.');
      failed = true;
      break;
    }
  }

  if (failed) {
    console.log('\n❌ Falha ao aplicar migration: ' + target);
    process.exit(1);
  }
  console.log('\n✅ Migration aplicada: ' + target);
}
console.log('\n✅ Todas as migrations aplicadas em ' + envFile + '.');