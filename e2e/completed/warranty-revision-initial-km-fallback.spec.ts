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

async function login(page: import('@playwright/test').Page) {
  const email = process.env.TEST_MANAGER_EMAIL!;
  const password = process.env.TEST_MANAGER_PASSWORD!;
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

function formatKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return km.toLocaleString('pt-BR');
}

test.describe('Revisões de Garantia — Km Inicial como KM ATUAL sem checklist', () => {
  test('veículo sem checklist exibe o Km Inicial como KM ATUAL (e não "—")', async ({ page }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const suffix = String(Date.now()).slice(-6);
    const plate = `ZZK${suffix}`;
    const initialKm = 999000;

    const vehicle = await supabase.from('vehicles').insert({
      client_id: manager.client_id,
      license_plate: plate,
      brand: 'Fiat',
      model: 'Mobi',
      year: 2024,
      color: 'Branco',
      renavam: `9${suffix}12345`,
      chassi: `CHSZZK${suffix}00000000`,
      detran_uf: 'SP',
      type: 'Passeio',
      energy_source: 'Combustão',
      cooling_equipment: false,
      acquisition: 'Owned',
      fipe_price: 100000,
      tracker: 'Teste',
      antt: '12345',
      owner: 'BetaFleet',
      autonomy: 10,
      warranty: true,
      warranty_end_date: '2027-01-01',
      initial_km: initialKm,
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    const vehicleId = vehicle.data.id;

    try {
      await login(page);
      await page.goto('/revisoes-garantia');
      await expect(page.getByRole('heading', { name: 'Revisões de Garantia' })).toBeVisible({ timeout: 15000 });

      // Busca pela placa do veículo de teste
      await page.getByPlaceholder('Buscar por placa, marca ou modelo').fill(plate);

      // A placa aparece na tabela
      const row = page.locator('table').locator('tr', { hasText: plate });
      await expect(row).toBeVisible({ timeout: 15000 });

      // Asserção principal: KM ATUAL = formatKm(initialKm) ("999.000")
      const expectedKm = formatKm(initialKm);
      await expect(row).toContainText(expectedKm, { timeout: 15000 });

      // Edge case negativo: a célula NÃO contém "—" para esse veículo
      const kmCell = row.locator('td').nth(4);
      await expect(kmCell).not.toHaveText('—');
    } finally {
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    }
  });
});