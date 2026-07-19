import { expect, test, type Browser, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
// Pagamentos Extras / Serviços Avulsos — fluxo ponta a ponta
// (IMPLEMENTATION.md — sessão "Financeiro — Pagamentos Extras", Etapa 11)
//
// PRÉ-CONDIÇÃO: não há usuário de teste "Financeiro" cadastrado em .env.local
// (TEST_FINANCEIRO_EMAIL / TEST_FINANCEIRO_PASSWORD ausentes) — mesma limitação
// documentada em financeiro-payment-flow.spec.ts. Cenários que dependem desse
// usuário são pulados (test.skip); os demais (Assistant, Coordinator, Workshop)
// rodam quando as credenciais existirem em .env.local.
// ══════════════════════════════════════════════════════════════════════════════

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing required E2E credential env: ${name}`);
  return value;
}

function adminClient() {
  return createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
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

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await login(page, email, password);
  return page;
}

async function profileByEmail(email: string) {
  const supabase = adminClient();
  const users = await supabase.auth.admin.listUsers();
  if (users.error) throw users.error;
  const profileId = users.data.users.find((u) => u.email === email)?.id;
  if (!profileId) throw new Error(`Auth user not found for ${email}`);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, client_id, role')
    .eq('id', profileId)
    .single();
  if (error) throw error;
  return data as { id: string; client_id: string; role: string };
}

async function createVehicleWithDriver(clientId: string) {
  const supabase = adminClient();
  const suffix = String(Date.now()).slice(-6);

  const driver = await supabase.from('drivers').insert({
    client_id: clientId,
    name: `Motorista E2E ${suffix}`,
    cpf: `${suffix}00011122`,
  }).select('id').single();
  if (driver.error) throw driver.error;

  const vehicle = await supabase.from('vehicles').insert({
    client_id: clientId,
    license_plate: `EXT${suffix}`,
    brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
    renavam: `9${suffix}54321`, chassi: `CHEXT${suffix}0000000`, detran_uf: 'SP',
    type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
    acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '123456',
    owner: 'E2E', autonomy: 500, category: 'Leve',
    driver_id: driver.data.id,
  }).select('id').single();
  if (vehicle.error) throw vehicle.error;

  return { vehicleId: vehicle.data.id as string, driverId: driver.data.id as string };
}

async function cleanup(vehicleId: string, driverId: string, requestNumbers: string[]) {
  const supabase = adminClient();
  if (requestNumbers.length > 0) {
    const { data: requests } = await supabase
      .from('extra_payment_requests')
      .select('id')
      .in('request_number', requestNumbers);
    const ids = (requests ?? []).map((r) => r.id as string);
    if (ids.length > 0) {
      await supabase.from('payment_installments').delete().in('extra_payment_request_id', ids);
      await supabase.from('extra_payment_requests').delete().in('id', ids);
    }
  }
  await supabase.from('vehicles').delete().eq('id', vehicleId);
  await supabase.from('drivers').delete().eq('id', driverId);
}

test.describe.serial('Pagamentos Extras — lançamento, aprovação, visão do Financeiro e CSV', () => {
  let clientId = '';
  let vehicleId = '';
  let driverId = '';
  let vehiclePlate = '';
  const createdRequestNumbers: string[] = [];

  test.beforeAll(async () => {
    const assistantEmail = optionalEnv('TEST_ASSISTANT_EMAIL');
    if (!assistantEmail) return;
    const assistant = await profileByEmail(assistantEmail);
    clientId = assistant.client_id;
    const fixture = await createVehicleWithDriver(clientId);
    vehicleId = fixture.vehicleId;
    driverId = fixture.driverId;
  });

  test.afterAll(async () => {
    if (vehicleId && driverId) await cleanup(vehicleId, driverId, createdRequestNumbers);
  });

  test('01 — Fleet Assistant cria pagamento extra com veículo; motorista é preenchido automaticamente', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password || !vehicleId) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes ou fixture de veículo indisponível.');
      return;
    }

    const supabase = adminClient();
    const { data: vehicle } = await supabase.from('vehicles').select('license_plate').eq('id', vehicleId).single();
    vehiclePlate = vehicle?.license_plate as string;

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await expect(page.getByRole('tab', { name: 'Pagamentos Extras' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: 'Pagamentos Extras' }).click();

      await page.getByRole('button', { name: /Novo Pagamento Extra/i }).click();
      await expect(page.getByText('Novo Pagamento Extra')).toBeVisible({ timeout: 10000 });

      await page.getByLabel('Data do serviço').fill(new Date().toISOString().split('T')[0]);
      await page.getByLabel('Fornecedor').fill('Guincho E2E LTDA');
      await page.getByLabel('Veículo').selectOption({ label: new RegExp(vehiclePlate) });

      const driverSelect = page.getByLabel('Motorista');
      await expect(driverSelect).not.toHaveValue('');

      await page.getByLabel('Valor').fill('350');
      await page.getByLabel('1º vencimento').fill(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
      await page.getByRole('button', { name: 'Gerar parcelas' }).click();

      await expect(page.getByText(/1 parcela\(s\)/)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Salvar 1 parcela/ }).click();

      await expect(page.getByText('Novo Pagamento Extra')).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Guincho E2E LTDA').first()).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('02 — Fleet Assistant cria parcelas em lote Pix', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Pagamentos Extras' }).click();
      await page.getByRole('button', { name: /Novo Pagamento Extra/i }).click();

      await page.getByLabel('Data do serviço').fill(new Date().toISOString().split('T')[0]);
      await page.getByLabel('Fornecedor').fill('Frete de Apoio E2E');
      await page.getByLabel('Valor').fill('900');
      await page.getByLabel('Forma de pagamento').selectOption('pix');
      await page.getByLabel('Chave Pix').fill('11999998888');

      await page.getByRole('button', { name: 'Gerar em lote' }).click();
      await page.getByLabel('Nº de parcelas').fill('3');
      await page.getByLabel('1º vencimento').fill(new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]);
      await page.getByRole('button', { name: 'Gerar parcelas' }).click();

      await expect(page.getByText(/3 parcela\(s\)/)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Salvar 3 parcela/ }).click();

      await expect(page.getByText('Novo Pagamento Extra')).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Frete de Apoio E2E').first()).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('03 — Coordinator aprova pagamento extra pendente', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await expect(page.getByRole('tab', { name: 'Aprovação de Extras' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: 'Aprovação de Extras' }).click();

      const row = page.locator('tr', { hasText: 'Guincho E2E LTDA' }).first();
      if (await row.count() === 0) {
        test.skip(true, 'Fixture do cenário 01 indisponível.');
        return;
      }
      await row.getByRole('button', { name: 'Aprovar' }).click();
      await expect(row).not.toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('04 — Coordinator reprova extra exigindo motivo', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Aprovação de Extras' }).click();

      const row = page.locator('tr', { hasText: 'Frete de Apoio E2E' }).first();
      if (await row.count() === 0) {
        test.skip(true, 'Fixture do cenário 02 indisponível.');
        return;
      }
      await row.getByRole('button', { name: 'Reprovar' }).click();

      const confirmButton = page.getByRole('button', { name: 'Confirmar reprovação' });
      await expect(confirmButton).toBeDisabled();

      await page.getByRole('textbox').last().fill('Documentação incompleta');
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      await expect(row).not.toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('05 — Financeiro vê somente extras aprovados/pagos', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes — cargo Financeiro não tem usuário de teste cadastrado ainda.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await expect(page).toHaveURL('/financeiro', { timeout: 15000 });
      await page.getByRole('tab', { name: 'Pagamentos' }).click();
      await page.getByLabel('Todas as formas').selectOption('');

      await expect(page.getByText('Guincho E2E LTDA').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Frete de Apoio E2E')).not.toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test('06 — Financeiro baixa CSV com fornecedor/documento de extra', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Pagamentos' }).click();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Baixar CSV/ }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/pagamentos_.*\.csv/);
    } finally {
      await page.context().close();
    }
  });

  test('07 — Financeiro marca extra aprovado como pago', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Pagamentos' }).click();

      const row = page.locator('tr', { hasText: 'Guincho E2E LTDA' }).first();
      if (await row.count() === 0) {
        test.skip(true, 'Fixture do cenário 03 indisponível.');
        return;
      }
      await row.locator('input[type="checkbox"]').check();
      await page.getByRole('button', { name: /Marcar selecionadas como Pago/ }).click();
      await expect(row.getByText('Pago')).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('08 — Usuário de Workshop não acessa/cria extras', async ({ browser }) => {
    const email = optionalEnv('TEST_WORKSHOP_EMAIL');
    const password = optionalEnv('TEST_WORKSHOP_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_WORKSHOP_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await expect(page.getByRole('tab', { name: 'Pagamentos Extras' })).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('tab', { name: 'Aprovação de Extras' })).not.toBeVisible({ timeout: 10000 });
    } finally {
      await page.context().close();
    }
  });

  test('09 — boleto único aplica-se a todas as parcelas', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Pagamentos Extras' }).click();
      await page.getByRole('button', { name: /Novo Pagamento Extra/i }).click();
      await expect(page.getByText('Novo Pagamento Extra')).toBeVisible({ timeout: 10000 });

      await page.getByLabel('Data do serviço').fill(new Date().toISOString().split('T')[0]);
      await page.getByLabel('Fornecedor').fill('Boleto Único E2E');
      await page.getByLabel('Valor').fill('600');

      await page.getByLabel('Boleto único (opcional)').setInputFiles('test-crlv.pdf');
      await expect(page.getByText('Boleto único anexado')).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: 'Gerar em lote' }).click();
      await page.getByLabel('Nº de parcelas').fill('3');
      await page.getByLabel('1º vencimento').fill(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
      await page.getByRole('button', { name: 'Gerar parcelas' }).click();

      await expect(page.getByText(/3 parcela\(s\)/)).toBeVisible({ timeout: 10000 });

      const rows = page.locator('table tbody tr');
      await expect(rows).toHaveCount(3);
      for (let i = 0; i < 3; i += 1) {
        await expect(rows.nth(i).getByText('Boleto único')).toBeVisible();
        await expect(rows.nth(i).locator('input[type="file"]')).toHaveCount(0);
      }

      await page.getByRole('button', { name: /Salvar 3 parcela/ }).click();
      await expect(page.getByText('Novo Pagamento Extra')).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Boleto Único E2E').first()).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });
});
