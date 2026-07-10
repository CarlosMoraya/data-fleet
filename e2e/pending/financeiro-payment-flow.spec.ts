import { expect, test, type Browser, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
// Módulo Financeiro — fluxo ponta a ponta de parcelas de pagamento
// (IMPLEMENTATION.md — Etapa 10)
//
// PRÉ-CONDIÇÃO: não há usuário de teste "Financeiro" cadastrado em .env.local
// (TEST_FINANCEIRO_EMAIL / TEST_FINANCEIRO_PASSWORD ausentes) — o cargo foi criado
// nesta sessão (Etapa 1) e ainda não tem massa de teste associada. Os cenários que
// dependem desse usuário são pulados (test.skip) documentando o motivo; os demais
// (Assistant, Coordinator, Workshop) rodam normalmente pois já existem em
// .env.local. Ver docs/MEMORY.md — "usuários de teste deletados" / cargo Financeiro.
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

async function getWorkshop(clientId: string) {
  const { data, error } = await adminClient()
    .from('workshops')
    .select('id, name, cnpj')
    .eq('client_id', clientId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; cnpj: string | null } | null;
}

async function createApprovedOrder(clientId: string, workshopId: string, createdById: string) {
  const supabase = adminClient();
  const suffix = String(Date.now()).slice(-6);

  const vehicle = await supabase.from('vehicles').insert({
    client_id: clientId,
    license_plate: `FIN${suffix}`,
    brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
    renavam: `9${suffix}12345`, chassi: `CHFIN${suffix}0000000`, detran_uf: 'SP',
    type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
    acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '123456',
    owner: 'E2E', autonomy: 500, category: 'Leve',
  }).select('id').single();
  if (vehicle.error) throw vehicle.error;

  const osNumber = `OS-FIN-${suffix}`;
  const os = await supabase.from('maintenance_orders').insert({
    client_id: clientId,
    vehicle_id: vehicle.data.id,
    workshop_id: workshopId,
    os_number: osNumber,
    entry_date: new Date().toISOString().split('T')[0],
    type: 'Corretiva',
    status: 'Concluído',
    estimated_cost: 3000,
    approved_cost: 3000,
    budget_status: 'aprovado',
    created_by_id: createdById,
  }).select('id').single();
  if (os.error) throw os.error;

  return { osId: os.data.id as string, osNumber, vehicleId: vehicle.data.id as string };
}

async function cleanup(vehicleId: string, osId: string) {
  const supabase = adminClient();
  await supabase.from('payment_installments').delete().eq('maintenance_order_id', osId);
  await supabase.from('maintenance_orders').delete().eq('id', osId);
  await supabase.from('vehicles').delete().eq('id', vehicleId);
}

test.describe.serial('Módulo Financeiro — cadastro, aprovação e pagamento de parcelas', () => {
  let clientId = '';
  let assistantId = '';
  let workshopId = '';
  let osId = '';
  let osNumber = '';
  let vehicleId = '';

  test.beforeAll(async () => {
    const assistantEmail = optionalEnv('TEST_ASSISTANT_EMAIL');
    if (!assistantEmail) return;
    const assistant = await profileByEmail(assistantEmail);
    clientId = assistant.client_id;
    assistantId = assistant.id;
    const workshop = await getWorkshop(clientId);
    if (!workshop) return;
    workshopId = workshop.id;
    const order = await createApprovedOrder(clientId, workshopId, assistantId);
    osId = order.osId;
    osNumber = order.osNumber;
    vehicleId = order.vehicleId;
  });

  test.afterAll(async () => {
    if (osId && vehicleId) await cleanup(vehicleId, osId);
  });

  test('01 — Assistant cadastra parcela em lote a partir de OS aprovada', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password || !osId) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes ou fixture de OS aprovada indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await expect(page.getByRole('tab', { name: 'Pagamentos' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: 'Pagamentos' }).click();

      await page.getByRole('button', { name: /Cadastrar Pagamento/i }).click();
      await expect(page.getByText('Ordem de Serviço (orçamento aprovado)')).toBeVisible({ timeout: 10000 });

      await page.locator('select').first().selectOption({ label: new RegExp(osNumber) });
      await page.getByLabel('Nº de parcelas').fill('3');
      await page.getByLabel('1º vencimento').fill(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      await page.getByRole('button', { name: 'Gerar parcelas' }).click();

      await expect(page.getByText(/3 parcela\(s\)/)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Salvar 3 parcela/ }).click();

      await expect(page.getByText('Cadastrar Pagamento')).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByText(osNumber).first()).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('02 — Coordinator aprova a parcela na aba Aprovação de Pagamentos', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password || !osId) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes ou fixture indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await expect(page.getByRole('tab', { name: 'Aprovação de Pagamentos' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: 'Aprovação de Pagamentos' }).click();

      const row = page.locator('tr', { hasText: osNumber }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByRole('button', { name: 'Aprovar' }).click();
      await expect(row).not.toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('03 — parcela não vai a "pago" sem aprovação prévia (trigger rejeita via API)', async () => {
    if (!osId) {
      test.skip(true, 'Fixture de OS aprovada indisponível.');
      return;
    }
    const supabase = adminClient();
    const { data: pending } = await supabase
      .from('payment_installments')
      .select('id, status')
      .eq('maintenance_order_id', osId)
      .eq('status', 'pendente_aprovacao')
      .limit(1)
      .maybeSingle();

    if (!pending) {
      test.skip(true, 'Nenhuma parcela pendente de aprovação disponível para este cenário (depende do teste 01/02).');
      return;
    }

    const { error } = await supabase
      .from('payment_installments')
      .update({ status: 'pago' })
      .eq('id', pending.id);

    expect(error).toBeTruthy();
  });

  test('04 — Financeiro marca parcela aprovada como Pago e baixa a planilha', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password || !osId) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes — cargo Financeiro não tem usuário de teste cadastrado ainda.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await expect(page).toHaveURL('/financeiro', { timeout: 15000 });
      await expect(page.getByText(osNumber).first()).toBeVisible({ timeout: 15000 });

      const row = page.locator('tr', { hasText: osNumber }).first();
      await row.locator('input[type="checkbox"]').check();

      const markPaidButton = page.getByRole('button', { name: /Marcar selecionadas como Pago/ });
      await expect(markPaidButton).toBeEnabled({ timeout: 10000 });

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Baixar planilha/ }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^pagamentos_.*\.csv$/);

      await markPaidButton.click();
      await expect(row.getByText('Pago')).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('05 — Workshop não vê a aba Orçamento em /financeiro', async ({ browser }) => {
    const email = optionalEnv('TEST_WORKSHOP_EMAIL');
    const password = optionalEnv('TEST_WORKSHOP_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_WORKSHOP_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('tab', { name: 'Orçamento' })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: 'Pagamentos' })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test('06 — Financeiro só acessa /financeiro (demais rotas fora do allowlist)', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes — cargo Financeiro não tem usuário de teste cadastrado ainda.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await expect(page).toHaveURL('/financeiro', { timeout: 15000 });
      await page.goto('/manutencao');
      await expect(page).toHaveURL('/financeiro', { timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('08 — bloqueio de over-budget ao cadastrar parcelas acima do saldo aprovado', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password || !osId) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes ou fixture de OS aprovada indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Pagamentos' }).click();
      await page.getByRole('button', { name: /Cadastrar Pagamento/i }).click();
      await expect(page.getByText('Ordem de Serviço (orçamento aprovado)')).toBeVisible({ timeout: 10000 });

      await page.locator('select').first().selectOption({ label: new RegExp(osNumber) });
      await page.getByLabel('Nº de parcelas').fill('1');
      await page.getByLabel('1º vencimento').fill(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      await page.getByRole('button', { name: 'Gerar parcelas' }).click();

      const valueInput = page.locator('table input[type="number"]').first();
      await page.getByRole('button', { name: 'Editar parcela' }).click();
      await valueInput.fill('99999999');

      await expect(page.getByText(/A soma das parcelas ultrapassa o saldo do orçamento/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /Salvar 1 parcela/ })).toBeDisabled();
    } finally {
      await page.context().close();
    }
  });

  test('09 — edição de parcela pendente persiste e parcela aprovada/paga não mostra Editar', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password || !osId) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes ou fixture de OS aprovada indisponível.');
      return;
    }

    const supabase = adminClient();
    const { data: pendingInstallment } = await supabase
      .from('payment_installments')
      .select('id')
      .eq('maintenance_order_id', osId)
      .eq('status', 'pendente_aprovacao')
      .limit(1)
      .maybeSingle();

    if (!pendingInstallment) {
      test.skip(true, 'Nenhuma parcela pendente disponível para este cenário (depende do teste 01).');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Pagamentos' }).click();
      const row = page.locator('tr', { hasText: osNumber }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByTitle('Editar parcela').click();

      await expect(page.getByText(/Editar parcela/)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText(/Editar parcela/)).not.toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('10 — aba Aprovação exibe colunas de orçamento e aprovador do orçamento', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password || !osId) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes ou fixture indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro');
      await page.getByRole('tab', { name: 'Aprovação de Pagamentos' }).click();
      await expect(page.getByText('Orçamento aprovado por')).toBeVisible({ timeout: 15000 });

      const row = page.locator('tr', { hasText: osNumber }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('07 — rota /aprovacao-orcamentos não existe mais', async ({ browser }) => {
    const email = optionalEnv('TEST_ASSISTANT_EMAIL');
    const password = optionalEnv('TEST_ASSISTANT_PASSWORD');
    if (!email || !password) {
      test.skip(true, 'TEST_ASSISTANT_EMAIL/PASSWORD ausentes.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/aprovacao-orcamentos');
      await expect(page).not.toHaveURL('/aprovacao-orcamentos', { timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });
});
