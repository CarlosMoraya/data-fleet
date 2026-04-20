import { test, expect } from '@playwright/test';
import path from 'path';

const ASSETS_PATH = path.resolve('e2e/assets');

/**
 * TESTES E2E — PERFIL 1: ADMINISTRADOR MASTER (Carlos Moraya)
 * 
 * Estrutura:
 * BLOCO A — Autenticação e Sessão
 * BLOCO B — Módulos de Negócio (CRUD total)
 * BLOCO C — Dashboards e Relatórios
 * BLOCO D — Segurança
 */

test.describe('Admin Master — Auditoria Sistemática', () => {
  // O perfil Admin já está configurado no setup global e usado no projeto 'chromium'
  // Mas para garantir isolamento nestes testes de auditoria, vamos carregar explicitamente
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test.describe('BLOCO A — Autenticação e Sessão', () => {
    test('A.1 Acesso total a áreas administrativas', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL('/');

      // Sidebar deve mostrar itens de Admin
      await expect(page.locator('text=Admin').first()).toBeVisible();
      await expect(page.locator('a[href="/admin/clients"]')).toBeVisible();
      await expect(page.locator('a[href="/admin/users"]')).toBeVisible();
    });

    test('A.2 Logout e redirecionamento', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Tentar clicar no botão que contém o texto "Logout"
      await page.getByRole('button', { name: /Logout/i }).click({ timeout: 10000 });

      await expect(page).toHaveURL(/.*login.*/, { timeout: 20000 });

      // Tentar voltar sem auth deve redirecionar
      await page.goto('/cadastros/veiculos');
      await expect(page).toHaveURL(/.*login.*/, { timeout: 10000 });
    });
  });

  test.describe('BLOCO B — Módulos de Negócio (Admin Master)', () => {
    test('B.1 Gestão de Clientes (Multi-tenancy)', async ({ page }) => {
      await page.goto('/admin/clients');
      await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();

      // IMPORTANTE: Garantir que "Todos os Clientes" está selecionado no Topbar
      const topbarSelect = page.locator('header select');
      await page.waitForTimeout(2000);
      await expect(topbarSelect).toBeVisible({ timeout: 15000 });

      await expect(async () => {
        await topbarSelect.selectOption('');
        await expect(topbarSelect).toHaveValue('');
      }).toPass({ timeout: 5000 });

      await page.waitForTimeout(1000);

      // Criar cliente teste
      const clientName = `Audit Client ${Date.now()}`;
      await page.getByRole('button', { name: 'Novo Cliente' }).click();

      const modal = page.getByRole('heading', { name: 'Novo Cliente' });
      await expect(modal).toBeVisible();

      await page.fill('input[placeholder*="Ex: Acme"]', clientName);
      await page.getByRole('button', { name: 'Salvar' }).click();

      // Aguardar modal fechar
      await expect(modal).not.toBeVisible({ timeout: 10000 });

      // Tenta buscar para garantir visibilidade
      await page.fill('input[placeholder="Buscar por nome..."]', clientName);
      await expect(page.locator('table').getByText(clientName)).toBeVisible({ timeout: 15000 });
    });

    test('B.2 Gestão Global de Usuários', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();

      // Deve ver o seletor de clientes (exclusivo Admin Master) no Topbar
      const clientSelector = page.locator('select').first();
      await expect(clientSelector).toBeVisible();
    });

    test('B.3 CRUD Veículos (Acesso Total)', async ({ page }) => {
      await page.goto('/cadastros/veiculos');
      await expect(page.getByRole('heading', { name: 'Veículos' })).toBeVisible();

      const plate = `AUD${Math.floor(Math.random() * 9000) + 1000}`;
      await page.click('button:has-text("Adicionar Veículo")');

      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('h2', { hasText: 'Cadastrar Veículo' })).toBeVisible({ timeout: 10000 });

      // Identificação (sempre obrigatórios)
      await modal.locator('input[name="licensePlate"]').fill(plate);
      await modal.locator('select[name="type"]').selectOption('Passeio');
      await modal.locator('input[name="brand"]').fill('VOLVO');
      await modal.locator('input[name="model"]').fill('FH 540');
      await modal.locator('input[name="year"]').fill('2024');
      await modal.locator('input[name="color"]').fill('Branco');
      await modal.locator('input[name="renavam"]').fill('12345678901');
      await modal.locator('input[name="chassi"]').fill('12345678901234567');
      await modal.locator('input[name="detranUF"]').fill('SP');

      // Propriedade
      await modal.locator('select[name="acquisition"]').selectOption('Owned');
      await modal.locator('input[name="owner"]').fill('Frota Admin E2E');
      await modal.locator('input[name="fipePrice"]').fill('250000');
      await modal.locator('input[name="tracker"]').fill('Omnilink');
      await modal.locator('input[name="antt"]').fill('12345678');
      await modal.locator('input[name="autonomy"]').fill('800');

      // Upload CRLV (obrigatório por padrão)
      const pdfPath = path.join(ASSETS_PATH, 'test-document.pdf');
      await modal.locator('input[name="crlvUpload"]').setInputFiles(pdfPath);

      await modal.locator('button:has-text("Salvar Veículo")').click();

      // Aguarda modal fechar (uploads + OCR podem ser lentos)
      await expect(modal).not.toBeVisible({ timeout: 60000 });
      await expect(page.locator('table').getByText(plate)).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('BLOCO C — Dashboards e Relatórios', () => {
    test('C.1 Visualização de Dashboard Global', async ({ page }) => {
      await page.goto('/');
      // Aguarda carregamento de cards de KPI (labels em inglês no Dashboard.tsx atualmente)
      await expect(page.locator('text=Total de Veículos')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Em Manutenção')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('BLOCO D — Segurança e Permissões Altas', () => {
    test('D.1 Acesso a logs de auditoria (via checklists)', async ({ page }) => {
      await page.goto('/checklists');
      // Admin deve ver histórico de todos (se selecionado "Todos os Clientes")
      await expect(page.locator('h1')).toContainText('Checklists');
    });
  });
});
