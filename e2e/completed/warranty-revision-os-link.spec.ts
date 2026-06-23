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
  const { data, error } = await supabase.from('workshops').select('id, name').eq('client_id', clientId).eq('active', true).limit(1).maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string } | null;
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

test.describe('Revisões de Garantia — vínculo de OS', () => {
  test('OS Preventiva vinculada, ao concluir, marca o evento como completed', async ({ page }) => {
    const supabase = adminClient();
    const manager = await getManager(supabase);
    const clientId = manager.client_id;
    const userId = manager.id;
    const suffix = String(Date.now()).slice(-6);
    const plate = `OL${suffix}`;

    // 1. Veículo em garantia
    const vehicle = await supabase.from('vehicles').insert({
      client_id: clientId,
      license_plate: plate,
      brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
      renavam: `7${suffix}12345`, chassi: `CHSOL${suffix}00000000`, detran_uf: 'SP',
      type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
      acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '12345',
      owner: 'BetaFleet', autonomy: 10, warranty: true, warranty_end_date: '2027-01-01',
    }).select('id').single();
    if (vehicle.error) throw vehicle.error;
    const vehicleId = vehicle.data.id;

    // 2. Plano adhoc + item + assignment + evento pending (via DB)
    const workshop = await getWorkshop(supabase, clientId);
    if (!workshop) throw new Error('Cliente de teste sem oficina ativa');

    const plan = await supabase.from('warranty_revision_plans').insert({
      client_id: clientId, name: `E2E OS Link ${suffix}`, is_adhoc: true, active: true, created_by: userId,
    }).select('id').single();
    if (plan.error) throw plan.error;
    const planId = plan.data.id;

    const item = await supabase.from('warranty_revision_plan_items').insert({
      plan_id: planId, client_id: clientId, sequence: 1, label: '1ª revisão',
      target_km: 10000, km_tolerance: 0, days_tolerance: 0,
    }).select('id').single();
    if (item.error) throw item.error;
    const itemId = item.data.id;

    const assignment = await supabase.from('vehicle_warranty_revision_assignments').insert({
      client_id: clientId, vehicle_id: vehicleId, plan_id: planId, status: 'active',
      created_by: userId,
    }).select('id').single();
    if (assignment.error) throw assignment.error;
    const assignmentId = assignment.data.id;

    const event = await supabase.from('vehicle_warranty_revision_events').insert({
      assignment_id: assignmentId, client_id: clientId, vehicle_id: vehicleId,
      plan_item_id: itemId, sequence: 1, label: '1ª revisão', target_km: 10000,
      status: 'pending',
    }).select('id').single();
    if (event.error) throw event.error;
    const eventId = event.data.id;

    let createdOrderId: string | null = null;

    try {
      await login(page);
      await page.goto('/manutencao');

      // Abrir formulário de nova OS
      await page.getByRole('button', { name: /Nova Manutenção|Nova OS/ }).first().click();
      await expect(page.getByRole('heading', { name: /Nova Manutenção|Editar OS/ })).toBeVisible({ timeout: 10000 });

      await page.locator('#vehicleId').selectOption(vehicleId);
      await page.locator('#workshopId').selectOption(workshop.id);
      await page.locator('#type').selectOption('Preventiva');
      await page.locator('#status').selectOption('Aguardando orçamento');
      await page.locator('#entryDate').fill(new Date().toISOString().split('T')[0]);

      // O seletor de vínculo aparece e lista o evento pendente
      await expect(page.locator('#warrantyRevisionEventId option', { hasText: '1ª revisão' })).toBeVisible({ timeout: 10000 });
      await page.locator('#warrantyRevisionEventId').selectOption(eventId);

      await page.getByRole('button', { name: 'Criar Manutenção' }).click();

      // OS criada e vinculada:
      const os = await supabase.from('maintenance_orders')
        .select('id, warranty_revision_event_id, status')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1).single();
      expect(os.data?.warranty_revision_event_id).toBe(eventId);
      createdOrderId = os.data!.id;

      // Concluir a OS via trigger (UPDATE status -> Concluído dispara o trigger)
      const upd = await supabase.from('maintenance_orders').update({
        status: 'Concluído',
        actual_exit_date: new Date().toISOString(),
      }).eq('id', createdOrderId);
      if (upd.error) throw upd.error;

      // Assertar que o evento ficou completed
      const evAfter = await supabase.from('vehicle_warranty_revision_events')
        .select('status, maintenance_order_id, executed_km')
        .eq('id', eventId).single();
      expect(evAfter.data?.status).toBe('completed');
      expect(evAfter.data?.maintenance_order_id).toBe(createdOrderId);
    } finally {
      if (createdOrderId) {
        await supabase.from('maintenance_orders').update({ warranty_revision_event_id: null }).eq('id', createdOrderId);
        await supabase.from('maintenance_orders').delete().eq('id', createdOrderId);
      }
      await supabase.from('vehicle_warranty_revision_events').delete().eq('id', eventId);
      await supabase.from('vehicle_warranty_revision_assignments').delete().eq('id', assignmentId);
      await supabase.from('warranty_revision_plan_items').delete().eq('id', itemId);
      await supabase.from('warranty_revision_plans').delete().eq('id', planId);
      await supabase.from('vehicles').delete().eq('id', vehicleId);
    }
  });
});