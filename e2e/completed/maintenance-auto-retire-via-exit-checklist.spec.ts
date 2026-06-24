import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function getManager(supabase: ReturnType<typeof adminClient>) {
  const email = process.env.TEST_MANAGER_EMAIL;
  let profileId: string | undefined;
  if (email) {
    const users = await supabase.auth.admin.listUsers();
    if (users.error) throw users.error;
    profileId = users.data.users.find((u) => u.email === email)?.id;
  }
  const q = supabase.from('profiles').select('id, client_id, role').limit(1);
  const { data, error } = profileId
    ? await q.eq('id', profileId).single()
    : await q.eq('role', 'Manager').single();
  if (error) throw error;
  return data as { id: string; client_id: string; role: string };
}

async function getWorkshop(supabase: ReturnType<typeof adminClient>, clientId: string) {
  const { data, error } = await supabase
    .from('workshops')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string } | null;
}

async function getOrCreateExitTemplate(
  supabase: ReturnType<typeof adminClient>,
  clientId: string,
  profileId: string,
): Promise<{ id: string; current_version: number }> {
  // Reusa template published de "Saída de Oficina" se já existir para o tenant.
  const existing = await supabase
    .from('checklist_templates')
    .select('id, current_version')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .eq('context', 'Saída de Oficina')
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as { id: string; current_version: number };

  // Caso contrário cria um template free_form (sem categoria) para evitar
  // a EXCLUDE constraint de categorias publicadas.
  const created = await supabase
    .from('checklist_templates')
    .insert({
      client_id: clientId,
      is_free_form: true,
      name: `E2E Saída Oficina ${String(Date.now()).slice(-6)}`,
      current_version: 1,
      status: 'published',
      context: 'Saída de Oficina',
      created_by: profileId,
    })
    .select('id, current_version')
    .single();
  if (created.error) throw created.error;
  return created.data as { id: string; current_version: number };
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

/**
 * Sonda o banco até `predicate` retornar true ou esgotar o timeout.
 * Necessário porque a mutação server-side é disparada de forma assíncrona pela
 * UI (camada offline-first), e a leitura concorrente do agente pode anteceder o
 * commit da transação vista pelo pooler de conexões.
 */
async function pollUntil<T>(
  description: string,
  fn: () => Promise<{ value: T; done: boolean }>,
  timeoutMs = 10000,
  stepMs = 250,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await fn();
    lastValue = value;
    if (done) return value;
    if (Date.now() > deadline) {
      throw new Error(`pollUntil("${description}") timeout. Last value: ${JSON.stringify(lastValue)}`);
    }
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

test.describe('Status terminal "Veículo retirado" — transição automática via checklist', () => {
  // Contexto novo por execução garante IndexedDB/localStorage limpos entre runs,
  // evitando que operações offline enfileiradas em sessões anteriores interfiram
  // na lógica de auto-retirada (arquitetura offline-first).
  test('Concluir checklist "Saída de Oficina" transiciona a OS correspondente para "Veículo retirado"', async ({ browser }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const clientId = manager.client_id;
    const userId = manager.id;
    const workshop = await getWorkshop(supabase, clientId);
    if (!workshop) throw new Error('Cliente de teste sem oficina ativa');
    const template = await getOrCreateExitTemplate(supabase, clientId, userId);

    const suffix = String(Date.now()).slice(-6);
    const plate = `AR${suffix}`;

    const vehicle = await supabase.from('vehicles').insert({
      client_id: clientId,
      license_plate: plate,
      brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
      renavam: `7${suffix}12345`, chassi: `CHAR${suffix}00000000`, detran_uf: 'SP',
      type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
      acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '12345',
      owner: 'BetaFleet', autonomy: 10, category: 'Leve', initial_km: 1000,
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    const vehicleId = vehicle.data.id;

    const today = new Date();
    const entryDate = new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0];
    const expectedExit = new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0];

    // OS em "Concluído" para o mesmo veículo + oficina
    const os = await supabase.from('maintenance_orders').insert({
      client_id: clientId,
      vehicle_id: vehicleId,
      workshop_id: workshop.id,
      os_number: `OS-AR-${suffix}`,
      entry_date: entryDate,
      expected_exit_date: expectedExit,
      type: 'Corretiva',
      status: 'Concluído',
      estimated_cost: 0,
      created_by_id: userId,
    }).select('id').single();
    if (os.error) throw os.error;
    const osId = os.data.id;

    // Checklist "em andamento" já com oficina confirmada e hodômetro preenchido,
    // de forma que a página de preenchimento habilite "Finalizar Checklist".
    const checklist = await supabase.from('checklists').insert({
      client_id: clientId,
      template_id: template.id,
      version_number: template.current_version,
      vehicle_id: vehicleId,
      filled_by: userId,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      workshop_id: workshop.id,
      odometer_km: 5000,
    }).select('id').single();
    if (checklist.error) throw checklist.error;
    const checklistId = checklist.data.id;

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      await login(page, process.env.TEST_MANAGER_EMAIL!, process.env.TEST_MANAGER_PASSWORD!);

      await page.goto(`/checklists/preencher/${checklistId}`);
      // Aguarda a página de preenchimento carregar
      await expect(page.getByRole('button', { name: /Finalizar Checklist/ })).toBeVisible({ timeout: 15000 });

      // Finaliza o checklist (sem itens obrigatórios → botão habilitado)
      await page.getByRole('button', { name: /Finalizar Checklist/ }).click();

      // Aguarda redirecionamento para a lista de checklists
      await expect(page).toHaveURL(/\/checklists/, { timeout: 15000 });

      // Sonda a OS até transicionar para "Veículo retirado" (mutação server-side
      // disparada de forma assíncrona pela UI).
      const osFinal = await pollUntil(
        'OS transiciona para Veículo retirado',
        async () => {
          const r = await supabase.from('maintenance_orders')
            .select('status, actual_exit_date')
            .eq('id', osId)
            .single();
          const status = r.data?.status;
          return { value: r.data, done: status === 'Veículo retirado' };
        },
      );
      expect(osFinal.status).toBe('Veículo retirado');
      expect(osFinal.actual_exit_date).not.toBeNull();

      // Sonda o checklist até estar concluído.
      const chkFinal = await pollUntil(
        'checklist concluído',
        async () => {
          const r = await supabase.from('checklists').select('status').eq('id', checklistId).single();
          const status = r.data?.status;
          return { value: r.data, done: status === 'completed' };
        },
      );
      expect(chkFinal.status).toBe('completed');
    } finally {
      await context.close();
      await supabase.from('checklists').delete().eq('id', checklistId);
      await supabase.from('maintenance_orders').delete().eq('id', osId);
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    }
  });
});