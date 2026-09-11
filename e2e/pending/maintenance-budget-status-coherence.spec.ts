import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function adminClient() {
  const url = optionalEnv('VITE_SUPABASE_URL');
  const key = optionalEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function getManager(supabase: ReturnType<typeof adminClient>) {
  const email = optionalEnv('TEST_MANAGER_EMAIL');
  if (email) {
    const users = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (users.error) throw users.error;
    const user = users.data.users.find((candidate) => candidate.email === email);
    if (user) {
      const profile = await supabase.from('profiles').select('id, client_id, role').eq('id', user.id).single();
      if (profile.error) throw profile.error;
      return profile.data as { id: string; client_id: string; role: string };
    }
  }

  const profile = await supabase.from('profiles').select('id, client_id, role').eq('role', 'Manager').limit(1).single();
  if (profile.error) throw profile.error;
  return profile.data as { id: string; client_id: string; role: string };
}

async function getWorkshop(supabase: ReturnType<typeof adminClient>, clientId: string) {
  const result = await supabase
    .from('workshops')
    .select('id')
    .eq('client_id', clientId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as { id: string } | null;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function expectPaymentOption(page: Page, osNumber: string, visible: boolean) {
  await page.goto('/financeiro?tab=payments');
  await page.getByRole('button', { name: /Cadastrar Pagamento/i }).click();
  const combobox = page.getByRole('combobox', { name: 'Ordem de Serviço (orçamento aprovado)' });
  await expect(combobox).toBeVisible({ timeout: 10000 });
  await combobox.fill(osNumber);
  if (visible) {
    await expect(page.getByRole('option', { name: new RegExp(osNumber) })).toHaveCount(1, { timeout: 10000 });
  } else {
    await expect(page.getByText('Nenhuma OS encontrada')).toBeVisible({ timeout: 10000 });
  }
}

test.describe.serial('Coerência entre status operacional e orçamento da OS', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let blockedReason: string | undefined;
  let osId = '';
  let vehicleId = '';
  let osNumber = '';
  let plate = '';

  test.beforeAll(async () => {
    const email = optionalEnv('TEST_MANAGER_EMAIL');
    const password = optionalEnv('TEST_MANAGER_PASSWORD');
    if (!email || !password) {
      blockedReason = 'Credenciais TEST_MANAGER_EMAIL/TEST_MANAGER_PASSWORD ausentes.';
      return;
    }

    const supabase = adminClient();
    const manager = await getManager(supabase);
    const workshop = await getWorkshop(supabase, manager.client_id);
    if (!workshop) {
      blockedReason = 'Cliente do usuário Manager não possui oficina ativa.';
      return;
    }

    const suffix = String(Date.now()).slice(-6);
    plate = `CO${suffix}`;
    osNumber = `OS-COH-${suffix}`;

    const vehicle = await supabase.from('vehicles').insert({
      client_id: manager.client_id,
      license_plate: plate,
      brand: 'Fiat',
      model: 'Mobi',
      year: 2024,
      color: 'Branco',
      renavam: `8${suffix}12345`,
      chassi: `CHCOH${suffix}00000000`,
      detran_uf: 'SP',
      type: 'Passeio',
      energy_source: 'Combustão',
      cooling_equipment: false,
      acquisition: 'Owned',
      fipe_price: 100000,
      tracker: 'Teste',
      antt: '12345',
      owner: 'E2E',
      autonomy: 500,
      category: 'Leve',
      initial_km: 1000,
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    vehicleId = vehicle.data.id;

    const order = await supabase.from('maintenance_orders').insert({
      client_id: manager.client_id,
      vehicle_id: vehicleId,
      workshop_id: workshop.id,
      os_number: osNumber,
      entry_date: new Date().toISOString().split('T')[0],
      expected_exit_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      type: 'Corretiva',
      status: 'Aguardando aprovação',
      description: 'Teste de coerência de status e orçamento',
      mechanic_name: 'Teste',
      estimated_cost: 100,
      approved_cost: null,
      budget_status: 'pendente',
      budget_discount: 0,
      created_by_id: manager.id,
    }).select('id').single();
    if (order.error) throw order.error;
    osId = order.data.id;

    const item = await supabase.from('maintenance_budget_items').insert({
      maintenance_order_id: osId,
      client_id: manager.client_id,
      item_name: 'Teste de orçamento',
      system: 'freios',
      quantity: 1,
      value: 100,
      discount: 0,
      sort_order: 0,
    });
    if (item.error) throw item.error;
  });

  test.afterAll(async () => {
    if (!osId || !vehicleId) return;
    const supabase = adminClient();
    await supabase.from('payment_installments').delete().eq('maintenance_order_id', osId);
    await supabase.from('maintenance_orders').delete().eq('id', osId);
    await supabase.from('vehicles').delete().eq('id', vehicleId);
  });

  test('mantém a OS fora das transições bloqueadas, aprova o orçamento e libera pagamento a partir da aprovação', async ({ page }) => {
    if (blockedReason) {
      test.skip(true, blockedReason);
      return;
    }

    await login(page, optionalEnv('TEST_MANAGER_EMAIL')!, optionalEnv('TEST_MANAGER_PASSWORD')!);

    await page.goto('/manutencao');
    await expect(page.locator('h1', { hasText: /Manuten/i })).toBeVisible({ timeout: 15000 });
    await page.locator('input[placeholder*="Buscar"]').first().fill(plate);
    const maintenanceRow = page.locator('tr', { hasText: plate }).first();
    await expect(maintenanceRow).toBeVisible({ timeout: 15000 });

    await expect(maintenanceRow.locator('button[title="Retirar Veículo"]')).toHaveCount(0);
    await expect(maintenanceRow.locator('select[title="Ações"] option[value="Concluído"]')).toHaveCount(0);

    await maintenanceRow.locator('button[title="Editar"]').click();
    const statusSelect = page.locator('select#status');
    await expect(statusSelect).toBeVisible({ timeout: 10000 });
    const blockedCompleteOption = statusSelect.locator('option[value="Concluído"]');
    await expect(blockedCompleteOption).toBeDisabled();
    await expect(blockedCompleteOption).toHaveAttribute('title', /aguardando aprovação/);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();

    await expectPaymentOption(page, osNumber, false);
    await page.goto('/financeiro?tab=budget&segment=pending');
    const pendingRow = page.locator('tbody tr', { hasText: osNumber });
    await expect(pendingRow).toBeVisible({ timeout: 15000 });

    await pendingRow.getByRole('button', { name: /Aprovar/ }).click();
    await expect(page.locator('tbody tr', { hasText: osNumber })).toHaveCount(0, { timeout: 15000 });

    await expectPaymentOption(page, osNumber, true);

    await page.goto('/manutencao');
    await page.locator('input[placeholder*="Buscar"]').first().fill(plate);
    const approvedRow = page.locator('tr', { hasText: plate }).first();
    await expect(approvedRow).toBeVisible({ timeout: 15000 });
    await approvedRow.locator('button[title="Editar"]').click();
    await page.locator('select#status').selectOption('Serviço em execução');
    await page.getByRole('button', { name: 'Salvar Edição', exact: true }).click();
    await expect(page.locator('tr', { hasText: plate }).first()).toContainText('Serviço em execução', { timeout: 15000 });

    await expectPaymentOption(page, osNumber, true);
    await page.goto('/manutencao');
    await page.locator('input[placeholder*="Buscar"]').first().fill(plate);

    const executingRow = page.locator('tr', { hasText: plate }).first();
    await executingRow.locator('select[title="Ações"]').selectOption('Concluído');
    await expect(page.locator('tr', { hasText: plate }).first()).toContainText('Concluído', { timeout: 15000 });
    await page.locator('tr', { hasText: plate }).first().locator('button[title="Retirar Veículo"]').click();
    await expect(page.locator('tr', { hasText: plate }).first()).toContainText('Veículo retirado', { timeout: 15000 });

    await expectPaymentOption(page, osNumber, true);
  });
});
