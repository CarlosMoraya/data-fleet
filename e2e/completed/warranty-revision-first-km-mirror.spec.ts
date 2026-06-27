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
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

test.describe('Revisões de Garantia — espelho do KM da 1ª revisão', () => {
  test('ao criar revisão por placa, first_revision_max_km reflete a 1ª etapa', async ({ page }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const suffix = String(Date.now()).slice(-6);
    const plate = `FK${suffix}`;

    const vehicle = await supabase.from('vehicles').insert({
      client_id: manager.client_id,
      license_plate: plate,
      brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
      renavam: `6${suffix}12345`, chassi: `CHSFK${suffix}00000000`, detran_uf: 'SP',
      type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
      acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '12345',
      owner: 'BetaFleet', autonomy: 10, warranty: true, warranty_end_date: '2027-01-01',
      first_revision_max_km: 5000,
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    const vehicleId = vehicle.data.id;

    try {
      // Antes: first_revision_max_km = 5000
      const before = await supabase.from('vehicles').select('first_revision_max_km').eq('id', vehicleId).single();
      expect(before.data?.first_revision_max_km).toBe(5000);

      await login(page);
      await page.goto('/revisoes-garantia');
      await page.getByRole('button', { name: 'Cadastrar por placa' }).click();
      await page.locator('#wr_vehicle').selectOption(vehicleId);
      await page.locator('#it_label_0').fill('1ª revisão');
      await page.locator('#it_km_0').fill('15000');
      await page.getByRole('button', { name: 'Salvar programação' }).click();
      await expect(page.getByRole('heading', { name: 'Revisões de Garantia' })).toBeVisible({ timeout: 15000 });

      // Depois: o espelho pode persistir alguns ciclos após o retorno para a listagem.
      await expect.poll(async () => {
        const after = await supabase.from('vehicles').select('first_revision_max_km').eq('id', vehicleId).single();
        return after.data?.first_revision_max_km ?? null;
      }, { timeout: 5000 }).toBe(15000);
    } finally {
      await supabase.from('vehicle_warranty_revision_events').delete().eq('vehicle_id', vehicleId);
      await supabase.from('vehicle_warranty_revision_assignments').delete().eq('vehicle_id', vehicleId);
      await supabase.from('warranty_revision_plans').delete().eq('client_id', manager.client_id).eq('is_adhoc', true);
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    }
  });
});
