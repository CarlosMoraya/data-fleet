#!/bin/bash

# Execute Supabase migration
# This script provides instructions for executing the SQL migration

echo "=========================================="
echo "📋 Supabase Migration Setup"
echo "=========================================="
echo ""
echo "To execute the Embarcadores + Unidades Operacionais migration:"
echo ""
echo "1. Open Supabase Dashboard:"
echo "   https://supabase.com/dashboard"
echo ""
echo "2. Navigate to your project (data-fleet)"
echo ""
echo "3. Go to: SQL Editor (left sidebar)"
echo ""
echo "4. Create a new query"
echo ""
echo "5. Copy and paste the contents of:"
echo "   supabase/migrations/create_shippers_and_operational_units.sql"
echo ""
echo "6. Click 'Run' to execute"
echo ""
echo "7. Once complete, you can run the E2E tests:"
echo "   npm run test:e2e -- e2e/shippers-operational-units.spec.ts"
echo ""
echo "=========================================="
echo ""

# Copy SQL to clipboard if on macOS
if command -v pbcopy &> /dev/null; then
  if [ -f "supabase/migrations/create_shippers_and_operational_units.sql" ]; then
    cat supabase/migrations/create_shippers_and_operational_units.sql | pbcopy
    echo "✅ Migration SQL copied to clipboard (macOS)"
    echo ""
  fi
fi

echo "To start the E2E tests, run:"
echo "  npm run test:e2e -- e2e/shippers-operational-units.spec.ts"
echo ""
