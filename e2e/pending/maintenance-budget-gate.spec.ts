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

/** Cliente PostgREST autenticado como o usuário Manager — é sob esta sessão que o gatilho enxerga auth.uid(). */
async function authedClient(email: string, password: string) {
  const url = optionalEnv('VITE_SUPABASE_URL');
  const anonKey = optionalEnv('VITE_SUPABASE_ANON_KEY') ?? optionalEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !anonKey) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

test.describe.serial('Trava de orçamento na mudança de status da OS', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let blockedReason: string | undefined;
  let supabaseAdmin: ReturnType<typeof adminClient>;
  let supabaseAuthed: Awaited<ReturnType<typeof authedClient>>;
  let managerId = '';
  let otherProfileId = '';
  let clientId = '';
  let workshopId = '';
  let vehicleId = '';
  let suffix = '';
  const createdOrderIds: string[] = [];
  let overrideOrderId = '';

  /** Cria uma OS pelo service_role — o escape hatch do gatilho permite montar qualquer estado inicial. */
  async function seedOrder(status: string, budgetStatus: string, tag: string) {
    const osNumber = `OS-GATE-${tag}-${suffix}`;
    const inserted = await supabaseAdmin.from('maintenance_orders').insert({
      client_id: clientId,
      vehicle_id: vehicleId,
      workshop_id: workshopId,
      os_number: osNumber,
      entry_date: new Date().toISOString().split('T')[0],
      type: 'Corretiva',
      status,
      description: 'Teste da trava de orçamento',
      mechanic_name: 'Teste',
      estimated_cost: 100,
      approved_cost: budgetStatus === 'aprovado' ? 100 : null,
      budget_status: budgetStatus,
      budget_discount: 0,
      created_by_id: managerId,
    }).select('id').single();
    if (inserted.error) throw inserted.error;
    createdOrderIds.push(inserted.data.id);
    return { id: inserted.data.id as string, osNumber };
  }

  async function readOrder(id: string) {
    const result = await supabaseAdmin
      .from('maintenance_orders')
      .select('status, budget_status, notes, budget_override_reason, budget_override_by_id, budget_override_at')
      .eq('id', id)
      .single();
    if (result.error) throw result.error;
    return result.data as {
      status: string;
      budget_status: string;
      notes: string | null;
      budget_override_reason: string | null;
      budget_override_by_id: string | null;
      budget_override_at: string | null;
    };
  }

  test.beforeAll(async () => {
    const email = optionalEnv('TEST_MANAGER_EMAIL');
    const password = optionalEnv('TEST_MANAGER_PASSWORD');
    if (!email || !password) {
      blockedReason = 'Credenciais TEST_MANAGER_EMAIL/TEST_MANAGER_PASSWORD ausentes.';
      return;
    }

    supabaseAdmin = adminClient();
    const manager = await getManager(supabaseAdmin);
    managerId = manager.id;
    clientId = manager.client_id;

    const workshop = await getWorkshop(supabaseAdmin, clientId);
    if (!workshop) {
      blockedReason = 'Cliente do usuário Manager não possui oficina ativa.';
      return;
    }
    workshopId = workshop.id;

    const other = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('client_id', clientId)
      .neq('id', managerId)
      .limit(1)
      .maybeSingle();
    if (other.error) throw other.error;
    otherProfileId = (other.data as { id: string } | null)?.id ?? managerId;

    // A migration precisa estar aplicada em DEV; sem a coluna, o teste é bloqueado, nunca "passado".
    const probe = await supabaseAdmin.from('maintenance_orders').select('budget_override_reason').limit(1);
    if (probe.error) {
      blockedReason = `Migration 20260920000000 ainda não aplicada em DEV: ${probe.error.message}`;
      return;
    }

    supabaseAuthed = await authedClient(email, password);

    suffix = String(Date.now()).slice(-6);
    const vehicle = await supabaseAdmin.from('vehicles').insert({
      client_id: clientId,
      license_plate: `GT${suffix}`,
      brand: 'Fiat',
      model: 'Mobi',
      year: 2024,
      color: 'Branco',
      renavam: `9${suffix}12345`,
      chassi: `CHGAT${suffix}00000000`,
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
  });

  test.afterAll(async () => {
    if (!supabaseAdmin || !vehicleId) return;
    for (const id of createdOrderIds) {
      await supabaseAdmin.from('payment_installments').delete().eq('maintenance_order_id', id);
      await supabaseAdmin.from('maintenance_orders').delete().eq('id', id);
    }
    await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
  });

  test('1. Regra A — sessão autenticada não marca "Orçamento aprovado" sem aprovação', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Aguardando aprovação', 'pendente', 'A1');

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ status: 'Orçamento aprovado' })
      .eq('id', id);

    expect(error).not.toBeNull();
    expect((await readOrder(id)).status).toBe('Aguardando aprovação');
  });

  test('2. Regra A — o caminho do Financeiro funciona', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Aguardando aprovação', 'pendente', 'A2');

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ budget_status: 'aprovado', status: 'Orçamento aprovado', approved_cost: 100 })
      .eq('id', id);

    expect(error).toBeNull();
    const row = await readOrder(id);
    expect(row.status).toBe('Orçamento aprovado');
    expect(row.budget_status).toBe('aprovado');
  });

  test('3. Regra C — entrar na faixa sem orçamento e sem motivo é recusado', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Aguardando orçamento', 'sem_orcamento', 'C3');

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ status: 'Serviço em execução' })
      .eq('id', id);

    expect(error).not.toBeNull();
    expect((await readOrder(id)).status).toBe('Aguardando orçamento');
  });

  test('4. Regra C — com motivo, entra e o banco carimba autor e data', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Aguardando orçamento', 'sem_orcamento', 'C4');
    overrideOrderId = id;

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ status: 'Serviço em execução', budget_override_reason: '  quebra em rodovia  ' })
      .eq('id', id);

    expect(error).toBeNull();
    const row = await readOrder(id);
    expect(row.status).toBe('Serviço em execução');
    expect(row.budget_override_reason).toBe('quebra em rodovia');
    expect(row.budget_override_by_id).toBe(managerId);
    expect(row.budget_override_at).not.toBeNull();
  });

  test('6. Regra C — andar dentro da faixa não exige motivo novo', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ status: 'Concluído' })
      .eq('id', overrideOrderId);

    expect(error).toBeNull();
    const row = await readOrder(overrideOrderId);
    expect(row.status).toBe('Concluído');
    expect(row.budget_override_reason).toBe('quebra em rodovia');
  });

  test('7. Regra C — o motivo é blindado fora da transição qualificada', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ budget_override_reason: 'motivo adulterado', notes: 'x' })
      .eq('id', overrideOrderId);

    expect(error).toBeNull();
    const row = await readOrder(overrideOrderId);
    expect(row.budget_override_reason).toBe('quebra em rodovia');
    expect(row.notes).toBe('x');
  });

  test('5. Regra C — autoria não é forjável', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Aguardando orçamento', 'sem_orcamento', 'C5');

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({
        status: 'Concluído',
        budget_override_reason: 'teste',
        budget_override_by_id: otherProfileId,
        budget_override_at: '2020-01-01T00:00:00Z',
      })
      .eq('id', id);

    expect(error).toBeNull();
    const row = await readOrder(id);
    expect(row.budget_override_by_id).toBe(managerId);
    expect(new Date(row.budget_override_at!).getTime()).toBeGreaterThan(new Date('2026-09-20T00:00:00Z').getTime());
  });

  test('8. Regra C — criação direta em status operacional exige motivo', async () => {
    test.skip(!!blockedReason, blockedReason);

    const osNumber = `OS-GATE-C8-${suffix}`;
    const { error } = await supabaseAuthed.from('maintenance_orders').insert({
      client_id: clientId,
      vehicle_id: vehicleId,
      workshop_id: workshopId,
      os_number: osNumber,
      entry_date: new Date().toISOString().split('T')[0],
      type: 'Corretiva',
      status: 'Veículo retirado',
      description: 'Criação direta sem motivo',
      estimated_cost: 100,
      budget_discount: 0,
      created_by_id: managerId,
    });

    expect(error).not.toBeNull();
    const found = await supabaseAdmin.from('maintenance_orders').select('id').eq('os_number', osNumber);
    if (found.error) throw found.error;
    expect(found.data).toHaveLength(0);
  });

  test('9. Regra B — o bloqueio duro tem precedência sobre a exceção', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Aguardando aprovação', 'pendente', 'B9');

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ status: 'Concluído', budget_override_reason: 'qualquer motivo' })
      .eq('id', id);

    expect(error).not.toBeNull();
    expect((await readOrder(id)).status).toBe('Aguardando aprovação');
  });

  test('10. Orçamento aprovado atravessa a faixa sem motivo nenhum', async () => {
    test.skip(!!blockedReason, blockedReason);

    const { id } = await seedOrder('Orçamento aprovado', 'aprovado', 'A10');

    const { error } = await supabaseAuthed
      .from('maintenance_orders')
      .update({ status: 'Serviço em execução' })
      .eq('id', id);

    expect(error).toBeNull();
    const row = await readOrder(id);
    expect(row.status).toBe('Serviço em execução');
    expect(row.budget_override_reason).toBeNull();
  });
});
