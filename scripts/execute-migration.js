#!/usr/bin/env node

/**
 * Execute Supabase SQL migration directly via API
 * Usage: node scripts/execute-migration.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  console.error('   Please add SUPABASE_SERVICE_ROLE_KEY to .env.local');
  process.exit(1);
}

async function executeMigration() {
  const migrationPath = path.join(
    __dirname,
    '../supabase/migrations/create_shippers_and_operational_units.sql'
  );

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split by semicolons and filter empty statements
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`📋 Found ${statements.length} SQL statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql_exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'X-Client-Info': 'supabase-migration/1.0',
        },
        body: JSON.stringify({ query: statement + ';' }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.warn(`⚠️  Statement ${i + 1} might have failed or already exists:`);
        console.warn(`   Status: ${response.status}`);
        console.warn(`   Response: ${error.substring(0, 200)}`);
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not execute statement ${i + 1}:`, error.message);
    }
  }

  console.log('\n✅ Migration execution completed!');
  console.log('   If any statements failed, please execute the SQL manually in Supabase Dashboard.');
}

executeMigration().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
