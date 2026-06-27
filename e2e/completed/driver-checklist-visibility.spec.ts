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
  createdTemplate: boolean;
  clientId: string;
  createdClient: boolean;
};

const DRIVER_CATEGORY = 'Médio';

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function resolveSeedClientId(
  supabase: SupabaseClient,
): Promise<{ clientId: string; createdClient: boolean }> {
  const delunaClient = await supabase
    .from('clients')
    .select('id')
    .ilike('name', '%Deluna%')
    .limit(1)
    .maybeSingle();
  if (delunaClient.error) throw delunaClient.error;
  if (delunaClient.data?.id) {
    return { clientId: delunaClient.data.id, createdClient: false };
  }

  const fallbackClient = await supabase.from('clients').select('id').limit(1).maybeSingle();
  if (fallbackClient.error) throw fallbackClient.error;
  if (fallbackClient.data?.id) {
    return { clientId: fallbackClient.data.id, createdClient: false };
  }

  const createdClient = await supabase
    .from('clients')
    .insert({
      id: randomUUID(),
      name: `Driver Checklist Visibility ${Date.now()}`,
    })
    .select('id')
    .single();
  if (createdClient.error || !createdClient.data?.id) {
    throw createdClient.error ?? new Error('client sem id');
  }

  return { clientId: createdClient.data.id, createdClient: true };
}

async function seedDriverChecklistVisibility(supabase: SupabaseClient): Promise<SeedData> {
  const stamp = Date.now();
  const { clientId, createdClient } = await resolveSeedClientId(supabase);
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
    { id: linkedUserId, name: `Driver Linked ${stamp}`, role: 'Driver', client_id: clientId },
    { id: unlinkedUserId, name: `Driver Unlinked ${stamp}`, role: 'Driver', client_id: clientId },
  ]);
  if (profileInsert.error) throw profileInsert.error;

  const linkedDriver = await supabase
    .from('drivers')
    .insert({
      client_id: clientId,
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
      client_id: clientId,
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
      client_id: clientId,
      license_plate: `T${stamp.toString().slice(-6)}`,
      renavam: stamp.toString().slice(-11).padStart(11, '0'),
      chassi: `9BWZZZ377VT${stamp.toString().slice(-5).padStart(5, '0')}`,
      detran_uf: 'SP',
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

  const existingTemplate = await supabase
    .from('checklist_templates')
    .select('id')
    .eq('client_id', clientId)
    .eq('vehicle_category', DRIVER_CATEGORY)
    .eq('context', 'Rotina')
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();
  if (existingTemplate.error) throw existingTemplate.error;

  let templateId = existingTemplate.data?.id ?? null;
  let createdTemplate = false;
  if (!templateId) {
    const template = await supabase
      .from('checklist_templates')
      .insert({
        id: randomUUID(),
        client_id: clientId,
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
    templateId = template.data.id;
    createdTemplate = true;
  }

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
    templateId,
    createdTemplate,
    clientId,
    createdClient,
  };
}

async function cleanupSeed(supabase: SupabaseClient, data: SeedData | null): Promise<void> {
  if (!data) return;
  if (data.createdTemplate) {
    await supabase.from('checklist_templates').delete().eq('id', data.templateId);
  }
  await supabase.from('vehicles').delete().eq('id', data.vehicleId);
  await supabase.from('drivers').delete().in('id', [data.linkedDriverId, data.unlinkedDriverId]);
  await supabase.from('profiles').delete().in('id', [data.linkedUserId, data.unlinkedUserId]);
  await supabase.auth.admin.deleteUser(data.linkedUserId);
  await supabase.auth.admin.deleteUser(data.unlinkedUserId);
  if (data.createdClient) {
    await supabase.from('clients').delete().eq('id', data.clientId);
  }
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
    await expect(page.getByRole('button', { name: 'Iniciar' }).first()).toBeVisible();
  });

  test('does not show vehicle for driver with missing profile_id link', async ({ page }) => {
    if (!seed) throw new Error('seed ausente');
    await login(page, seed.unlinkedEmail, seed.unlinkedPassword);
    await expect(page.getByText('Meu veículo')).toBeVisible();
    await expect(page.getByText('Nenhum veículo associado ao seu perfil.')).toBeVisible();
  });
});
