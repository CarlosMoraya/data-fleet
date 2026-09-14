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

test.describe.serial('Plano de Ação — Yard Auditor responsável', () => {
  let auditor: { id: string; client_id: string; role: string };
  let coordinator: { id: string; client_id: string; role: string };
  let suffix = '';
  let skipReason = '';
  let mineId = '';
  let coordinatorPlanId = '';
  let unassignedId = '';
  let auditorClient: Awaited<ReturnType<typeof signIn>> | null = null;
  let coordinatorClient: Awaited<ReturnType<typeof signIn>> | null = null;

  async function readPlan(id: string) {
    const { data, error } = await adminClient()
      .from('action_plans')
      .select('status, claimed_by, due_date, responsible_id, completion_notes, conclusion_evidence_url')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as {
      status: string;
      claimed_by: string | null;
      due_date: string | null;
      responsible_id: string | null;
      completion_notes: string | null;
      conclusion_evidence_url: string | null;
    };
  }

  test.beforeAll(async () => {
    auditor = await profileByEmail(getEnv('TEST_AUDITOR_EMAIL'));
    coordinator = await profileByEmail(getEnv('TEST_COORDINATOR_EMAIL'));

    if (coordinator.client_id !== auditor.client_id) {
      skipReason = 'Coordenador e Auditor de teste em tenants diferentes.';
      return;
    }

    const ticket = await adminClient()
      .from('fleet_tickets')
      .select('id')
      .eq('client_id', auditor.client_id)
      .limit(1)
      .maybeSingle();
    if (ticket.error) throw ticket.error;
    if (!ticket.data) {
      skipReason = 'Sem chamado no tenant do Auditor de teste.';
      return;
    }

    suffix = String(Date.now()).slice(-6);

    const inserted = await adminClient()
      .from('action_plans')
      .insert([
        {
          client_id: auditor.client_id,
          fleet_ticket_id: (ticket.data as { id: string }).id,
          status: 'pending',
          assigned_by: coordinator.id,
          reported_by: coordinator.id,
          name: `E2E Auditor Meu ${suffix}`,
          suggested_action: 'E2E — verificar freio',
          responsible_id: auditor.id,
        },
        {
          client_id: auditor.client_id,
          fleet_ticket_id: (ticket.data as { id: string }).id,
          status: 'pending',
          assigned_by: coordinator.id,
          reported_by: coordinator.id,
          name: `E2E Auditor Coordenador ${suffix}`,
          suggested_action: 'E2E — verificar suspensão',
          responsible_id: coordinator.id,
        },
        {
          client_id: auditor.client_id,
          fleet_ticket_id: (ticket.data as { id: string }).id,
          status: 'pending',
          assigned_by: coordinator.id,
          reported_by: coordinator.id,
          name: `E2E Auditor Sem Responsavel ${suffix}`,
          suggested_action: 'E2E — verificar luzes',
          responsible_id: null,
        },
      ])
      .select('id, name');
    if (inserted.error) throw inserted.error;
    const rows = inserted.data as Array<{ id: string; name: string }>;
    mineId = rows.find((r) => r.name === `E2E Auditor Meu ${suffix}`)?.id ?? '';
    coordinatorPlanId = rows.find((r) => r.name === `E2E Auditor Coordenador ${suffix}`)?.id ?? '';
    unassignedId = rows.find((r) => r.name === `E2E Auditor Sem Responsavel ${suffix}`)?.id ?? '';

    auditorClient = await signIn('TEST_AUDITOR_EMAIL', 'TEST_AUDITOR_PASSWORD');
    coordinatorClient = await signIn('TEST_COORDINATOR_EMAIL', 'TEST_COORDINATOR_PASSWORD');
  });

  test.afterAll(async () => {
    try {
      await adminClient()
        .storage.from('vehicle-documents')
        .remove([`${auditor.client_id}/action-plans/${mineId}/evidence.pdf`]);
    } catch {
      // Ignorar erro só da remoção do arquivo.
    }
    await adminClient()
      .from('action_plans')
      .delete()
      .in('id', [mineId, coordinatorPlanId, unassignedId]);
  });

  test('01 — menu e lista mostram só o plano do Auditor', async ({ page }) => {
    test.skip(!!skipReason, skipReason);
    await page.goto('/acoes');
    await expect(page.getByRole('link', { name: 'Plano de Ação' })).toBeVisible();
    await expect(page.getByText(`E2E Auditor Meu ${suffix}`)).toBeVisible();
    await expect(page.getByText(`E2E Auditor Coordenador ${suffix}`)).toHaveCount(0);
    await expect(page.getByText(`E2E Auditor Sem Responsavel ${suffix}`)).toHaveCount(0);
  });

  test('02 — API não entrega planos de outros', async () => {
    test.skip(!!skipReason, skipReason);
    if (!auditorClient) throw new Error('auditorClient not initialized');
    const { data, error } = await auditorClient
      .from('action_plans')
      .select('id')
      .in('id', [coordinatorPlanId, unassignedId]);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test('03 — API recusa coluna fora da lista', async () => {
    test.skip(!!skipReason, skipReason);
    if (!auditorClient) throw new Error('auditorClient not initialized');
    const { error } = await auditorClient
      .from('action_plans')
      .update({ due_date: '2030-01-01' })
      .eq('id', mineId);
    expect(error?.message).toContain('YARD_AUDITOR_FIELD_NOT_ALLOWED');
    expect((await readPlan(mineId)).due_date).toBeNull();
  });

  test('04 — API recusa concluir direto', async () => {
    test.skip(!!skipReason, skipReason);
    if (!auditorClient) throw new Error('auditorClient not initialized');
    const { error } = await auditorClient
      .from('action_plans')
      .update({
        status: 'completed',
        completed_by: auditor.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', mineId);
    expect(error).not.toBeNull();
    expect((await readPlan(mineId)).status).toBe('pending');
  });

  test('05 — Auditor assume pela tela', async ({ page }) => {
    test.skip(!!skipReason, skipReason);
    await page.goto('/acoes');
    await page.getByText(`E2E Auditor Meu ${suffix}`).click();
    await page.getByRole('button', { name: 'Assumir esta ação' }).click();
    await expect.poll(async () => (await readPlan(mineId)).status).toBe('in_progress');
    expect((await readPlan(mineId)).claimed_by).toBe(auditor.id);
  });

  test('06 — Auditor envia para aprovação com notas e evidência', async ({ page }) => {
    test.skip(!!skipReason, skipReason);
    await page.goto('/acoes');
    await page.getByRole('button', { name: /^Em Andamento/ }).click();
    await page.getByText(`E2E Auditor Meu ${suffix}`).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'evidencia.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
    });
    await page.getByPlaceholder('Descreva o que foi feito...').fill(`Concluído pelo auditor E2E ${suffix}`);
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click();
    await expect.poll(async () => (await readPlan(mineId)).status).toBe('awaiting_conclusion');
    expect((await readPlan(mineId)).completion_notes).toBe(`Concluído pelo auditor E2E ${suffix}`);
    expect((await readPlan(mineId)).conclusion_evidence_url).toBe(
      `${auditor.client_id}/action-plans/${mineId}/evidence.pdf`,
    );
  });

  test('07 — Auditor não vê aprovar nem reatribuir', async ({ page }) => {
    test.skip(!!skipReason, skipReason);
    await page.goto('/acoes');
    await page.getByRole('button', { name: /^Ag\. Aprovação/ }).click();
    await page.getByText(`E2E Auditor Meu ${suffix}`).click();
    await expect(page.getByText('Conclusão enviada — aguardando aprovação')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar conclusão' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Alterar responsável' })).toHaveCount(0);
  });

  test('08 — Coordenador aprova (controle negativo: caminho do gestor intacto)', async () => {
    test.skip(!!skipReason, skipReason);
    if (!coordinatorClient) throw new Error('coordinatorClient not initialized');
    const { error } = await coordinatorClient
      .from('action_plans')
      .update({
        status: 'completed',
        completed_by: coordinator.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', mineId);
    expect(error).toBeNull();
    expect((await readPlan(mineId)).status).toBe('completed');
  });

  test('09 — API recusa mexer em plano concluído', async () => {
    test.skip(!!skipReason, skipReason);
    if (!auditorClient) throw new Error('auditorClient not initialized');
    const { error } = await auditorClient
      .from('action_plans')
      .update({ completion_notes: 'alterado' })
      .eq('id', mineId);
    expect(error?.message).toContain('YARD_AUDITOR_TRANSITION_NOT_ALLOWED');
    expect((await readPlan(mineId)).completion_notes).toBe(`Concluído pelo auditor E2E ${suffix}`);
  });

  test('10 — reatribuir para o Auditor libera a visão', async () => {
    test.skip(!!skipReason, skipReason);
    if (!coordinatorClient) throw new Error('coordinatorClient not initialized');
    if (!auditorClient) throw new Error('auditorClient not initialized');
    const { error } = await coordinatorClient.rpc('reassign_action_plan_responsible', {
      p_action_plan_id: coordinatorPlanId,
      p_responsible_id: auditor.id,
    });
    expect(error).toBeNull();
    const { data, error: selectError } = await auditorClient
      .from('action_plans')
      .select('id')
      .eq('id', coordinatorPlanId);
    expect(selectError).toBeNull();
    expect(data).toHaveLength(1);
  });

  test('11 — função de nomes devolve nomes só dos planos dele', async () => {
    test.skip(!!skipReason, skipReason);
    if (!auditorClient) throw new Error('auditorClient not initialized');
    const { data, error } = await auditorClient.rpc('get_yard_auditor_action_plan_labels', {
      p_action_plan_ids: [coordinatorPlanId, unassignedId],
    });
    expect(error).toBeNull();
    const rows = data as Array<{ action_plan_id: string; assigned_by_name: string | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].action_plan_id).toBe(coordinatorPlanId);
    expect(rows[0].assigned_by_name).not.toBeNull();
  });
});
