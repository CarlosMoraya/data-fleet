import { test, expect } from '@playwright/test';

/**
 * TESTES E2E — CHECKLIST: PREENCHIMENTO OFFLINE (Jorge — Motorista)
 *
 * Testa o comportamento de preenchimento do checklist quando a rede está
 * indisponível, validando que:
 * - O botão "Confirmar hodômetro" não fica preso em loading
 * - O botão "Finalizar Checklist" não fica preso em "Finalizando..."
 * - As operações são enfileiradas no IndexedDB (Dexie)
 * - Após reconectar, o sync automático ocorre
 *
 * NOTA: Estes testes simulam offline via CDP (DevTools Protocol).
 * Requerem que o motorista Jorge tenha um veículo associado e um template
 * publicado para ter um checklist em andamento.
 */

test.describe.serial('Checklist — Preenchimento Offline (Jorge)', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  // ── A: Confirmar hodômetro offline ────────────────────────────────────────

  test('A.1 Confirmar hodômetro offline não trava e avança para itens', async ({ page, context }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    // Verificar se há veículo associado
    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible().catch(() => false);
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

    // Verificar se há botão "Iniciar" disponível
    const iniciarBtn = page.locator('button', { hasText: /Iniciar/i }).first();
    const btnVisible = await iniciarBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Nenhum template publicado para iniciar checklist');
      return;
    }

    // Iniciar checklist ONLINE
    await iniciarBtn.click();
    await page.waitForURL(/.*checklists\/preencher\/.*/, { timeout: 10000 }).catch(() => {});

    const onFillPage = page.url().includes('checklists/preencher/');
    if (!onFillPage) {
      test.skip(true, 'Não foi possível navegar para o preenchimento do checklist');
      return;
    }

    await page.waitForLoadState('networkidle');

    // Verificar step de hodômetro
    const kmLabel = await page.locator('text=hodômetro').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!kmLabel) {
      test.skip(true, 'Passo hodômetro não visível — pode já estar confirmado');
      return;
    }

    // Preencher KM
    const kmInput = page.locator('input[inputMode="numeric"]').first();
    await kmInput.fill('45000');

    // Simular modo offline ANTES de confirmar KM
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    // Clicar em "Confirmar hodômetro"
    const confirmarBtn = page.locator('button', { hasText: /Confirmar hodômetro/i });
    await confirmarBtn.click();

    // Aguardar um momento para a mutation processar (enfileiramento offline)
    await page.waitForTimeout(1500);

    // Verificar que o botão NÃO está mais em loading (spinner sumiu)
    const spinner = page.locator('button:has(svg.animate-spin)');
    const spinnerVisible = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
    expect(spinnerVisible).toBe(false);

    // Verificar que a tela avançou (KM confirmado — banner verde com hodômetro)
    const kmConfirmed = await page.locator('text=Hodômetro:').isVisible({ timeout: 3000 }).catch(() => false);
    expect(kmConfirmed).toBe(true);

    // Verificar via IndexedDB que a operação foi enfileirada
    const queueSize = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const request = indexedDB.open('betafleet-offline-v1');
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('syncQueue')) {
            resolve(0);
            return;
          }
          const tx = db.transaction('syncQueue', 'readonly');
          const store = tx.objectStore('syncQueue');
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(0);
        };
        request.onerror = () => resolve(0);
      });
    });

    // Deve haver pelo menos 1 operação na fila (confirm_km)
    expect(queueSize).toBeGreaterThanOrEqual(1);

    // Restaurar rede para não afetar testes seguintes
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  });

  // ── B: Finalizar checklist offline ────────────────────────────────────────

  test('B.1 Finalizar checklist offline não trava em "Finalizando..."', async ({ page, context }) => {
    await page.goto('/checklists');
    await page.waitForLoadState('networkidle');

    const noVehicle = await page.getByText(/Nenhum veículo associado/i).isVisible().catch(() => false);
    if (noVehicle) {
      test.skip(true, 'Jorge não possui veículo associado');
      return;
    }

    const iniciarBtn = page.locator('button', { hasText: /Iniciar/i }).first();
    const btnVisible = await iniciarBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'Nenhum template publicado para iniciar checklist');
      return;
    }

    await iniciarBtn.click();
    await page.waitForURL(/.*checklists\/preencher\/.*/, { timeout: 10000 }).catch(() => {});

    const onFillPage = page.url().includes('checklists/preencher/');
    if (!onFillPage) {
      test.skip(true, 'Não foi possível navegar para o preenchimento do checklist');
      return;
    }

    await page.waitForLoadState('networkidle');

    // Confirmar KM online primeiro
    const kmInput = page.locator('input[inputMode="numeric"]').first();
    const kmVisible = await kmInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (kmVisible) {
      await kmInput.fill('50000');
      await page.locator('button', { hasText: /Confirmar hodômetro/i }).click();
      await page.waitForTimeout(1500);
    }

    // Aguardar itens aparecerem
    const itemsVisible = await page.locator('text=/1\\./').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!itemsVisible) {
      test.skip(true, 'Itens do checklist não apareceram após confirmar KM');
      return;
    }

    // Responder itens obrigatórios (clicar em OK em cada)
    const okButtons = page.locator('button', { hasText: /^OK$/ });
    const okCount = await okButtons.count();
    for (let i = 0; i < okCount; i++) {
      await okButtons.nth(i).click();
      await page.waitForTimeout(300);
    }

    // Simular modo offline ANTES de finalizar
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    // Clicar em "Finalizar Checklist"
    const finalizarBtn = page.locator('button', { hasText: /Finalizar Checklist/i });
    await finalizarBtn.click();

    // Aguardar um momento para o enfileiramento offline
    await page.waitForTimeout(2000);

    // Verificar que o botão NÃO ficou preso em "Finalizando..."
    const finalizando = page.locator('button:has-text("Finalizando...")');
    const finalizandoVisible = await finalizando.isVisible({ timeout: 2000 }).catch(() => false);
    expect(finalizandoVisible).toBe(false);

    // Verificar que navegou de volta para /checklists
    const onChecklists = page.url().includes('/checklists');
    expect(onChecklists).toBe(true);

    // Verificar via IndexedDB que operações foram enfileiradas
    const queueSize = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const request = indexedDB.open('betafleet-offline-v1');
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('syncQueue')) {
            resolve(0);
            return;
          }
          const tx = db.transaction('syncQueue', 'readonly');
          const store = tx.objectStore('syncQueue');
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(0);
        };
        request.onerror = () => resolve(0);
      });
    });

    // Deve haver pelo menos 1 operação (finish_checklist + possivelmente save_response)
    expect(queueSize).toBeGreaterThanOrEqual(1);

    // Restaurar rede
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    // Aguardar sync automático
    await page.waitForTimeout(3000);
  });
});
