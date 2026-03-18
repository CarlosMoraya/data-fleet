import { test, expect, Browser, Page } from '@playwright/test';

const users = {
  coordinator: {
    email: process.env.TEST_COORDINATOR_EMAIL || 'robson@gmail.com',
    password: process.env.TEST_COORDINATOR_PASSWORD || '123456',
    name: 'Robson',
    role: 'Coordinator',
  },
  supervisor: {
    email: process.env.TEST_SUPERVISOR_EMAIL || 'pereira@gmail.com',
    password: process.env.TEST_SUPERVISOR_PASSWORD || '123456',
    name: 'Pereira',
    role: 'Supervisor',
  },
};

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  // storageState vazio garante contexto limpo, sem herdar o admin.json do projeto
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
  return page;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 1 — COORDINATOR (Robson)
// Deve espelhar todas as permissões de Manager (rank 5)
// ══════════════════════════════════════════════════════════════════════════════
test.describe.serial('Coordinator (Robson) — Auditoria de Permissões', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await loginAs(browser, users.coordinator.email, users.coordinator.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ── 1.1 Autenticação ───────────────────────────────────────────────────────
  test('1.1 Login e redirect para / (não /checklists)', async () => {
    await expect(page).toHaveURL('/');
  });

  test('1.2 Topbar exibe nome e badge Coordinator', async () => {
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/robson/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Coordinator', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  // ── 1.3 Sidebar ────────────────────────────────────────────────────────────
  test('1.3 Sidebar exibe todos os itens esperados para Coordinator', async () => {
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /cadastros/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /checklists/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /plano de ação/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /manutenção/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /templates/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /configurações/i })).toBeVisible();
  });

  test('1.4 Sidebar NÃO exibe links de Admin', async () => {
    await expect(page.getByRole('link', { name: /clientes/i })).not.toBeVisible();
    await expect(page.locator('a[href="/admin/users"]')).not.toBeVisible();
  });

  // ── 1.5 Dashboard ──────────────────────────────────────────────────────────
  test('1.5 Dashboard carrega sem redirect', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 1.6 Cadastros ──────────────────────────────────────────────────────────
  test('1.6 Cadastros/Veículos — lista carrega e botão Add Vehicle visível', async () => {
    await page.goto('/cadastros/veiculos');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/veiculos');
    await expect(page.getByRole('button', { name: /add vehicle/i })).toBeVisible({ timeout: 10000 });
  });

  test('1.7 Cadastros/Motoristas — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/motoristas');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/motoristas');
  });

  test('1.8 Cadastros/Oficinas — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/oficinas');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/oficinas');
  });

  test('1.9 Cadastros/Embarcadores — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/embarcadores');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/embarcadores');
  });

  test('1.10 Cadastros/Unidades Operacionais — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/unidades-operacionais');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/unidades-operacionais');
  });

  test('1.11 Cadastros/Usuários — lista carrega sem redirect para Dashboard', async () => {
    await page.goto('/cadastros/usuarios');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/usuarios');
    await expect(page.getByRole('button', { name: /novo usuário/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 1.12 Outras páginas ────────────────────────────────────────────────────
  test('1.12 Checklists — página carrega (visão de histórico do tenant)', async () => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/checklists');
    await expect(page.getByRole('heading', { name: /checklists/i })).toBeVisible({ timeout: 10000 });
  });

  test('1.13 Plano de Ação — página carrega', async () => {
    await page.goto('/acoes');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/acoes');
  });

  test('1.14 Manutenção — página carrega', async () => {
    await page.goto('/manutencao');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/manutencao');
  });

  test('1.15 Templates — página carrega e botão Novo Template visível (Manager+)', async () => {
    await page.goto('/checklist-templates');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/checklist-templates');
    await expect(page.getByRole('button', { name: /novo template/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 1.16 Configurações (CRÍTICO — Manager+ deve ter acesso) ────────────────
  test('1.16 Configurações — carrega sem redirect (Manager+ tem acesso)', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/settings');
    // Verifica que o conteúdo da página de configurações está presente
    await expect(page.getByRole('heading', { name: /configurações/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 1.17 Hierarquia de criação de usuários ─────────────────────────────────
  test('1.17 Modal Novo Usuário — dropdown inclui roles abaixo de rank 5 e exclui rank >= 5', async () => {
    await page.goto('/cadastros/usuarios');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /novo usuário/i }).click();
    await page.waitForTimeout(500);

    const roleSelect = page.locator('select').filter({ has: page.locator('option[value="Fleet Assistant"]') });

    // Deve incluir (rank < 5)
    await expect(roleSelect.locator('option[value="Yard Auditor"]')).toBeAttached();
    await expect(roleSelect.locator('option[value="Fleet Assistant"]')).toBeAttached();
    await expect(roleSelect.locator('option[value="Fleet Analyst"]')).toBeAttached();
    await expect(roleSelect.locator('option[value="Supervisor"]')).toBeAttached();

    // NÃO deve incluir (rank >= 5 ou excluído por policy)
    await expect(roleSelect.locator('option[value="Manager"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Coordinator"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Director"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Admin Master"]')).not.toBeAttached();

    // Fechar modal via evaluate (botão Cancelar fica fora do viewport quando há muitas opções)
    await page.locator('button', { hasText: 'Cancelar' }).evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(300);
  });

  // ── 1.18 Logout ────────────────────────────────────────────────────────────
  test('1.18 Logout redireciona para /login', async () => {
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 2 — SUPERVISOR (Pereira)
// Deve espelhar todas as permissões de Fleet Analyst (rank 4)
// ══════════════════════════════════════════════════════════════════════════════
test.describe.serial('Supervisor (Pereira) — Auditoria de Permissões', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await loginAs(browser, users.supervisor.email, users.supervisor.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ── 2.1 Autenticação ───────────────────────────────────────────────────────
  test('2.1 Login e redirect para / (não /checklists)', async () => {
    await expect(page).toHaveURL('/');
  });

  test('2.2 Topbar exibe nome e badge Supervisor', async () => {
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/pereira/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Supervisor', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  // ── 2.3 Sidebar ────────────────────────────────────────────────────────────
  test('2.3 Sidebar exibe itens esperados para Supervisor (sem Configurações)', async () => {
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /cadastros/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /checklists/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /plano de ação/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /manutenção/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /templates/i })).toBeVisible();
  });

  test('2.4 Sidebar NÃO exibe Configurações nem links de Admin', async () => {
    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: /configurações/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /clientes/i })).not.toBeVisible();
    await expect(page.locator('a[href="/admin/users"]')).not.toBeVisible();
  });

  // ── 2.5 Dashboard ──────────────────────────────────────────────────────────
  test('2.5 Dashboard carrega sem redirect', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 2.6 Cadastros ──────────────────────────────────────────────────────────
  test('2.6 Cadastros/Veículos — lista carrega e botão Add Vehicle visível', async () => {
    await page.goto('/cadastros/veiculos');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/veiculos');
    await expect(page.getByRole('button', { name: /add vehicle/i })).toBeVisible({ timeout: 10000 });
  });

  test('2.7 Cadastros/Motoristas — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/motoristas');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/motoristas');
  });

  test('2.8 Cadastros/Oficinas — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/oficinas');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/oficinas');
  });

  test('2.9 Cadastros/Embarcadores — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/embarcadores');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/embarcadores');
  });

  test('2.10 Cadastros/Unidades Operacionais — lista carrega sem redirect', async () => {
    await page.goto('/cadastros/unidades-operacionais');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/unidades-operacionais');
  });

  test('2.11 Cadastros/Usuários — lista carrega sem redirect para Dashboard', async () => {
    await page.goto('/cadastros/usuarios');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/cadastros/usuarios');
    await expect(page.getByRole('button', { name: /novo usuário/i })).toBeVisible({ timeout: 10000 });
  });

  // ── 2.12 Outras páginas ────────────────────────────────────────────────────
  test('2.12 Checklists — página carrega (visão de histórico do tenant)', async () => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/checklists');
    await expect(page.getByRole('heading', { name: /checklists/i })).toBeVisible({ timeout: 10000 });
  });

  test('2.13 Plano de Ação — página carrega', async () => {
    await page.goto('/acoes');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/acoes');
  });

  test('2.14 Manutenção — página carrega', async () => {
    await page.goto('/manutencao');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/manutencao');
  });

  test('2.15 Templates — página carrega, botão Novo Template NÃO visível (Manager+ only)', async () => {
    await page.goto('/checklist-templates');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/checklist-templates');
    await expect(page.getByRole('button', { name: /novo template/i })).not.toBeVisible({ timeout: 5000 });
  });

  // ── 2.16 Configurações (CRÍTICO — Supervisor NÃO deve ter acesso) ──────────
  test('2.16 Configurações — redireciona para / (Supervisor não tem acesso)', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Settings redireciona para '/' para roles sem acesso (Manager+)
    await expect(page).not.toHaveURL('/settings', { timeout: 5000 });
  });

  // ── 2.17 Hierarquia de criação de usuários ─────────────────────────────────
  test('2.17 Modal Novo Usuário — dropdown inclui apenas roles abaixo de rank 4 e exclui rank >= 4', async () => {
    await page.goto('/cadastros/usuarios');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /novo usuário/i }).click();
    await page.waitForTimeout(500);

    const roleSelect = page.locator('select').filter({ has: page.locator('option[value="Yard Auditor"]') });

    // Deve incluir (rank < 4, exceto Driver que é criado via Motoristas)
    await expect(roleSelect.locator('option[value="Yard Auditor"]')).toBeAttached();
    await expect(roleSelect.locator('option[value="Fleet Assistant"]')).toBeAttached();

    // NÃO deve incluir (rank >= 4)
    await expect(roleSelect.locator('option[value="Fleet Analyst"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Supervisor"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Manager"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Coordinator"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Director"]')).not.toBeAttached();
    await expect(roleSelect.locator('option[value="Admin Master"]')).not.toBeAttached();

    // Fechar modal
    await page.getByRole('button', { name: /cancelar/i }).click();
  });

  // ── 2.18 Logout ────────────────────────────────────────────────────────────
  test('2.18 Logout redireciona para /login', async () => {
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});
