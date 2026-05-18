import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

type SeedData = {
  linkedUserId: string;
  linkedEmail: string;
  linkedPassword: string;
  unlinkedUserId: string;
  unlinkedEmail: string;
  unlinkedPassword: string;
  linkedDriverId: string;
  unlinkedDriverId: string;
  vehicleId: string;
  templateId: string;
};

const DELUNA_CLIENT_ID = 'da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4';
const DRIVER_CATEGORY = 'Médio';

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function seedDriverChecklistVisibility(supabase: SupabaseClient): Promise<SeedData> {
  const stamp = Date.now();
  const linkedEmail = `driver-linked-${stamp}@test.datafleet.local`;
  const unlinkedEmail = `driver-unlinked-${stamp}@test.datafleet.local`;
  const linkedPassword = `BetaTest${stamp}A!`;
  const unlinkedPassword = `BetaTest${stamp}B!`;

  const linkedAuth = await supabase.auth.admin.createUser({
    email: linkedEmail,
    password: linkedPassword,
    email_confirm: true,
  });
  if (linkedAuth.error || !linkedAuth.data.user?.id) throw linkedAuth.error ?? new Error('linked auth user sem id');
  const linkedUserId = linkedAuth.data.user.id;

  const unlinkedAuth = await supabase.auth.admin.createUser({
    email: unlinkedEmail,
    password: unlinkedPassword,
    email_confirm: true,
  });
  if (unlinkedAuth.error || !unlinkedAuth.data.user?.id) throw unlinkedAuth.error ?? new Error('unlinked auth user sem id');
  const unlinkedUserId = unlinkedAuth.data.user.id;

  const profileInsert = await supabase.from('profiles').upsert([
    { id: linkedUserId, name: `Driver Linked ${stamp}`, role: 'Driver', client_id: DELUNA_CLIENT_ID },
    { id: unlinkedUserId, name: `Driver Unlinked ${stamp}`, role: 'Driver', client_id: DELUNA_CLIENT_ID },
  ]);
  if (profileInsert.error) throw profileInsert.error;

  const linkedDriver = await supabase
    .from('drivers')
    .insert({
      client_id: DELUNA_CLIENT_ID,
      name: `Driver Linked ${stamp}`,
      cpf: `7${stamp.toString().slice(-10)}`,
      profile_id: linkedUserId,
    })
    .select('id')
    .single();
  if (linkedDriver.error || !linkedDriver.data?.id) throw linkedDriver.error ?? new Error('linked driver sem id');

  const unlinkedDriver = await supabase
    .from('drivers')
    .insert({
      client_id: DELUNA_CLIENT_ID,
      name: `Driver Unlinked ${stamp}`,
      cpf: `8${stamp.toString().slice(-10)}`,
      profile_id: null,
    })
    .select('id')
    .single();
  if (unlinkedDriver.error || !unlinkedDriver.data?.id) throw unlinkedDriver.error ?? new Error('unlinked driver sem id');

  const vehicle = await supabase
    .from('vehicles')
    .insert({
      client_id: DELUNA_CLIENT_ID,
      license_plate: `T${stamp.toString().slice(-6)}`,
      category: DRIVER_CATEGORY,
      type: 'Truck',
      brand: 'Test',
      model: 'Visibility',
      year: 2024,
      color: 'White',
      energy_source: 'Combustão',
      acquisition: 'Owned',
      owner: 'Deluna Transportes',
      driver_id: linkedDriver.data.id,
    })
    .select('id')
    .single();
  if (vehicle.error || !vehicle.data?.id) throw vehicle.error ?? new Error('vehicle sem id');

  const template = await supabase
    .from('checklist_templates')
    .insert({
      id: randomUUID(),
      client_id: DELUNA_CLIENT_ID,
      name: `Template Visibilidade ${stamp}`,
      vehicle_category: DRIVER_CATEGORY,
      context: 'Rotina',
      status: 'published',
      current_version: 1,
      created_by: linkedUserId,
    })
    .select('id')
    .single();
  if (template.error || !template.data?.id) throw template.error ?? new Error('template sem id');

  return {
    linkedUserId,
    linkedEmail,
    linkedPassword,
    unlinkedUserId,
    unlinkedEmail,
    unlinkedPassword,
    linkedDriverId: linkedDriver.data.id,
    unlinkedDriverId: unlinkedDriver.data.id,
    vehicleId: vehicle.data.id,
    templateId: template.data.id,
  };
}

async function cleanupSeed(supabase: SupabaseClient, data: SeedData | null): Promise<void> {
  if (!data) return;
  await supabase.from('checklist_templates').delete().eq('id', data.templateId);
  await supabase.from('vehicles').delete().eq('id', data.vehicleId);
  await supabase.from('drivers').delete().in('id', [data.linkedDriverId, data.unlinkedDriverId]);
  await supabase.from('profiles').delete().in('id', [data.linkedUserId, data.unlinkedUserId]);
  await supabase.auth.admin.deleteUser(data.linkedUserId);
  await supabase.auth.admin.deleteUser(data.unlinkedUserId);
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/checklists/, { timeout: 15000 });
}

test.describe.serial('Driver checklist visibility', () => {
  let supabase: SupabaseClient;
  let seed: SeedData | null = null;

  test.beforeAll(async () => {
    supabase = getAdminClient();
    seed = await seedDriverChecklistVisibility(supabase);
  });

  test.afterAll(async () => {
    await cleanupSeed(supabase, seed);
  });

  test('shows vehicle card and published template for linked driver', async ({ page }) => {
    if (!seed) throw new Error('seed ausente');
    await login(page, seed.linkedEmail, seed.linkedPassword);
    await expect(page.getByText('Meu veículo')).toBeVisible();
    await expect(page.getByText(/Template Visibilidade/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar' }).first()).toBeVisible();
  });

  test('does not show vehicle for driver with missing profile_id link', async ({ page }) => {
    if (!seed) throw new Error('seed ausente');
    await login(page, seed.unlinkedEmail, seed.unlinkedPassword);
    await expect(page.getByText('Meu veículo')).toBeVisible();
    await expect(page.getByText('Nenhum veículo associado ao seu perfil.')).toBeVisible();
  });
});
