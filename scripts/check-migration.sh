#!/bin/bash

# Check if shippers and operational_units tables exist in Supabase

echo "🔍 Checking if migration has been executed..."
echo ""

# We'll try to query the tables via REST API
SUPABASE_URL="${VITE_SUPABASE_URL}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  # Try loading from .env.local
  if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
    SUPABASE_URL="${VITE_SUPABASE_URL}"
    ANON_KEY="${VITE_SUPABASE_ANON_KEY}"
  fi
fi

echo "Supabase URL: $SUPABASE_URL"
echo ""

# Try to query shippers table
RESPONSE=$(curl -s -X GET \
  "$SUPABASE_URL/rest/v1/shippers?limit=0" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -w "%{http_code}" \
  -o /tmp/response.txt)

HTTP_CODE=$RESPONSE

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Migration appears to be executed!"
  echo "   - shippers table exists"
  echo "   - operational_units table exists"
  echo ""
  echo "Ready to run tests:"
  echo "  npm run test:e2e -- e2e/shippers-operational-units.spec.ts"
else
  echo "❌ Tables not found (HTTP $HTTP_CODE)"
  echo ""
  echo "Please execute the migration manually:"
  echo ""
  echo "1. Open Supabase Dashboard"
  echo "2. Go to SQL Editor"
  echo "3. Copy and paste contents of: supabase/migrations/create_shippers_and_operational_units.sql"
  echo "4. Click Run"
  echo ""
fi
