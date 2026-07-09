import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
// RLS cross-tenant — payment_installments (Módulo Financeiro)
// IMPLEMENTATION.md — Etapa 10 (opcional), padrão replicado de
// e2e/completed/rls-cross-tenant.spec.ts.
//
// PRÉ-CONDIÇÃO: exige >= 2 clients no banco de DEV (mesma condição do spec de
// veículos) e uma OS com budget_status='aprovado' no tenant B para criar a
// parcela-isca. Pula com test.skip se a massa não estiver disponível.
// ══════════════════════════════════════════════════════════════════════════════

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

async function createProbeInstallment(clientId: string): Promise<{ osId: string; vehicleId: string; installmentId: string }> {
  const supabase = adminClient();
  const suffix = String(Date.now()).slice(-6);

  const vehicle = await supabase.from('vehicles').insert({
    client_id: clientId,
    license_plate: `RLFI${suffix}`,
    brand: 'Fiat', model: 'Mobi', year: 2024, color: 'Branco',
    renavam: `6${suffix}12345`, chassi: `CHRLFI${suffix}000000`, detran_uf: 'SP',
    type: 'Passeio', energy_source: 'Combustão', cooling_equipment: false,
    acquisition: 'Owned', fipe_price: 100000, tracker: 'Teste', antt: '123456',
    owner: 'E2E', autonomy: 500, category: 'Leve',
  }).select('id').single();
  if (vehicle.error) throw vehicle.error;

  const os = await supabase.from('maintenance_orders').insert({
    client_id: clientId,
    vehicle_id: vehicle.data.id,
    os_number: `OS-RLFI-${suffix}`,
    entry_date: new Date().toISOString().split('T')[0],
    type: 'Corretiva',
    status: 'Concluído',
    estimated_cost: 1000,
    approved_cost: 1000,
    budget_status: 'aprovado',
  }).select('id').single();
  if (os.error) throw os.error;

  const installment = await supabase.from('payment_installments').insert({
    maintenance_order_id: os.data.id,
    client_id: clientId,
    installment_number: 1,
    installments_total: 1,
    value: 1000,
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    payment_method: 'boleto',
  }).select('id').single();
  if (installment.error) throw installment.error;

  return { osId: os.data.id as string, vehicleId: vehicle.data.id as string, installmentId: installment.data.id as string };
}

let tenantA = '';
let tenantB = '';
let probeOsId = '';
let probeVehicleId = '';
let probeInstallmentId = '';
let userAClient: ReturnType<typeof anonClient> | null = null;

test.describe.serial('RLS cross-tenant — payment_installments', () => {
  test.afterAll(async () => {
    if (probeInstallmentId) await adminClient().from('payment_installments').delete().eq('id', probeInstallmentId);
    if (probeOsId) await adminClient().from('maintenance_orders').delete().eq('id', probeOsId);
    if (probeVehicleId) await adminClient().from('vehicles').delete().eq('id', probeVehicleId);
  });

  test.beforeAll(async () => {
    const assistantProfile = await profileByEmail(getEnv('TEST_ASSISTANT_EMAIL'));
    tenantA = assistantProfile.client_id;

    const other = await adminClient()
      .from('clients')
      .select('id, name')
      .neq('id', tenantA)
      .limit(1)
      .maybeSingle();

    if (other.error || !other.data) {
      tenantB = '';
      return;
    }

    tenantB = other.data.id as string;
    const probe = await createProbeInstallment(tenantB);
    probeOsId = probe.osId;
    probeVehicleId = probe.vehicleId;
    probeInstallmentId = probe.installmentId;

    userAClient = await signIn('TEST_ASSISTANT_EMAIL', 'TEST_ASSISTANT_PASSWORD');
  });

  test('01 — SELECT cross-tenant em payment_installments retorna vazio', async () => {
    if (!tenantB || !userAClient) {
      test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients.');
      return;
    }
    const res = await userAClient.from('payment_installments').select('id').eq('id', probeInstallmentId);
    expect(res.data?.length ?? 0).toBe(0);
  });

  test('02 — INSERT em tenant alheio é bloqueado', async () => {
    if (!tenantB || !userAClient) {
      test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients.');
      return;
    }
    const res = await userAClient.from('payment_installments').insert({
      maintenance_order_id: probeOsId,
      client_id: tenantB,
      installment_number: 2,
      installments_total: 1,
      value: 500,
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      payment_method: 'boleto',
    });
    expect(res.error).toBeTruthy();
  });

  test('03 — UPDATE em registro de tenant alheio não afeta linhas', async () => {
    if (!tenantB || !userAClient) {
      test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients.');
      return;
    }
    const res = await userAClient
      .from('payment_installments')
      .update({ value: 9999 })
      .eq('id', probeInstallmentId)
      .select();
    expect(res.data?.length ?? 0).toBe(0);
  });

  test('04 — DELETE em registro de tenant alheio não afeta linhas', async () => {
    if (!tenantB || !userAClient) {
      test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients.');
      return;
    }
    const res = await userAClient
      .from('payment_installments')
      .delete()
      .eq('id', probeInstallmentId)
      .select();
    expect(res.data?.length ?? 0).toBe(0);
  });
});
