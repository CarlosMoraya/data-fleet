import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
// RLS INSERT — payment_installments: status escalado e auditoria carimbada
// Acompanha a migration 20260912000000_harden_payment_installment_insert.sql.
//
// A policy payment_installments_insert deve recusar (42501) a criação de
// parcela com status escalado ('aprovado', 'pago', ...) ou com campos de
// auditoria carimbados (ex.: payment_approved_by), quando quem chama é um
// usuário autenticado real (não service_role). A parcela legítima
// ('pendente_aprovacao', sem auditoria) continua sendo criada — é o controle
// negativo que impede uma policy quebrada que recusasse tudo de passar.
//
// Padrão replicado de e2e/pending/financeiro-rls-cross-tenant.spec.ts.
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
  const users = await adminClient().auth.admin.listUsers({ perPage: 1000 });
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

let assistantId = '';
let clientId = '';
let orderId = '';
let vehicleId = '';
let controleNegativoId = '';
let userClient: ReturnType<typeof anonClient> | null = null;

const SKIP_SEM_OFICINA =
  'Sem oficina ativa no tenant do usuário de teste — impossível criar a OS da massa.';

function massaPronta(): boolean {
  return Boolean(userClient && clientId && orderId && assistantId);
}

test.describe.serial('RLS INSERT — payment_installments recusa status escalado e auditoria carimbada', () => {
  test.beforeAll(async () => {
    const profile = await profileByEmail(getEnv('TEST_ASSISTANT_EMAIL'));
    assistantId = profile.id;
    clientId = profile.client_id;

    // Oficina ativa do mesmo tenant para a OS da massa.
    const workshop = await adminClient()
      .from('workshops')
      .select('id')
      .eq('client_id', clientId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (workshop.error) throw workshop.error;
    if (!workshop.data) return;
    const workshopId = (workshop.data as { id: string }).id;

    const admin = adminClient();
    const suffix = String(Date.now()).slice(-6);

    const vehicle = await admin
      .from('vehicles')
      .insert({
        client_id: clientId,
        license_plate: `PISTAT${suffix}`,
        brand: 'Fiat',
        model: 'Mobi',
        year: 2024,
        color: 'Branco',
        renavam: `7${suffix}12345`,
        chassi: `CHPIST${suffix}000000`,
        detran_uf: 'SP',
        type: 'Passeio',
        energy_source: 'Combustão',
        acquisition: 'Owned',
        cooling_equipment: false,
      })
      .select('id')
      .single();
    if (vehicle.error) throw vehicle.error;
    vehicleId = (vehicle.data as { id: string }).id;

    // budget_status 'aprovado' e status 'Concluído' são obrigatórios: sem eles
    // outro gatilho recusaria o INSERT da parcela antes da policy e o teste
    // passaria pelo motivo errado.
    const order = await admin
      .from('maintenance_orders')
      .insert({
        client_id: clientId,
        vehicle_id: vehicleId,
        workshop_id: workshopId,
        os_number: `OS-PIST-${suffix}`,
        entry_date: new Date().toISOString().split('T')[0],
        type: 'Corretiva',
        status: 'Concluído',
        estimated_cost: 1000,
        approved_cost: 1000.0,
        budget_status: 'aprovado',
        created_by_id: assistantId,
      })
      .select('id')
      .single();
    if (order.error) throw order.error;
    orderId = (order.data as { id: string }).id;

    userClient = await signIn('TEST_ASSISTANT_EMAIL', 'TEST_ASSISTANT_PASSWORD');
  });

  test.afterAll(async () => {
    try {
      const admin = adminClient();
      if (orderId) await admin.from('payment_installments').delete().eq('maintenance_order_id', orderId);
      if (orderId) await admin.from('maintenance_orders').delete().eq('id', orderId);
      if (vehicleId) await admin.from('vehicles').delete().eq('id', vehicleId);
    } catch {
      // Limpeza tolerante: a massa pode não ter chegado a ser criada.
    }
  });

  function payloadBase() {
    return {
      maintenance_order_id: orderId,
      client_id: clientId,
      created_by_id: assistantId,
      installment_number: 1,
      installments_total: 1,
      value: 100,
      due_date: '2026-12-01',
      payment_method: 'boleto',
    };
  }

  test('recusa criar parcela já aprovada', async () => {
    if (!massaPronta() || !userClient) {
      test.skip(true, SKIP_SEM_OFICINA);
      return;
    }
    const res = await userClient.from('payment_installments').insert({
      ...payloadBase(),
      status: 'aprovado',
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.code).toBe('42501');

    // Confere por service_role que a recusa não deixou linha para trás.
    const gravadas = await adminClient()
      .from('payment_installments')
      .select('id', { count: 'exact', head: true })
      .eq('maintenance_order_id', orderId);
    expect(gravadas.error).toBeNull();
    expect(gravadas.count).toBe(0);
  });

  test('recusa criar parcela já paga', async () => {
    if (!massaPronta() || !userClient) {
      test.skip(true, SKIP_SEM_OFICINA);
      return;
    }
    const res = await userClient.from('payment_installments').insert({
      ...payloadBase(),
      status: 'pago',
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.code).toBe('42501');
  });

  test('recusa criar parcela pendente com auditoria carimbada', async () => {
    if (!massaPronta() || !userClient) {
      test.skip(true, SKIP_SEM_OFICINA);
      return;
    }
    const res = await userClient.from('payment_installments').insert({
      ...payloadBase(),
      status: 'pendente_aprovacao',
      payment_approved_by: assistantId,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.code).toBe('42501');
  });

  test('CONTROLE NEGATIVO: parcela legítima continua sendo criada', async () => {
    if (!massaPronta() || !userClient) {
      test.skip(true, SKIP_SEM_OFICINA);
      return;
    }
    const res = await userClient
      .from('payment_installments')
      .insert({
        ...payloadBase(),
        status: 'pendente_aprovacao',
      })
      .select('id, status')
      .single();
    expect(res.error).toBeNull();
    const row = res.data as { id: string; status: string };
    expect(row.status).toBe('pendente_aprovacao');
    controleNegativoId = row.id;
    expect(controleNegativoId).toBeTruthy();
  });
});
