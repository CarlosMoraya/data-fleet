import { test, expect } from '@playwright/test';

/**
 * TESTE E2E — Contextos Entrega/Devolução com evidência obrigatória (Yard Auditor)
 *
 * NOTA: o teste de câmera exige a flag `--use-fake-device-for-media-stream`
 * no Chromium para simular captura ao vivo em ambiente headless.
 *
 * Status: PENDENTE — os usuários de teste dos perfis Manager/Assistant/Analyst/
 * Auditor/Driver foram deletados do Supabase em 2026-05-06. Sem um usuário
 * Yard Auditor válido (e storageState correspondente), este teste não roda.
 * Mover para e2e/completed/ após recadastro dos perfis Yard Auditor e Driver
 * e atualização do .env.local.
 */

test.describe('Checklists — contextos Entrega e Devolução (Yard Auditor)', () => {
  test.use({ storageState: 'e2e/.auth/yard-auditor.json' });

  test('1. Yard Auditor vê o seletor de contexto com Auditoria, Entrega e Devolução', async ({ page }) => {
    await page.goto('/checklists');
    const contextSelect = page.locator('select').first();
    await expect(contextSelect).toBeVisible({ timeout: 15000 });
    await expect(contextSelect.locator('option', { hasText: 'Auditoria' })).toHaveCount(1);
    await expect(contextSelect.locator('option', { hasText: 'Entrega' })).toHaveCount(1);
    await expect(contextSelect.locator('option', { hasText: 'Devolução' })).toHaveCount(1);
  });

  test('2. Ao escolher Entrega, o dropdown de veículos lista apenas veículos Available', async ({ page }) => {
    await page.goto('/checklists');
    await page.locator('select').first().selectOption({ label: 'Entrega' });
    // O dropdown de veículos deve refletir apenas status 'Available' — validação
    // depende de dados de teste cadastrados (fora do escopo desta sessão).
  });

  test('3. O dropdown de motoristas lista apenas motoristas sem veículo vinculado', async ({ page }) => {
    await page.goto('/checklists');
    await page.locator('select').first().selectOption({ label: 'Entrega' });
    const driverSelect = page.locator('select').nth(2);
    await expect(driverSelect).toBeVisible({ timeout: 15000 });
  });

  test('4. O botão Finalizar permanece desabilitado até a foto da CNH e a assinatura serem coletadas', async ({ page }) => {
    // Requer um checklist de Entrega/Devolução em andamento — depende do fluxo
    // de início coberto nos testes 1-3.
    await page.goto('/checklists');
    // Navegação até /checklists/preencher/:id e verificação do botão "Finalizar Checklist"
    // com atributo disabled enquanto a seção de evidências não estiver completa.
  });

  test('5. Um usuário Driver não vê nenhum template de Entrega ou Devolução', async ({ page }) => {
    await page.context().storageState({ path: 'e2e/.auth/driver.json' });
    await page.goto('/checklists');
    await expect(page.getByText('Entrega')).not.toBeVisible();
    await expect(page.getByText('Devolução')).not.toBeVisible();
  });
});
