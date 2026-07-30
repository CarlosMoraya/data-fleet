import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const RUN_PENDING_FLOW = process.env.BETA_FLEET_TICKETS_E2E === '1';

function skipPendingScenario(authFile: string, role: string) {
  test.skip(!existsSync(authFile), `Credencial de ${role} ausente: ${authFile}`);
  test.skip(!RUN_PENDING_FLOW, 'Cenário pendente: habilite BETA_FLEET_TICKETS_E2E=1 após preparar a massa DEV.');
}

test.describe('Chamados/S.O.S. — fluxo pendente DEV', () => {
  test.describe('Motorista', () => {
    test.use({ storageState: 'e2e/.auth/jorge.json' });

    test('1. Motorista abre S.O.S. e recebe confirmação', async ({ page }) => {
      skipPendingScenario('e2e/.auth/jorge.json', 'Driver');
      await page.goto('/sos');
      await page.locator('#sos-vehicle').selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Veículo enguiçado' }).click();
      await page.locator('#sos-description').fill('Falha mecânica identificada no veículo.');
      const manualLocation = page.locator('#sos-location');
      if (await manualLocation.isVisible().catch(() => false)) await manualLocation.fill('Base DEV BetaFleet');
      await page.getByRole('button', { name: 'Enviar S.O.S.' }).click();
      await expect(page.getByText('S.O.S. enviado')).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('Frota e Yard Auditor', () => {
    test.use({ storageState: 'e2e/.auth/mariana.json' });

    test('2. Fleet Analyst vê S.O.S. no card da tela de Chamados', async ({ page }) => {
      skipPendingScenario('e2e/.auth/mariana.json', 'Fleet Analyst');
      await page.goto('/chamados');
      await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
      await expect(page.getByRole('button', { name: /S\.O\.S\./ })).toBeVisible();
    });

    test('4. Fleet Analyst vê chamado comum em Não classificados', async ({ page }) => {
      skipPendingScenario('e2e/.auth/mariana.json', 'Fleet Analyst');
      await page.goto('/chamados');
      await expect(page.getByRole('button', { name: /Não classificados/ })).toBeVisible();
    });

    test('5. Fleet Analyst classifica chamado comum como crítico', async ({ page }) => {
      skipPendingScenario('e2e/.auth/mariana.json', 'Fleet Analyst');
      await page.goto('/chamados');
      await page.getByRole('button', { name: /Não classificados/ }).click();
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
      await rows.first().click();
      await page.locator('#ticket-criticality').selectOption('critical');
      await page.getByRole('button', { name: 'Classificar' }).click();
      await expect(page.getByText('Crítico').first()).toBeVisible();
    });
  });

  test.describe('Yard Auditor', () => {
    test.use({ storageState: 'e2e/.auth/carlos.json' });

    test('3. Yard Auditor abre chamado comum sem criticidade', async ({ page }) => {
      skipPendingScenario('e2e/.auth/carlos.json', 'Yard Auditor');
      await page.goto('/chamados');
      await page.getByRole('button', { name: 'Novo chamado' }).click();
      await page.locator('#fleet-ticket-vehicle').selectOption({ index: 1 });
      await page.locator('#fleet-ticket-title').fill('Pneu danificado na base');
      await page.locator('#fleet-ticket-description').fill('O pneu precisa de inspeção antes da próxima saída.');
      await page.getByRole('button', { name: 'Criar chamado' }).click();
      await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
    });
  });

  test.describe('Coordinator — Telegram', () => {
    test.use({ storageState: 'e2e/.auth/alexandre.json' });

    test('7. Coordinator configura Telegram e envia teste quando secrets existem', async ({ page }) => {
      test.skip(process.env.BETA_FLEET_TELEGRAM_E2E !== '1', 'Cenário pendente: exige bot Telegram, chat_id e secrets configurados no DEV.');
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager/Coordinator');
      await page.goto('/settings');
      await page.getByRole('button', { name: 'Telegram' }).click();
      await page.getByRole('checkbox', { name: 'Ativar notificações Telegram' }).check();
      await page.locator('input[placeholder*="-100"]').fill(process.env.BETA_FLEET_TELEGRAM_CHAT_ID ?? '');
      await page.getByRole('button', { name: 'Salvar configurações' }).click();
      await page.getByRole('button', { name: 'Enviar mensagem de teste' }).click();
      await expect(page.getByText('Mensagem de teste enviada com sucesso.')).toBeVisible({ timeout: 20000 });
    });
  });
});
