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

test.describe('Revisões de Garantia — cadastro por placa', () => {
  test('cria plano/assignment/events e placa aparece na tabela', async ({ page }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const suffix = String(Date.now()).slice(-6);
    const plate = `WR${suffix}`;

    const vehicle = await supabase.from('vehicles').insert({
      client_id: manager.client_id,
      license_plate: plate,
      brand: 'Fiat',
      model: 'Mobi',
      year: 2024,
      color: 'Branco',
      renavam: `9${suffix}12345`,
      chassi: `CHSWR${suffix}00000000`,
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
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    const vehicleId = vehicle.data.id;

    try {
      await login(page);
      await page.goto('/revisoes-garantia');
      await expect(page.getByRole('heading', { name: 'Revisões de Garantia' })).toBeVisible({ timeout: 15000 });

      await page.getByRole('button', { name: 'Cadastrar por placa' }).click();
      await expect(page.getByRole('heading', { name: 'Cadastrar revisão por placa' })).toBeVisible();

      await page.locator('#wr_vehicle').selectOption(vehicleId);
      await page.locator('#it_label_0').fill('1ª revisão');
      await page.locator('#it_km_0').fill('10000');

      await page.getByRole('button', { name: 'Salvar programação' }).click();
      await expect(page.getByRole('heading', { name: 'Revisões de Garantia' })).toBeVisible({ timeout: 15000 });

      // A placa aparece na tabela
      await expect(page.locator('table').getByText(plate)).toBeVisible({ timeout: 15000 });

      // Validação no banco: assignment ativo + evento pendente
      const assignment = await supabase
        .from('vehicle_warranty_revision_assignments')
        .select('id, status')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .maybeSingle();
      expect(assignment.data).toBeTruthy();

      const events = await supabase
        .from('vehicle_warranty_revision_events')
        .select('id, status, target_km')
        .eq('vehicle_id', vehicleId);
      expect(events.data?.length).toBeGreaterThanOrEqual(1);
      expect(events.data?.[0].status).toBe('pending');
      expect(events.data?.[0].target_km).toBe(10000);

      // Espelho não-destrutivo
      const v = await supabase.from('vehicles').select('first_revision_max_km').eq('id', vehicleId).single();
      expect(v.data?.first_revision_max_km).toBe(10000);
    } finally {
      await supabase.from('vehicle_warranty_revision_events').delete().eq('vehicle_id', vehicleId);
      await supabase.from('vehicle_warranty_revision_assignments').delete().eq('vehicle_id', vehicleId);
      const planRows = await supabase.from('vehicle_warranty_revision_plans').select('id').eq('client_id', manager.client_id).eq('is_adhoc', true);
      if (planRows.data) {
        await supabase.from('warranty_revision_plans').delete().in('id', planRows.data.map((p) => p.id));
      }
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    }
  });
});