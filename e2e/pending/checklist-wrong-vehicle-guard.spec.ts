import { expect, test, type Page } from '@playwright/test';

const OPEN_CHECKLIST_PREFIX = 'Checklist em andamento · ';

function plateFromOption(text: string): string {
  return text.match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/)?.[0] ?? text.trim();
}

async function openChecklistHeading(page: Page) {
  return page.getByText(new RegExp(`^${OPEN_CHECKLIST_PREFIX}`)).first();
}

test.describe.serial('Checklist — bloqueio de veículo diferente', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  test('cartão e aviso citam a placa do checklist aberto após selecionar outra placa', async ({ page }) => {
    let createdChecklist = false;

    try {
      await page.goto('/checklists');
      await page.waitForLoadState('networkidle');

      const vehicleSelect = page.locator('select').first();
      await expect(vehicleSelect).toBeVisible({ timeout: 15000 });

      let heading = await openChecklistHeading(page);
      const hasOpenChecklist = await heading.isVisible().catch(() => false);

      if (!hasOpenChecklist) {
        const options = await vehicleSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => ({
          text: node.textContent ?? '',
          value: (node as HTMLOptionElement).value,
        })));
        const ownVehicle = options.find((option) => option.text.includes('— seu veículo'));
        if (!ownVehicle) {
          throw new Error('BLOQUEADO: o Driver de teste não possui veículo próprio disponível para criar o checklist da placa A.');
        }

        await vehicleSelect.selectOption(ownVehicle.value);
        const startButton = page.getByRole('button', { name: /^Iniciar$/ }).first();
        if (!await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          throw new Error('BLOQUEADO: não há template publicado disponível para criar o checklist da placa A.');
        }

        await startButton.click();
        await expect(page).toHaveURL(/\/checklists\/preencher\//, { timeout: 15000 });
        createdChecklist = true;

        await page.goto('/checklists');
        await page.waitForLoadState('networkidle');
        heading = await openChecklistHeading(page);
      }

      await expect(heading).toBeVisible({ timeout: 15000 });
      const headingText = (await heading.textContent())?.trim() ?? '';
      const openPlate = headingText.slice(OPEN_CHECKLIST_PREFIX.length).trim();
      if (!openPlate || openPlate === 'Placa não informada') {
        throw new Error('BLOQUEADO: o checklist em andamento do Driver de teste não possui placa informada.');
      }

      const options = await vehicleSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => ({
        text: node.textContent ?? '',
        value: (node as HTMLOptionElement).value,
      })));
      const otherVehicle = options.find((option) => plateFromOption(option.text) !== openPlate);
      if (!otherVehicle) {
        throw new Error('BLOQUEADO: o Driver de teste não possui uma segunda placa disponível para o cenário A → B.');
      }

      await vehicleSelect.selectOption(otherVehicle.value);

      await expect(heading).toHaveText(`${OPEN_CHECKLIST_PREFIX}${openPlate}`);
      await expect(page.getByText(
        `Você tem um checklist em andamento na placa ${openPlate}. Finalize ou cancele esse checklist antes de iniciar um novo — inclusive para outro veículo.`,
        { exact: true },
      )).toBeVisible();
    } finally {
      if (createdChecklist) {
        await page.goto('/checklists');
        await page.waitForLoadState('networkidle');
        await page.getByTitle('Cancelar checklist em andamento').click();
        await page.getByRole('button', { name: 'Excluir permanentemente' }).click();
        await expect(page.getByText(new RegExp(`^${OPEN_CHECKLIST_PREFIX}`))).toHaveCount(0);
      }
    }
  });
});
