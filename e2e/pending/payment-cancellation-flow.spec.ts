import { expect, test, type Browser, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
// Cancelamento de pagamentos aprovados — fluxo ponta a ponta
// (IMPLEMENTATION.md — Etapa 9)
//
// Cenários:
//   01 — Coordinator aprova o pedido extra pelo card de Aprovações → Extras.
//   02 — Manager vê o pedido aprovado no detalhe, mas sem botão "Cancelar pagamento".
//   03 — Coordinator cancela o pedido extra aprovado com motivo; row vira "Cancelado"
//        e o banco registra status cancelado, motivo e cancelled_by = Coordinator e
//        todas as parcelas canceladas.
//   04 — Financeiro vê o pedido "Cancelado" em Pagamentos Extras e a parcela em
//        Pagamentos com o filtro de status "Cancelado".
//   05 — Coordinator aprova uma parcela de OS aprovada e depois a cancela com motivo;
//        o banco registra status cancelado e cancelled_by = Coordinator.
//   06 — Manager abre a mesma parcela (já cancelada) e não vê "Cancelar pagamento".
//
// Fixtures criadas via ADMIN (service_role) no beforeAll:
//   - um Pagamento Extra pendente_aprovacao de R$ 12,34 com 1 parcela, criado pelo
//     perfil do Assistant, no client dele; a aprovação acontece pela UI (cenário 01),
//     porque o service_role não passa pelo gatilho de aprovação.
//   - uma OS com orçamento aprovado (molde de createApprovedOrder) + 1 parcela de
//     R$ 10,00 pendente_aprovacao inserida via adminClient.
//
// Pré-condição de credenciais (mesma regra dos demais specs em e2e/pending/):
//   - TEST_COORDINATOR_* e TEST_MANAGER_* existem em .env.local;
//   - TEST_FINANCEIRO_* ainda não existe — o cenário 04 fica skipped e não conta
//     como passed.
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
  const users = await supabase.auth.admin.listUsers({ perPage: 1000 });
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

test.describe.serial('Cancelamento de pagamentos aprovados', () => {
  let clientId = '';
  let assistantId = '';
  let coordinatorId = '';
  let workshopId = '';
  let osId = '';
  let osNumber = '';
  let osVehicleId = '';
  let osPlate = '';
  let osInstallmentId = '';

  let extraRequestId = '';
  let extraRequestNumber = '';
  let extraSupplierName = '';

  test.beforeAll(async () => {
    const assistantEmail = optionalEnv('TEST_ASSISTANT_EMAIL');
    if (!assistantEmail) return;
    const assistant = await profileByEmail(assistantEmail);
    clientId = assistant.client_id;
    assistantId = assistant.id;

    const coordinatorEmail = optionalEnv('TEST_COORDINATOR_EMAIL');
    if (coordinatorEmail) coordinatorId = (await profileByEmail(coordinatorEmail)).id;

    // ── Fixture Extra: 1 pedido pendente de R$ 12,34 + 1 parcela ──────────────
    const supabase = adminClient();
    const suffix = String(Date.now()).slice(-6);
    extraRequestNumber = `PE-${suffix}`;
    extraSupplierName = `Guincho Cancelamento E2E ${suffix}`;
    const extra = await supabase.from('extra_payment_requests').insert({
      client_id: clientId,
      request_number: extraRequestNumber,
      category: 'guincho',
      service_date: new Date().toISOString().split('T')[0],
      supplier_name: extraSupplierName,
      amount: 12.34,
      status: 'pendente_aprovacao',
      created_by_id: assistantId,
    }).select('id').single();
    if (extra.error) throw extra.error;
    extraRequestId = extra.data.id as string;

    const extraInstallment = await supabase.from('payment_installments').insert({
      source_type: 'extra_payment',
      extra_payment_request_id: extraRequestId,
      maintenance_order_id: null,
      client_id: clientId,
      created_by_id: assistantId,
      installment_number: 1,
      installments_total: 1,
      value: 12.34,
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      payment_method: 'boleto',
      status: 'pendente_aprovacao',
    }).select('id').single();
    if (extraInstallment.error) throw extraInstallment.error;

    // ── Fixture OS aprovada + 1 parcela de R$ 10,00 ──────────────────────────
    const workshop = await getWorkshop(clientId);
    if (!workshop) return;
    workshopId = workshop.id;
    const order = await createApprovedOrder(clientId, workshopId, assistantId);
    osId = order.osId;
    osNumber = order.osNumber;
    osVehicleId = order.vehicleId;
    const { data: vehicle } = await supabase.from('vehicles').select('license_plate').eq('id', osVehicleId).single();
    osPlate = vehicle?.license_plate ?? '';

    const osInstallment = await supabase.from('payment_installments').insert({
      source_type: 'maintenance_order',
      maintenance_order_id: osId,
      extra_payment_request_id: null,
      client_id: clientId,
      created_by_id: assistantId,
      installment_number: 1,
      installments_total: 1,
      value: 10.0,
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      payment_method: 'boleto',
      status: 'pendente_aprovacao',
    }).select('id').single();
    if (osInstallment.error) throw osInstallment.error;
    osInstallmentId = osInstallment.data.id as string;
  });

  test.afterAll(async () => {
    const supabase = adminClient();
    if (extraRequestId) {
      await supabase.from('payment_installments').delete().eq('extra_payment_request_id', extraRequestId);
      await supabase.from('extra_payment_requests').delete().eq('id', extraRequestId);
    }
    if (osVehicleId && osId) await cleanup(osVehicleId, osId);
  });

  test('01 — Coordinator aprova o pedido extra e suas parcelas pelo card de Aprovações', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password || !extraRequestId) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes ou fixture de extra indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro?tab=approvals&segment=extras');
      const card = page.locator('div', { hasText: extraSupplierName }).filter({ has: page.getByRole('button', { name: 'Aprovar pedido e parcelas' }) }).last();
      await expect(card).toBeVisible({ timeout: 15000 });
      await card.getByRole('button', { name: 'Aprovar pedido e parcelas' }).click();
      await expect(page.getByRole('dialog', { name: 'Aprovar pagamento extra' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Confirmar aprovação' }).click();
      await expect(page.locator('div', { hasText: extraSupplierName }).filter({ has: page.getByRole('button', { name: 'Aprovar pedido e parcelas' }) })).toHaveCount(0, { timeout: 15000 });
    } finally {
      await page.context().close();
    }
  });

  test('02 — Manager vê o pedido aprovado no detalhe, mas sem "Cancelar pagamento"', async ({ browser }) => {
    const email = optionalEnv('TEST_MANAGER_EMAIL');
    const password = optionalEnv('TEST_MANAGER_PASSWORD');
    if (!email || !password || !extraRequestId) {
      test.skip(true, 'TEST_MANAGER_EMAIL/PASSWORD ausentes ou fixture de extra indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro?tab=extras');
      const row = page.locator('tr', { hasText: extraRequestNumber }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByTitle('Visualizar').click();
      await expect(page.getByText('Detalhes do Pagamento Extra')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: 'Cancelar pagamento' })).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test('03 — Coordinator cancela o pedido extra aprovado com motivo; banco e parcelas atualizados', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password || !extraRequestId || !coordinatorId) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes ou fixture de extra indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro?tab=extras');
      const row = page.locator('tr', { hasText: extraRequestNumber }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByTitle('Visualizar').click();
      await expect(page.getByText('Detalhes do Pagamento Extra')).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Cancelar pagamento' }).click();
      await expect(page.getByRole('dialog', { name: 'Cancelar pagamento extra' })).toBeVisible({ timeout: 10000 });
      await page.getByLabel('Motivo do cancelamento').fill('E2E: serviço não realizado');
      await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
      await expect(page.getByRole('dialog', { name: 'Cancelar pagamento extra' })).toHaveCount(0, { timeout: 15000 });
      await expect(row.getByText('Cancelado')).toBeVisible({ timeout: 15000 });

      const supabase = adminClient();
      const { data: extra, error } = await supabase
        .from('extra_payment_requests')
        .select('status, cancellation_reason, cancelled_by')
        .eq('id', extraRequestId)
        .single();
      expect(error).toBeNull();
      expect(extra?.status).toBe('cancelado');
      expect(extra?.cancellation_reason).toBe('E2E: serviço não realizado');
      expect(extra?.cancelled_by).toBe(coordinatorId);

      const { data: installments } = await supabase
        .from('payment_installments')
        .select('status')
        .eq('extra_payment_request_id', extraRequestId);
      expect(installments?.length).toBe(1);
      expect(installments?.every((i) => i.status === 'cancelado')).toBe(true);
    } finally {
      await page.context().close();
    }
  });

  test('04 — Financeiro vê o pedido "Cancelado" e a parcela com o filtro Cancelado', async ({ browser }) => {
    const email = optionalEnv('TEST_FINANCEIRO_EMAIL');
    const password = optionalEnv('TEST_FINANCEIRO_PASSWORD');
    if (!email || !password || !extraRequestId) {
      test.skip(true, 'TEST_FINANCEIRO_EMAIL/PASSWORD ausentes — cargo Financeiro não tem usuário de teste cadastrado ainda.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro?tab=extras');
      const row = page.locator('tr', { hasText: extraRequestNumber }).first();
      await expect(row.getByText('Cancelado')).toBeVisible({ timeout: 15000 });

      await page.goto('/financeiro?tab=payments');
      const statusSelect = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Cancelado' }) });
      await statusSelect.selectOption('cancelado');
      const parcelRow = page.locator('tr', { hasText: 'R$ 12,34' }).first();
      await expect(parcelRow).toBeVisible({ timeout: 15000 });
      await expect(parcelRow.getByText('Extra')).toBeVisible();
      await expect(parcelRow.getByText('Cancelado')).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test('05 — Coordinator aprova e depois cancela parcela de OS aprovada; banco atualizado', async ({ browser }) => {
    const email = optionalEnv('TEST_COORDINATOR_EMAIL');
    const password = optionalEnv('TEST_COORDINATOR_PASSWORD');
    if (!email || !password || !osInstallmentId || !workshopId || !coordinatorId) {
      test.skip(true, 'TEST_COORDINATOR_EMAIL/PASSWORD ausentes ou fixture de OS aprovada indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      // 2. Aprova a parcela em Aprovações → Pagamentos.
      await page.goto('/financeiro?tab=approvals&segment=payments');
      const card = page.locator('div', { hasText: osNumber }).filter({ has: page.getByRole('button', { name: 'Aprovar todas' }) }).last();
      await expect(card).toBeVisible({ timeout: 15000 });
      await card.getByRole('button', { name: 'Aprovar todas' }).click();
      await expect(page.getByRole('dialog', { name: 'Aprovar parcelas' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Confirmar aprovação' }).click();
      await expect(page.locator('div', { hasText: osNumber }).filter({ has: page.getByRole('button', { name: 'Aprovar todas' }) })).toHaveCount(0, { timeout: 15000 });

      // 3. Cancela a parcela em Pagamentos, filtrando pela placa.
      await page.goto('/financeiro?tab=payments');
      await page.getByLabel('Filtrar por placa').fill(osPlate);
      const row = page.locator('tr', { hasText: osPlate }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByTitle('Visualizar parcela').click();
      await expect(page.getByText('Detalhes do pagamento')).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Cancelar pagamento' }).click();
      await expect(page.getByRole('dialog', { name: 'Cancelar parcela' })).toBeVisible({ timeout: 10000 });
      await page.getByLabel('Motivo do cancelamento').fill('E2E: parcela duplicada');
      await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
      await expect(page.getByRole('dialog', { name: 'Cancelar parcela' })).toHaveCount(0, { timeout: 15000 });
      await expect(row.getByText('Cancelado')).toBeVisible({ timeout: 15000 });

      const supabase = adminClient();
      const { data: installment, error } = await supabase
        .from('payment_installments')
        .select('status, cancelled_by')
        .eq('id', osInstallmentId)
        .single();
      expect(error).toBeNull();
      expect(installment?.status).toBe('cancelado');
      expect(installment?.cancelled_by).toBe(coordinatorId);
    } finally {
      await page.context().close();
    }
  });

  test('06 — Manager abre a parcela cancelada e não vê "Cancelar pagamento"', async ({ browser }) => {
    const email = optionalEnv('TEST_MANAGER_EMAIL');
    const password = optionalEnv('TEST_MANAGER_PASSWORD');
    if (!email || !password || !osInstallmentId || !osPlate) {
      test.skip(true, 'TEST_MANAGER_EMAIL/PASSWORD ausentes ou fixture de OS aprovada indisponível.');
      return;
    }

    const page = await loginAs(browser, email, password);
    try {
      await page.goto('/financeiro?tab=payments');
      await page.getByLabel('Filtrar por placa').fill(osPlate);
      const row = page.locator('tr', { hasText: osPlate }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByTitle('Visualizar parcela').click();
      await expect(page.getByText('Detalhes do pagamento')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: 'Cancelar pagamento' })).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });
});