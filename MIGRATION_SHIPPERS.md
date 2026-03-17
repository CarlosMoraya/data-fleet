# Embarcadores + Unidades Operacionais — Migration & Testing

## Overview

This migration adds two new database tables and integrates them into the Vehicle form:

- **`shippers`** (Embarcadores): Companies that manage freight transportation
- **`operational_units`** (Unidades Operacionais): Operational bases/depots linked to shippers
- **Vehicle FK columns**: `shipper_id` and `operational_unit_id`

## Prerequisites

- ✅ Backend files already created:
  - `src/lib/shipperMappers.ts`
  - `src/lib/operationalUnitMappers.ts`
  - Updated `src/lib/vehicleMappers.ts`
  - Updated `src/types.ts`

- ✅ Frontend components already created:
  - `src/components/ShipperForm.tsx`
  - `src/components/OperationalUnitForm.tsx`
  - Updated `src/components/VehicleForm.tsx` (Logística section)

- ✅ Pages already created:
  - `src/pages/Shippers.tsx`
  - `src/pages/OperationalUnits.tsx`
  - Updated `src/pages/Cadastros.tsx` (2 new tabs)

- ✅ Routes already added to `src/App.tsx`

- ✅ E2E tests created: `e2e/shippers-operational-units.spec.ts`

---

## Step 1: Execute SQL Migration

### Option A: Supabase CLI (Recommended)

If you have Supabase CLI installed:

```bash
npm run migrate:shippers
```

### Option B: Manual Execution (Dashboard)

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the entire contents of:
   ```
   supabase/migrations/create_shippers_and_operational_units.sql
   ```
6. Click **Run** (or press Ctrl+Enter)

You should see:
```
✅ CREATE TABLE
✅ CREATE INDEX
✅ CREATE POLICY (multiple)
✅ ALTER TABLE
```

---

## Step 2: Verify Migration

Check if tables were created:

```bash
bash scripts/check-migration.sh
```

Expected output:
```
✅ Migration appears to be executed!
   - shippers table exists
   - operational_units table exists
```

---

## Step 3: Run E2E Tests

### Start Dev Server (if not running)

```bash
npm run dev
```

### Run Tests

```bash
npm run test:shippers
```

Or with UI mode:

```bash
npm run test:e2e:ui -- e2e/shippers-operational-units.spec.ts
```

---

## Test Profiles & Scenarios

The E2E suite validates with **3 different user profiles**:

### 1. Fleet Assistant (Pedro)
- **Access**: Can view, create, edit shippers
- **Tests**:
  - Create "Transportadora A"
  - Create "Transportadora B"
  - View in list

### 2. Fleet Analyst (Mariana)
- **Access**: Can view, create, edit, delete operational units
- **Tests**:
  - Create "Base São Paulo" → linked to Transportadora A
  - Create "Base Rio de Janeiro" → linked to Transportadora A
  - Create "Base Brasília" → linked to Transportadora B
  - View in list with shipper names
  - **Cascading Dropdown**:
    - Unit dropdown disabled until shipper selected ✓
    - Selecting Transportadora A → shows only its units ✓
    - Switching shipper → resets unit field ✓

### 3. Manager (Alexandre)
- **Access**: Can delete shippers/units
- **Tests**:
  - Try to delete Transportadora A (should fail with FK error) ✗
    - Error message: "Este embarcador possui unidades operacionais vinculadas..."
  - Delete Base Brasília (succeeds) ✓
  - Delete Transportadora B (now succeeds since no units linked) ✓
  - Verify remaining data persists

---

## Expected Test Results

After successful migration and execution:

```
✅ Fleet Assistant - Create Transportadora A
✅ Fleet Assistant - Create Transportadora B
✅ Fleet Analyst - Create Base São Paulo
✅ Fleet Analyst - Create Base Rio de Janeiro
✅ Fleet Analyst - Create Base Brasília
✅ Fleet Analyst - Verify cascading dropdown behavior
✅ Manager - Validate FK RESTRICT on delete
✅ Manager - Delete orphaned operational unit
✅ Manager - Delete shipper without units
✅ Verify remaining data persists
```

---

## Data Persistence

⚠️ **IMPORTANT**: Tests are configured to **leave data in the database** for manual testing by humans.

After E2E completes, you'll have:
- **Transportadora A** (Shipper) with 2 operational units:
  - Base São Paulo (SP)
  - Base Rio de Janeiro (RJ)

This data can be used for:
- ✅ Manual testing of UI flows
- ✅ Vehicle form with cascading dropdowns
- ✅ Verifying save/load of vehicles with shipper/unit associations
- ✅ Further integration testing

**Do NOT delete this data** unless explicitly needed.

---

## Troubleshooting

### Migration Fails / Tables Don't Exist

**Error**: `❌ Tables not found (HTTP 401)`

**Solutions**:
1. Confirm you're logged into the correct Supabase project
2. Verify `VITE_SUPABASE_URL` in `.env.local`
3. Execute migration manually via Dashboard SQL Editor
4. Check for error messages in Dashboard SQL Editor output

### Tests Can't Connect to Database

**Error**: Tests run but queries fail with RLS/auth errors

**Solutions**:
1. Ensure `npm run dev` is running (dev server on port 3000)
2. Confirm `.env.local` has correct Supabase credentials
3. Check that test users (pedro, mariana, alexandre) are created in Supabase Auth
4. Verify RLS policies were created (check in Dashboard → Authentication → Policies)

### Cascading Dropdown Tests Fail

**Error**: "Unit dropdown is not disabled" or options don't filter

**Solutions**:
1. Verify VehicleForm receives `availableShippers` and `availableOperationalUnits` props
2. Check that `Vehicles.tsx` fetches both datasets
3. Confirm `handleChange` logic resets `operationalUnitId` when shipper changes
4. Verify select `disabled={!formData.shipperId}` is present

---

## Next Steps

Once tests pass and data is confirmed:

1. **Manual testing**: Use the Vehicle form to create/edit vehicles with shipper/unit associations
2. **Data validation**: Verify saved vehicles load with correct shipper/unit names
3. **API testing**: Check that REST API returns correctly formatted responses
4. **Performance**: Validate that cascading dropdown doesn't cause N+1 queries
5. **Integration**: Test with other modules (Drivers, Checklists, etc.)

---

## Files Summary

### Created/Modified
- ✅ `supabase/migrations/create_shippers_and_operational_units.sql` — SQL migration
- ✅ `src/types.ts` — Added Shipper, OperationalUnit interfaces
- ✅ `src/lib/shipperMappers.ts` — New mapper
- ✅ `src/lib/operationalUnitMappers.ts` — New mapper
- ✅ `src/lib/vehicleMappers.ts` — Updated with FK fields
- ✅ `src/components/ShipperForm.tsx` — New form component
- ✅ `src/components/OperationalUnitForm.tsx` — New form component
- ✅ `src/components/VehicleForm.tsx` — Added Logística section
- ✅ `src/pages/Shippers.tsx` — New CRUD page
- ✅ `src/pages/OperationalUnits.tsx` — New CRUD page with fetch
- ✅ `src/pages/Cadastros.tsx` — Added 2 tabs
- ✅ `src/App.tsx` — Added 2 routes
- ✅ `e2e/shippers-operational-units.spec.ts` — New test suite
- ✅ `scripts/check-migration.sh` — Verify migration status
- ✅ `scripts/exec-migration.mjs` — Execute migration
- ✅ `scripts/execute-migration.js` — Fallback migration script
- ✅ `scripts/setup-migrations.sh` — Setup instructions
- ✅ `package.json` — Added npm scripts

---

## Questions?

Refer to the test file for detailed assertions:
`e2e/shippers-operational-units.spec.ts`

Or check the original plan:
`.claude/plans/prancy-leaping-fountain.md`
