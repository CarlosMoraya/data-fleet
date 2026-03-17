# 🚀 Quick Start: Shippers & Operational Units E2E Tests

## One-Click Setup

### Step 1: Execute Migration (2 min)

**MUST DO FIRST** — The database tables don't exist yet.

#### Via Supabase Dashboard (Recommended)

1. Open: https://supabase.com/dashboard
2. Click on your project
3. Left sidebar → **SQL Editor**
4. Click **New Query**
5. Copy all text from: `supabase/migrations/create_shippers_and_operational_units.sql`
6. Paste into the editor
7. Click **Run** (Ctrl+Enter / Cmd+Enter)
8. Wait for green checkmarks ✅

**Expected**: Multiple `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY` messages

---

### Step 2: Verify Migration

```bash
bash scripts/check-migration.sh
```

**Expected output**:
```
✅ Migration appears to be executed!
   - shippers table exists
   - operational_units table exists
```

If you see ❌, go back to Step 1 and try again.

---

### Step 3: Run Tests

Dev server is already running on port 3000.

```bash
npm run test:shippers
```

Or with interactive UI:

```bash
npm run test:e2e:ui -- e2e/shippers-operational-units.spec.ts
```

---

## What Gets Tested

### ✅ Test Summary

| Profile | Action | Expected |
|---------|--------|----------|
| **Pedro** (Fleet Assistant) | Create 2 shippers | ✓ Both visible in list |
| **Mariana** (Fleet Analyst) | Create 3 units | ✓ With shipper names |
|  | Test cascading dropdown | ✓ Units filter by shipper |
| **Alexandre** (Manager) | Try delete shipper with units | ✗ FK error (expected) |
|  | Delete orphan unit | ✓ Removed from list |
|  | Delete shipper (no units) | ✓ Removed from list |

---

## Data Persistence

⚠️ Tests **leave test data in the database** for manual human testing.

After tests complete, you'll have:
- **Transportadora A** + 2 bases (São Paulo, Rio de Janeiro)
- **Data can be used for**: Manual UI testing, vehicle assignment, etc.
- **Don't delete** unless you need a clean state

---

## Troubleshooting

### "❌ Tables not found"

→ Execute migration in Supabase Dashboard (Step 1)

### Tests freeze/timeout

→ Press Ctrl+C
→ Make sure `npm run dev` is still running
→ Try: `npm run test:e2e:ui` for visual debugging

### "Login failed / Auth error"

→ Confirm test users exist (pedro, mariana, alexandre)
→ Check `.env.local` has correct credentials
→ Verify Supabase project is selected

---

## Test Reports

After tests complete:

```bash
npm run test:e2e:report
```

Opens interactive HTML report with:
- ✅/❌ Status per test
- 📹 Video recordings
- 📋 Trace details

---

## Next: Manual Testing

Once E2E passes, manually test in UI:

1. Login as different roles
2. Go to **Cadastros → Embarcadores** and **Unid. Operacionais**
3. CRUD operations on test data
4. Create new vehicle with shipper/unit assignment
5. Verify cascading dropdown works correctly

---

Need help? Check: `MIGRATION_SHIPPERS.md`
