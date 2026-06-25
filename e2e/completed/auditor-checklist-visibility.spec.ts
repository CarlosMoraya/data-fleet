import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

/**
 * Teste E2E funcional: validação de fluxo Auditor (Yard Auditor).
 *
 * Cobertura:
 *  1. Auditor faz login e navega para /checklists
 *  2. Seleciona um veículo (categoria Leve)
 *  3. Verifica que templates com contexto "Auditoria" aparecem em "Iniciar Auditoria"
 *  4. Clica em "Iniciar" → checklist é criado com sucesso (navega para preencher/{id})
 *  5. Confirma que o checklist aparece no histórico ao voltar para /checklists
 *
 * Este teste valida indiretamente a RLS policy checklist_templates_select —
 * se o SELECT falhar por RLS, a lista de templates fica vazia e o teste falha.
 */

type SeedData = {
  auditorUserId: string;
  auditorEmail: string;
  auditorPassword: string;
  vehicleId: string;
  vehiclePlate: string;
  templateId: string;
  templateName: string;
  createdTemplate: boolean;
};

// Cliente oficial de demo no Dev (criado por scripts/seed-betafleet-demo.mjs).
// Descoberto dinamicamente pelo nome para evitar hardcode frágil de UUID.
const DEMO_CLIENT_NAME = 'BetaFleet Demo';
const AUDITOR_CATEGORY = 'Leve';

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function seedAuditorChecklistVisibility(supabase: SupabaseClient, clientId: string): Promise<SeedData> {
  const stamp = Date.now();
  const auditorEmail = `auditor-vis-${stamp}@test.datafleet.local`;
  const auditorPassword = `BetaTest${stamp}A!`;

  const auditorAuth = await supabase.auth.admin.createUser({
    email: auditorEmail,
    password: auditorPassword,
    email_confirm: true,
  });
  if (auditorAuth.error || !auditorAuth.data.user?.id) {
    throw auditorAuth.error ?? new Error('auditor auth user sem id');
  }
  const auditorUserId = auditorAuth.data.user.id;

  const profileInsert = await supabase.from('profiles').upsert([
    { id: auditorUserId, name: `Auditor Vis ${stamp}`, role: 'Yard Auditor', client_id: clientId },
  ]);
  if (profileInsert.error) throw profileInsert.error;

  const vehiclePlate = `V${stamp.toString().slice(-6)}`;
  const vehicle = await supabase
    .from('vehicles')
    .insert({
      client_id: clientId,
      license_plate: vehiclePlate,
      renavam: stamp.toString().slice(-11).padStart(11, '0'),
      chassi: `9BWZZZ377VT${stamp.toString().slice(-5).padStart(5, '0')}`,
      detran_uf: 'SP',
      category: AUDITOR_CATEGORY,
      type: 'Truck',
      brand: 'Test',
      model: 'Auditor Vis',
      year: 2024,
      color: 'White',
      energy_source: 'Combustão',
      acquisition: 'Owned',
      owner: 'Deluna Transportes',
      driver_id: null,
    })
    .select('id')
    .single();
  if (vehicle.error || !vehicle.data?.id) throw vehicle.error ?? new Error('vehicle sem id');

  // Reaproveita template existente (se houver) para evitar violação do exclusion constraint
  // unique_published_category_context — mesmo padrão do driver-checklist-visibility.spec.ts.
  const existingTemplate = await supabase
    .from('checklist_templates')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('vehicle_category', AUDITOR_CATEGORY)
    .eq('context', 'Auditoria')
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();
  if (existingTemplate.error) throw existingTemplate.error;

  let templateId: string | null = existingTemplate.data?.id ?? null;
  let templateName: string;
  let createdTemplate = false;

  if (templateId) {
    templateName = existingTemplate.data!.name;
  } else {
    templateName = `Template Auditoria Vis ${stamp}`;
    const template = await supabase
      .from('checklist_templates')
      .insert({
        id: randomUUID(),
        client_id: clientId,
      name: templateName,
      vehicle_category: AUDITOR_CATEGORY,
      context: 'Auditoria',
      status: 'published',
      current_version: 1,
      created_by: auditorUserId,
    })
    .select('id')
    .single();
    if (template.error || !template.data?.id) throw template.error ?? new Error('template sem id');
    templateId = template.data.id;
    createdTemplate = true;
  }

  return {
    auditorUserId,
    auditorEmail,
    auditorPassword,
    vehicleId: vehicle.data.id,
    vehiclePlate,
    templateId,
    templateName,
    createdTemplate,
  };
} // fecha seedAuditorChecklistVisibility

async function cleanupSeed(supabase: SupabaseClient, data: SeedData | null): Promise<void> {
  if (!data) return;
  // Remove qualquer checklist criado pelo auditor no fluxo (defensivo: id do URL pode não ter sido capturado)
  await supabase
    .from('checklists')
    .delete()
    .eq('template_id', data.templateId)
    .eq('filled_by', data.auditorUserId);
  // Só deleta o template se foi criado por esta execução (reaproveitamento evita quebrar outras run)
  if (data.createdTemplate) {
    await supabase.from('checklist_templates').delete().eq('id', data.templateId);
  }
  await supabase.from('vehicles').delete().eq('id', data.vehicleId);
  await supabase.from('profiles').delete().eq('id', data.auditorUserId);
  await supabase.auth.admin.deleteUser(data.auditorUserId);
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/checklists/, { timeout: 15000 });
}

test.describe.serial('Auditor checklist visibility', () => {
  let supabase: SupabaseClient;
  let seed: SeedData | null = null;

  test.beforeAll(async () => {
    supabase = getAdminClient();
    // Descobre o client_id de "BetaFleet Demo" dinamicamente (instrução do usuário).
    const { data: demoClient, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', DEMO_CLIENT_NAME)
      .limit(1)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!demoClient) {
      throw new Error(`Cliente "${DEMO_CLIENT_NAME}" não encontrado no Dev. Rode scripts/seed-betafleet-demo.mjs antes do teste.`);
    }
    seed = await seedAuditorChecklistVisibility(supabase, demoClient.id);
  });

  test.afterAll(async () => {
    await cleanupSeed(supabase, seed);
  });

  test('Auditor vê templates de Auditoria publicados e inicia checklist', async ({ page }) => {
    if (!seed) throw new Error('seed ausente');
    // 1. Login e redirect para /checklists
    await login(page, seed.auditorEmail, seed.auditorPassword);
    await expect(page).toHaveURL(/\/checklists/, { timeout: 15000 });

    // 2. Selecionar veículo (categoria Leve) no dropdown "Iniciar Auditoria"
    const vehicleSelect = page.locator('select', { has: page.getByText('— Selecione um veículo —') });
    await vehicleSelect.waitFor({ state: 'visible', timeout: 10000 });
    const optionLabel = `${seed.vehiclePlate} (${AUDITOR_CATEGORY})`;
    await vehicleSelect.selectOption({ label: optionLabel });

    // 3. Verifica que o template com contexto "Auditoria" aparece (RLS SELECT funcionando)
    await expect(page.getByText(seed.templateName, { exact: true })).toBeVisible({ timeout: 15000 });
    // Garante que a mensagem de "Nenhum template" não aparece
    await expect(page.getByText(/Nenhum template de Auditoria publicado/)).not.toBeVisible();

    // 4. Clica em "Iniciar" → checklist criado e navega para preencher/{id}
    const startButton = page.getByRole('button', { name: /^Iniciar$/ });
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();
    await expect(page).toHaveURL(/\/checklists\/preencher\//, { timeout: 15000 });

    // 5. Volta para /checklists e confirma que o checklist aparece no histórico
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/checklists/, { timeout: 15000 });
    // Banner de checklist em andamento ou linha do histórico exibem o template
    await expect(page.getByText(seed.templateName, { exact: true })).toBeVisible({ timeout: 15000 });
  });
});