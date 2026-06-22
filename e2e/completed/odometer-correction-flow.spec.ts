import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

interface OdometerScenario {
  plate: string;
  checklistId: string;
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function getManagerProfile(supabase: ReturnType<typeof adminClient>) {
  const email = process.env.TEST_MANAGER_EMAIL;
  let profileId: string | undefined;
  if (email) {
    const users = await supabase.auth.admin.listUsers();
    if (users.error) throw users.error;
    profileId = users.data.users.find((user) => user.email === email)?.id;
  }
  const query = supabase.from('profiles').select('id, client_id, role').limit(1);
  const { data, error } = profileId
    ? await query.eq('id', profileId).single()
    : await query.eq('role', 'Manager').single();
  if (error) throw error;
  return data as { id: string; client_id: string; role: string };
}

async function getTemplate(supabase: ReturnType<typeof adminClient>, clientId: string, profileId: string) {
  const existing = await supabase
    .from('checklist_templates')
    .select('id, current_version')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as { id: string; current_version: number };

  const created = await supabase
    .from('checklist_templates')
    .insert({
      client_id: clientId,
      vehicle_category: 'Leve',
      is_free_form: false,
      name: 'E2E KM',
      current_version: 1,
      status: 'published',
      created_by: profileId,
    })
    .select('id, current_version')
    .single();
  if (created.error) throw created.error;
  return created.data as { id: string; current_version: number };
}

async function createScenario(): Promise<OdometerScenario> {
  const supabase = adminClient();
  const profile = await getManagerProfile(supabase);
  const template = await getTemplate(supabase, profile.client_id, profile.id);
  const suffix = String(Date.now()).slice(-6);
  const plate = `KM${suffix}`;

  const vehicle = await supabase.from('vehicles').insert({
    client_id: profile.client_id,
    license_plate: plate,
    brand: 'Fiat',
    model: 'Mobi',
    year: 2024,
    color: 'Branco',
    renavam: `9${suffix}12345`,
    chassi: `CHSKM${suffix}00000000`,
    detran_uf: 'SP',
    type: 'Passeio',
    energy_source: 'Combustão',
    cooling_equipment: false,
    acquisition: 'Owned',
    fipe_price: 100000,
    tracker: 'Teste',
    antt: '123456',
    owner: 'E2E',
    autonomy: 500,
    category: 'Leve',
    initial_km: 1000,
  }).select('id').single();
  if (vehicle.error) throw vehicle.error;

  const checklist = await supabase.from('checklists').insert({
    client_id: profile.client_id,
    template_id: template.id,
    version_number: template.current_version,
    vehicle_id: vehicle.data.id,
    filled_by: profile.id,
    started_at: '2026-06-22T08:00:00Z',
    completed_at: '2026-06-22T09:00:00Z',
    status: 'completed',
    odometer_km: 100000,
  }).select('id').single();
  if (checklist.error) throw checklist.error;

  return { plate, checklistId: checklist.data.id };
}

test.describe.serial('Odometer correction flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('gestor corrige leitura inflada e mantém KM informado auditável', async ({ page }) => {
    const scenario = await createScenario();
    await login(page, process.env.TEST_MANAGER_EMAIL!, process.env.TEST_MANAGER_PASSWORD!);

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Buscar por placa, modelo ou chassi...').fill(scenario.plate);

    const row = page.locator('tr', { hasText: scenario.plate }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button[title="Visualizar"]').click();

    await page.getByRole('tab', { name: 'Histórico de KM' }).click();
    await expect(page.getByRole('cell', { name: '100.000' }).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Corrigir KM' }).click();

    await page.getByLabel('Km correto').fill('10000');
    await page.getByLabel('Motivo').fill('Erro de digitação no checklist');
    await page.getByRole('button', { name: 'Salvar correção' }).click();

    await expect(page.getByText('Corrigido')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('cell', { name: '100.000' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '10.000' }).first()).toBeVisible();
    expect(scenario.checklistId).toBeTruthy();
  });

  test('Fleet Assistant visualiza historico sem botao de correcao', async ({ browser }) => {
    const scenario = await createScenario();
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await login(page, process.env.TEST_ASSISTANT_EMAIL!, process.env.TEST_ASSISTANT_PASSWORD!);

    await page.goto('/cadastros/veiculos');
    await expect(page.locator('h1', { hasText: 'Veículos' })).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Buscar por placa, modelo ou chassi...').fill(scenario.plate);
    await page.locator('tr', { hasText: scenario.plate }).first().locator('button[title="Visualizar"]').click();
    await page.getByRole('tab', { name: 'Histórico de KM' }).click();

    await expect(page.getByRole('cell', { name: '100.000' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Corrigir KM' })).toHaveCount(0);
    await context.close();
  });
});
