import { expect, test, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

function getSupabaseStorageKey() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL for settings auth bootstrap');
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  if (!projectRef) {
    throw new Error('Could not derive Supabase project ref from VITE_SUPABASE_URL');
  }

  return `sb-${projectRef}-auth-token`;
}

async function createCoordinatorStorageValue() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables for Coordinator auth bootstrap');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const anon = createClient(supabaseUrl, anonKey);

  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'coordinator@demo.betafleet.local',
    options: { redirectTo: 'http://localhost:3000/' },
  });

  if (link.error) {
    throw link.error;
  }

  const verify = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: 'magiclink',
  });

  if (verify.error || !verify.data.session) {
    throw verify.error ?? new Error('Coordinator session bootstrap failed');
  }

  const session = verify.data.session;

  return JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
    weak_password: session.weak_password ?? null,
  });
}

async function getSwitchState(toggle: Locator) {
  const ariaChecked = await toggle.getAttribute('aria-checked');
  if (ariaChecked !== 'true' && ariaChecked !== 'false') {
    throw new Error(`Unexpected aria-checked value: ${ariaChecked}`);
  }
  return ariaChecked === 'true';
}

async function saveVehicleSettings(page: Page) {
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Configurações de veículos salvas com sucesso.')).toBeVisible({ timeout: 15000 });
}

test.describe('Settings vehicle field persistence', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Coordinator persists vehicle required fields after reload', async ({ page }) => {
    const storageValue = await createCoordinatorStorageValue();
    const storageKey = getSupabaseStorageKey();

    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [storageKey, storageValue]
    );

    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
    await expect(mainHeading(page, 'Configurações')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Veículos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campos Obrigatórios do Veículo' })).toBeVisible();

    const renavamToggle = page.getByRole('switch', { name: 'Renavam obrigatório' });
    const initialState = await getSwitchState(renavamToggle);

    try {
      await renavamToggle.click();
      await expect(renavamToggle).toHaveAttribute('aria-checked', String(!initialState));

      await saveVehicleSettings(page);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Campos Obrigatórios do Veículo' })).toBeVisible({ timeout: 15000 });
      await expect(renavamToggle).toHaveAttribute('aria-checked', String(!initialState));
    } finally {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Campos Obrigatórios do Veículo' })).toBeVisible({ timeout: 15000 });

      const currentState = await getSwitchState(renavamToggle);
      if (currentState !== initialState) {
        await renavamToggle.click();
        await expect(renavamToggle).toHaveAttribute('aria-checked', String(initialState));
        await saveVehicleSettings(page);
        await page.reload();
        await expect(renavamToggle).toHaveAttribute('aria-checked', String(initialState));
      }
    }
  });
});
