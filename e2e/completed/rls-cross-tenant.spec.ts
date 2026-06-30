import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════════════
// RLS cross-tenant — prova isolamento de dados entre tenants (client_id)
// Funções utilitárias replicadas de e2e/completed/odometer-correction-rls.spec.ts
// (locais ao arquivo — mesma forma, sem import cruzado entre specs).
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

async function createProbeVehicle(clientId: string): Promise<string> {
  const supabase = adminClient();
  const suffix = String(Date.now()).slice(-6);
  const { data, error } = await supabase.from('vehicles').insert({
    client_id: clientId,
    license_plate: `RLCT${suffix}`,
    brand: 'Fiat',
    model: 'Mobi',
    year: 2024,
    color: 'Branco',
    renavam: `8${suffix}12345`,
    chassi: `CHSRLCT${suffix}0000000`,
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
  if (error) throw error;
  return data.id as string;
}

// ── Relatório (padrão rec()/writeReport() — §6.3) ──────────────────────────────

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'SELECT cross-tenant retorna vazio' },
  { id: '02', name: 'INSERT em tenant alheio é bloqueado' },
  { id: '03', name: 'UPDATE em registro de tenant alheio não afeta linhas' },
  { id: '04', name: 'DELETE em registro de tenant alheio não afeta linhas' },
  { id: '05', name: 'deeplink de UI não expõe dado de outro tenant' },
];

const recorded = new Map<string, { status: '✅ PASSOU' | '❌ FALHOU'; error: string }>();

function rec(id: string) {
  return {
    pass() {
      recorded.set(id, { status: '✅ PASSOU', error: '—' });
    },
    fail(e: unknown) {
      const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e);
      if (msg.includes('Test is skipped')) throw e;
      recorded.set(id, { status: '❌ FALHOU', error: msg });
      throw e;
    },
  };
}

function writeReport() {
  const reportDir = path.join(process.cwd(), '.claude', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const rows = ALL_TESTS.map((t) => {
    const r = recorded.get(t.id);
    if (!r) return `| ${t.id} | ${t.name} | ⏭️ PULADO | — |`;
    return `| ${t.id} | ${t.name} | ${r.status} | ${r.error} |`;
  }).join('\n');

  const bugs = ALL_TESTS.filter((t) => recorded.get(t.id)?.status === '❌ FALHOU');
  const passed = [...recorded.values()].filter((r) => r.status === '✅ PASSOU').length;
  const failed = bugs.length;
  const skipped = ALL_TESTS.length - recorded.size;

  const bugsSection = bugs.length === 0
    ? '_Nenhum bug encontrado._'
    : bugs.map((t) => `- **Teste ${t.id} — ${t.name}**: ${recorded.get(t.id)!.error}`).join('\n');

  const report = [
    `# Relatório E2E — RLS cross-tenant`,
    `Data: ${date}`,
    '',
    `**Resumo:** ${passed} passaram · ${failed} falharam · ${skipped} pulados`,
    '',
    '## Resultados',
    '',
    '| # | Teste | Status | Erro |',
    '|---|-------|--------|------|',
    rows,
    '',
    '## Bugs Encontrados',
    '',
    bugsSection,
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, 'rls-cross-tenant-report.md'), report, 'utf-8');
}

// ── Estado compartilhado entre testes seriais ─────────────────────────────────

let tenantA = '';
let tenantB = '';
let vehicleBId = '';
let probePlate = '';
let userAClient: ReturnType<typeof anonClient> | null = null;

test.describe.serial('RLS cross-tenant — isolamento entre tenants', () => {
  test.afterAll(async () => {
    if (vehicleBId) {
      await adminClient().from('vehicles').delete().eq('id', vehicleBId);
    }
    writeReport();
  });

  test.beforeAll(async () => {
    // tenant A = tenant do Manager (usuário de teste TEST_MANAGER_*)
    const managerProfile = await profileByEmail(getEnv('TEST_MANAGER_EMAIL'));
    tenantA = managerProfile.client_id;

    // Descobrir um segundo tenant (B) distinto de A via service role
    const other = await adminClient()
      .from('clients')
      .select('id, name')
      .neq('id', tenantA)
      .limit(1)
      .maybeSingle();

    if (other.error || !other.data) {
      // Sinaliza skip para toda a suíte — os testes individuais checam tenantB
      tenantB = '';
      return;
    }

    tenantB = other.data.id as string;

    // Cria veículo-isca no tenant B via service role
    vehicleBId = await createProbeVehicle(tenantB);
    // Recupera a placa-isca real para asserção de UI
    const probe = await adminClient().from('vehicles').select('license_plate').eq('id', vehicleBId).single();
    if (probe.error) throw probe.error;
    probePlate = probe.data.license_plate as string;

    // Sessão do usuário do tenant A (anon key + JWT)
    userAClient = await signIn('TEST_MANAGER_EMAIL', 'TEST_MANAGER_PASSWORD');
  });

  test('01 — SELECT cross-tenant retorna vazio', async () => {
    const r = rec('01');
    try {
      if (!tenantB || !userAClient) {
        test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients. Rode scripts/seed-e2e.mjs.');
        return;
      }
      const res = await userAClient.from('vehicles').select('id').eq('id', vehicleBId);
      expect(res.data?.length ?? 0).toBe(0);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('02 — INSERT em tenant alheio é bloqueado', async () => {
    const r = rec('02');
    try {
      if (!tenantB || !userAClient) {
        test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients. Rode scripts/seed-e2e.mjs.');
        return;
      }
      const suffix = String(Date.now()).slice(-6);
      const res = await userAClient.from('vehicles').insert({
        client_id: tenantB,
        license_plate: `RLCT${suffix}`,
        brand: 'Fiat',
        model: 'Mobi',
        year: 2024,
        color: 'Branco',
        renavam: `8${suffix}12345`,
        chassi: `CHSRLCT${suffix}0000000`,
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
      });
      expect(res.error).toBeTruthy();
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('03 — UPDATE em registro de tenant alheio não afeta linhas', async () => {
    const r = rec('03');
    try {
      if (!tenantB || !userAClient) {
        test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients. Rode scripts/seed-e2e.mjs.');
        return;
      }
      const res = await userAClient
        .from('vehicles')
        .update({ color: 'Hacked' })
        .eq('id', vehicleBId)
        .select();
      expect(res.data?.length ?? 0).toBe(0);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test('04 — DELETE em registro de tenant alheio não afeta linhas', async () => {
    const r = rec('04');
    try {
      if (!tenantB || !userAClient) {
        test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients. Rode scripts/seed-e2e.mjs.');
        return;
      }
      const res = await userAClient
        .from('vehicles')
        .delete()
        .eq('id', vehicleBId)
        .select();
      expect(res.data?.length ?? 0).toBe(0);
      r.pass();
    } catch (e) {
      r.fail(e);
    }
  });

  test.describe('UI — deeplink não expõe dado de outro tenant', () => {
    test.use({ storageState: 'e2e/.auth/alexandre.json' });

    test('05 — deeplink de UI não expõe dado de outro tenant', async ({ page }) => {
      const r = rec('05');
      try {
        if (!tenantB) {
          test.skip(true, 'Apenas 1 tenant no banco de dev — cross-tenant RLS exige >=2 clients. Rode scripts/seed-e2e.mjs.');
          return;
        }
        // Não há rota de deeplink de detalhe por id de veículo; valida via listagem.
        // A placa-isca (tenant B) não deve aparecer em `main` para o Manager (tenant A).
        await page.goto('/cadastros/veiculos');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main').getByRole('heading', { name: /veículos/i })).toBeVisible({ timeout: 15000 });
        // Aguarda a tabela carregar
        await page.locator('table').waitFor({ state: 'visible', timeout: 15000 });
        // Como não há rota de detalhe por id, skiparia — mas a listagem é a proxy de exposição.
        // Se a placa-isca aparecer, é falha de segurança real.
        const plateOccurrences = await page.locator('main').getByText(probePlate, { exact: false }).count();
        expect(plateOccurrences).toBe(0);
        r.pass();
      } catch (e) {
        r.fail(e);
      }
    });
  });
});
