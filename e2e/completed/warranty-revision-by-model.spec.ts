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

async function seedVehicle(supabase: ReturnType<typeof adminClient>, clientId: string, plate: string, warranty: boolean) {
  const suffix = String(Date.now()).slice(-6) + plate.slice(-2);
  const { data, error } = await supabase.from('vehicles').insert({
    client_id: clientId,
    license_plate: plate,
    brand: 'VW',
    model: 'Polo',
    year: 2024,
    color: 'Cinza',
    renavam: `8${suffix}12345`,
    chassi: `CHSWM${suffix}00000000`,
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
    warranty,
    warranty_end_date: warranty ? '2027-01-01' : null,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

test.describe('Revisões de Garantia — cadastro por modelo', () => {
  test('prévia de elegibilidade, aplicação em lote com confirmação e marcação de garantia', async ({ page }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const suffix = String(Date.now()).slice(-6);
    const plateA = `WM${suffix}`;
    const plateB = `WN${suffix}`;

    const idA = await seedVehicle(supabase, manager.client_id, plateA, true);
    const idB = await seedVehicle(supabase, manager.client_id, plateB, false);
    const createdVehicleIds = [idA, idB];

    try {
      await login(page);
      await page.goto('/revisoes-garantia');

      await page.getByRole('button', { name: 'Cadastrar por modelo' }).click();
      await expect(page.getByRole('heading', { name: 'Cadastrar revisão por modelo' })).toBeVisible();

      await page.locator('#m_brand').fill('VW');
      await page.locator('#m_model').fill('Polo');

      // Etapas
      await page.locator('#m_lbl_0').fill('1ª revisão');
      await page.locator('#m_km_0').fill('10000');

      // Prévia de elegibilidade: ambos aparecem no modal; o veículo sem garantia destaca "Sem garantia (ajuste)"
      const previewTable = page.getByRole('dialog').locator('table');
      await expect(previewTable.getByText(plateA)).toBeVisible({ timeout: 15000 });
      await expect(previewTable.getByText(plateB)).toBeVisible();
      await expect(previewTable.getByText('Sem garantia (ajuste)')).toBeVisible();

      // Selecionar todos + marcar como em garantia ao aplicar
      await page.getByLabel('Selecionar todos').check();
      await page.getByText('Marcar como em garantia ao aplicar (somente veículos sem garantia)').click();

      // Aplicar com confirmação
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: /Aplicar a 2 veículo/ }).click();

      // Após aplicar, volta para a página
      await expect(page.getByRole('heading', { name: 'Revisões de Garantia' })).toBeVisible({ timeout: 15000 });

      // Validação: ambos com assignment ativo; veículo B agora com warranty=true
      await expect.poll(async () => {
        const a = await supabase.from('vehicle_warranty_revision_assignments').select('status').eq('vehicle_id', idA).maybeSingle();
        return a.data?.status ?? null;
      }, { timeout: 5000 }).toBe('active');

      await expect.poll(async () => {
        const b = await supabase.from('vehicle_warranty_revision_assignments').select('status').eq('vehicle_id', idB).maybeSingle();
        return b.data?.status ?? null;
      }, { timeout: 5000 }).toBe('active');

      await expect.poll(async () => {
        const vB = await supabase.from('vehicles').select('warranty').eq('id', idB).single();
        return vB.data?.warranty ?? null;
      }, { timeout: 5000 }).toBe(true);

      // veículo A continua com warranty true (não foi alterado para false)
      await expect.poll(async () => {
        const vA = await supabase.from('vehicles').select('warranty').eq('id', idA).single();
        return vA.data?.warranty ?? null;
      }, { timeout: 5000 }).toBe(true);
    } finally {
      for (const vid of createdVehicleIds) {
        await supabase.from('vehicle_warranty_revision_events').delete().eq('vehicle_id', vid);
        await supabase.from('vehicle_warranty_revision_assignments').delete().eq('vehicle_id', vid);
      }
      const plans = await supabase.from('warranty_revision_plans').select('id').eq('client_id', manager.client_id).eq('is_adhoc', false).like('name', '%Polo%');
      if (plans.data) await supabase.from('warranty_revision_plans').delete().in('id', plans.data.map((p) => p.id));
      for (const vid of createdVehicleIds) {
        await supabase.from('vehicles').delete().eq('id', vid);
      }
    }
  });
});
