import { test, expect, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

async function expectTabContent(page: Page, path: string, heading: string | RegExp) {
  await expect(page).toHaveURL(path);
  await expect(mainHeading(page, heading)).toBeVisible({ timeout: 15000 });
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

  if (link.error) throw link.error;

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

test.describe('Cadastros tab navigation', () => {
  test.use({ storageState: 'e2e/.auth/alexandre.json' });

  test('switches tabs and keeps URL and content in sync', async ({ page }) => {
    await page.goto('/cadastros/usuarios');
    await expectTabContent(page, '/cadastros/usuarios', 'Usuários');

    await page.getByRole('link', { name: 'Unid. Operacionais' }).click();
    await expectTabContent(page, '/cadastros/unidades-operacionais', 'Unidades Operacionais');

    await page.getByRole('link', { name: 'Motoristas' }).click();
    await expectTabContent(page, '/cadastros/motoristas', 'Motoristas');

    await page.getByRole('link', { name: 'Veículos' }).click();
    await expectTabContent(page, '/cadastros/veiculos', 'Veículos');
  });

  test('Coordinator session keeps tab navigation responsive after idle time', async ({ page }) => {
    const storageValue = await createCoordinatorStorageValue();

    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      ['sb-oajfjdadcicgoxrfrnny-auth-token', storageValue]
    );

    await page.goto('/cadastros/usuarios');
    await expectTabContent(page, '/cadastros/usuarios', 'Usuários');

    await page.waitForTimeout(12000);

    await page.getByRole('link', { name: 'Pneus' }).click();
    await expectTabContent(page, '/cadastros/pneus', 'Gestão de Pneus');

    await page.getByRole('link', { name: 'Motoristas' }).click();
    await expectTabContent(page, '/cadastros/motoristas', 'Motoristas');
  });
});
