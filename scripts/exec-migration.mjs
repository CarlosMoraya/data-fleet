#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationFile = join(process.cwd(), 'supabase/migrations/create_shippers_and_operational_units.sql');

console.log('📋 Attempting to execute Supabase migration...\n');

// Read SQL
const sql = readFileSync(migrationFile, 'utf-8');

// Try to use Supabase CLI if available
console.log('🔍 Checking for Supabase CLI...');

const child = spawn('supabase', ['db', 'execute'], {
  stdio: 'pipe',
  shell: true,
});

child.stdin.write(sql);
child.stdin.end();

let output = '';
let error = '';

child.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  error += data.toString();
  process.stderr.write(data);
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration executed successfully!');
    console.log('\nReady to run E2E tests:');
    console.log('  npm run test:e2e -- e2e/shippers-operational-units.spec.ts\n');
  } else if (code === 127) {
    // Command not found
    console.log('\n⚠️  Supabase CLI not found. Please install it:');
    console.log('  npm install -g supabase\n');
    console.log('Or execute the migration manually:\n');
    console.log('1. Open: https://supabase.com/dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Paste the contents of: supabase/migrations/create_shippers_and_operational_units.sql');
    console.log('4. Click Run\n');
  } else {
    console.log('\n⚠️  Supabase CLI error. Please execute manually:\n');
    console.log('1. Open: https://supabase.com/dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Paste the contents of: supabase/migrations/create_shippers_and_operational_units.sql');
    console.log('4. Click Run\n');
  }
});
