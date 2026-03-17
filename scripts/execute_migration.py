#!/usr/bin/env python3

"""
Execute Supabase SQL migration using Python
Requires: pip install supabase
"""

import os
import sys
from pathlib import Path

def main():
    # Load environment
    env_file = Path('.env.local')
    if not env_file.exists():
        print('❌ .env.local not found')
        sys.exit(1)

    env_vars = {}
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip()

    supabase_url = env_vars.get('VITE_SUPABASE_URL')
    supabase_anon_key = env_vars.get('VITE_SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_anon_key:
        print('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
        sys.exit(1)

    # Read migration file
    migration_file = Path('supabase/migrations/create_shippers_and_operational_units.sql')
    if not migration_file.exists():
        print(f'❌ Migration file not found: {migration_file}')
        sys.exit(1)

    sql = migration_file.read_text()

    print('📋 Executing SQL migration via Supabase...')
    print(f'   URL: {supabase_url}')
    print()

    try:
        from supabase import create_client

        # Initialize client with anon key (read-only)
        client = create_client(supabase_url, supabase_anon_key)

        # Try to execute SQL via rpc if available
        # This will likely fail without proper setup, so we'll catch and inform
        result = client.rpc('sql_exec', {'query': sql}).execute()
        print('✅ Migration executed successfully!')

    except ImportError:
        print('❌ Supabase Python client not installed')
        print('   Install with: pip install supabase')
        print()
        print('⚠️  Alternatively, execute the migration manually:')
        print('   1. Open: https://supabase.com/dashboard')
        print('   2. Go to SQL Editor')
        print('   3. Paste the contents of: supabase/migrations/create_shippers_and_operational_units.sql')
        print('   4. Click Run')
        sys.exit(1)

    except Exception as e:
        print(f'⚠️  Could not execute migration via API: {str(e)}')
        print()
        print('Please execute the migration manually:')
        print('   1. Open: https://supabase.com/dashboard')
        print('   2. Go to SQL Editor')
        print('   3. Paste the contents of: supabase/migrations/create_shippers_and_operational_units.sql')
        print('   4. Click Run')
        sys.exit(1)

if __name__ == '__main__':
    main()
