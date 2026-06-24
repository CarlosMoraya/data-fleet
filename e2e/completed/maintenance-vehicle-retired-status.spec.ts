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

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

test.describe('Status terminal "Veículo retirado" — transição manual', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('Clique no ícone CheckCircle2 transiciona Concluído → Veículo retirado e modal exibe Data de Saída Real', async ({ page }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const clientId = manager.client_id;
    const userId = manager.id;
    const workshop = await getWorkshop(supabase, clientId);
    if (!workshop) throw new Error('Cliente de teste sem oficina ativa');

    const suffix = String(Date.now()).slice(-6);
    const plate = `VR${suffix}`;

    const vehicle = await supabase.from('vehicles').insert({
      client_id: clientId,
      license_plate: plate,
      brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
      renavam: `7${suffix}12345`, chassi: `CHVR${suffix}00000000`, detran_uf: 'SP',
      type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
      acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '12345',
      owner: 'BetaFleet', autonomy: 10, category: 'Leve', initial_km: 1000,
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    const vehicleId = vehicle.data.id;

    const today = new Date();
    const entryDate = new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0];
    const expectedExit = new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0];

    const os = await supabase.from('maintenance_orders').insert({
      client_id: clientId,
      vehicle_id: vehicleId,
      workshop_id: workshop.id,
      os_number: `OS-VR-${suffix}`,
      entry_date: entryDate,
      expected_exit_date: expectedExit,
      type: 'Corretiva',
      status: 'Concluído',
      estimated_cost: 0,
      created_by_id: userId,
    }).select('id').single();
    if (os.error) throw os.error;
    const osId = os.data.id;

    try {
      await login(page, process.env.TEST_MANAGER_EMAIL!, process.env.TEST_MANAGER_PASSWORD!);
      await page.goto('/manutencao');
      await expect(page.locator('h1', { hasText: /Manuten/i })).toBeVisible({ timeout: 15000 });

      // Filtra pela placa do veículo para isolar a linha
      const searchInput = page.locator('input[placeholder*="Buscar"]').first();
      await searchInput.fill(plate);

      const row = page.locator('tr', { hasText: plate }).first();
      await expect(row).toBeVisible({ timeout: 10000 });

      // Ícone de CheckCircle2 visível apenas para status 'Concluído'
      const retireButton = row.locator('button[title="Retirar Veículo"]');
      await expect(retireButton).toBeVisible({ timeout: 10000 });

      // Dispara a transição manual
      await retireButton.click();

      // Badge de status atualiza para "Veículo retirado"
      await expect(row.locator('span', { hasText: 'Veículo retirado' })).toBeVisible({ timeout: 10000 });

      // Abre o modal de detalhe
      await row.locator('button[title="Visualizar"]').click();

      // Modal exibe "Data de Saída Real" com valor de data (não "—")
      const realDateLabel = page.getByText('Data de Saída Real', { exact: true });
      await expect(realDateLabel).toBeVisible({ timeout: 10000 });
      const valueSpan = realDateLabel.locator('xpath=following-sibling::span').first();
      await expect(valueSpan).not.toHaveText('—');

      // Confirma no banco que a OS está em "Veículo retirado" e data de saída real foi gravada
      const after = await supabase.from('maintenance_orders')
        .select('status, actual_exit_date')
        .eq('id', osId)
        .single();
      expect(after.data?.status).toBe('Veículo retirado');
      expect(after.data?.actual_exit_date).not.toBeNull();
    } finally {
      await supabase.from('maintenance_orders').delete().eq('id', osId);
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    }
  });
});