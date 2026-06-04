import { expect, test, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page.locator('main').getByRole('heading', { name });
}

function getSupabaseStorageKey() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL for smoke auth bootstrap');
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  if (!projectRef) {
    throw new Error('Could not derive Supabase project ref from VITE_SUPABASE_URL');
  }

  return `sb-${projectRef}-auth-token`;
}

async function expectTabContent(page: Page, path: string, heading: string | RegExp) {
  await expect(page).toHaveURL(path);
  await expect(mainHeading(page, heading)).toBeVisible({ timeout: 15000 });
}

async function createSessionStorageValue(email: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY for smoke auth bootstrap'
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const anon = createClient(supabaseUrl, anonKey);

  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
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
    throw verify.error ?? new Error(`Session bootstrap failed for ${email}`);
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

test.describe('Smoke', () => {
  test.describe('Public routes', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('renders login screen', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('redirects anonymous user away from protected route', async ({ page }) => {
      await page.goto('/cadastros/usuarios');
      await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
    });
  });

  test.describe('Authenticated admin shell', () => {
    test('loads dashboard shell', async ({ page }) => {
      await page.goto('/');
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
      await expect(mainHeading(page, 'Dashboard')).toBeVisible({ timeout: 15000 });
    });

    test('navigates Cadastros tabs and keeps route/content in sync', async ({ page }) => {
      await page.goto('/cadastros/usuarios');
      await expectTabContent(page, '/cadastros/usuarios', 'Usuários');

      await page.getByRole('link', { name: 'Unid. Operacionais' }).click();
      await expectTabContent(page, '/cadastros/unidades-operacionais', 'Unidades Operacionais');

      await page.getByRole('link', { name: 'Motoristas' }).click();
      await expectTabContent(page, '/cadastros/motoristas', 'Motoristas');

      await page.getByRole('link', { name: 'Veículos' }).click();
      await expectTabContent(page, '/cadastros/veiculos', 'Veículos');
    });
  });

  test.describe('Coordinator Cadastros regression', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('keeps tabs responsive after idle time', async ({ page }) => {
      const storageValue = await createSessionStorageValue('coordinator@demo.betafleet.local');
      const storageKey = getSupabaseStorageKey();

      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [storageKey, storageValue]
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
});
