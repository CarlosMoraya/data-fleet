import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function adminClient() {
  return createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

function anonClient() {
  return createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_ANON_KEY'));
}

async function signIn(emailEnv: string, passwordEnv: string) {
  const supabase = anonClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: getEnv(emailEnv),
    password: getEnv(passwordEnv),
  });
  if (error) throw error;
  return supabase;
}

async function profileByEmail(email: string) {
  const users = await adminClient().auth.admin.listUsers();
  if (users.error) throw users.error;
  const profileId = users.data.users.find((user) => user.email === email)?.id;
  if (!profileId) throw new Error(`Auth user not found for ${email}`);

  const { data, error } = await adminClient()
    .from('profiles')
    .select('id, client_id, role')
    .eq('id', profileId)
    .single();
  if (error) throw error;
  return data as { id: string; client_id: string; role: string };
}

async function createChecklistSource(profile: { id: string; client_id: string }) {
  const supabase = adminClient();
  const template = await supabase
    .from('checklist_templates')
    .select('id, current_version')
    .eq('client_id', profile.client_id)
    .eq('status', 'published')
    .limit(1)
    .single();
  if (template.error) throw template.error;

  const suffix = String(Date.now()).slice(-6);
  const vehicle = await supabase.from('vehicles').insert({
    client_id: profile.client_id,
    license_plate: `RL${suffix}`,
    brand: 'Fiat',
    model: 'Mobi',
    year: 2024,
    color: 'Branco',
    renavam: `8${suffix}12345`,
    chassi: `CHSRL${suffix}00000000`,
    detran_uf: 'SP',
    type: 'Passeio',
    energy_source: 'Combustão',
    cooling_equipment: false,
    acquisition: 'Owned',
    fipe_price: 100000,
    tracker: 'Teste',
    antt: '123456',
    owner: 'E2E',
    autonomy: 500,
    category: 'Leve',
  }).select('id').single();
  if (vehicle.error) throw vehicle.error;

  const checklist = await supabase.from('checklists').insert({
    client_id: profile.client_id,
    template_id: template.data.id,
    version_number: template.data.current_version,
    vehicle_id: vehicle.data.id,
    filled_by: profile.id,
    started_at: '2026-06-22T08:00:00Z',
    completed_at: '2026-06-22T09:00:00Z',
    status: 'completed',
    odometer_km: 100000,
  }).select('id').single();
  if (checklist.error) throw checklist.error;

  return {
    clientId: profile.client_id,
    vehicleId: vehicle.data.id as string,
    checklistId: checklist.data.id as string,
    originalKm: 100000,
  };
}

test.describe('Odometer correction RLS', () => {
  test('Fleet Assistant nao insere correcao direta e Manager insere', async () => {
    const managerProfile = await profileByEmail(getEnv('TEST_MANAGER_EMAIL'));
    const assistantProfile = await profileByEmail(getEnv('TEST_ASSISTANT_EMAIL'));
    const source = await createChecklistSource(managerProfile);

    const assistant = await signIn('TEST_ASSISTANT_EMAIL', 'TEST_ASSISTANT_PASSWORD');
    const denied = await assistant.from('vehicle_odometer_corrections').insert({
      client_id: source.clientId,
      vehicle_id: source.vehicleId,
      checklist_id: source.checklistId,
      original_km: source.originalKm,
      corrected_km: 10000,
      reason: 'Tentativa sem permissao',
      corrected_by: assistantProfile.id,
    });
    expect(denied.error).toBeTruthy();

    const manager = await signIn('TEST_MANAGER_EMAIL', 'TEST_MANAGER_PASSWORD');
    const accepted = await manager.from('vehicle_odometer_corrections').insert({
      client_id: source.clientId,
      vehicle_id: source.vehicleId,
      checklist_id: source.checklistId,
      original_km: source.originalKm,
      corrected_km: 10000,
      reason: 'Erro de digitação no checklist',
      corrected_by: managerProfile.id,
    });
    expect(accepted.error).toBeNull();
  });
});
