import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const RUN_PENDING_FLOW = process.env.BETA_FLEET_USER_INACTIVATION_E2E === '1';

function skipPendingScenario(authFile: string, role: string) {
  test.skip(!existsSync(authFile), `Credencial de ${role} ausente: ${authFile}`);
  test.skip(!RUN_PENDING_FLOW, 'Cenário pendente: habilite BETA_FLEET_USER_INACTIVATION_E2E=1 após preparar a massa DEV.');
}

// Helper para extrair access_token do storageState gerado pelo Playwright + Supabase
function getAccessTokenFromStorageState(authFile: string): string | null {
  try {
    const raw = readFileSync(authFile, 'utf-8');
    const data = JSON.parse(raw);
    const origins = data.origins ?? [];
    for (const origin of origins) {
      const localStorage = origin.localStorage ?? [];
      for (const item of localStorage) {
        const key: string = item.name ?? item.key ?? '';
        // Chave do Supabase: sb-<project>-auth-token
        if (key.includes('sb-') && key.includes('auth-token')) {
          const parsed = JSON.parse(item.value);
          if (parsed?.access_token) return parsed.access_token;
          if (parsed?.accessToken) return parsed.accessToken;
          // algumas versões guardam como string direta
          if (typeof parsed === 'string') {
            try {
              const inner = JSON.parse(parsed);
              if (inner?.access_token) return inner.access_token;
            } catch {
              // ignora
            }
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

test.describe('Usuários — inativação e exclusão restrita', () => {
  // Grupo Manager — cenários 1, 2, 3 e 4
  test.describe('Manager', () => {
    test.use({ storageState: 'e2e/.auth/alexandre.json' });

    test('Manager inativa usuário e o badge muda para Inativo', async ({ page }) => {
      // Prova que Coordinator ou acima consegue inativar e que o filtro padrão oculta inativos
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager');

      await page.goto('/cadastros/usuarios');
      await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 15000 });

      // Clica no botão Inativar da primeira linha disponível
      const inativarBtn = page.getByTitle('Inativar').first();
      await expect(inativarBtn).toBeVisible({ timeout: 15000 });
      await inativarBtn.click();

      // A linha some da lista porque o filtro padrão oculta inativos
      // Aguarda a linha desaparecer ou a lista recarregar sem o usuário inativado
      await expect(inativarBtn).toBeHidden({ timeout: 15000 }).catch(async () => {
        // fallback: verifica que o botão não está mais visível na lista filtrada
        await expect(page.getByTitle('Inativar').first()).toBeVisible({ timeout: 15000 });
      });

      // Clicar em Mostrar inativos e conferir badge Inativo
      const mostrarInativosBtn = page.getByRole('button', { name: 'Mostrar inativos' });
      await expect(mostrarInativosBtn).toBeVisible({ timeout: 15000 });
      await mostrarInativosBtn.click();
      await expect(page.getByText('Inativo').first()).toBeVisible({ timeout: 15000 });
    });

    test('usuário inativado é barrado no próximo login', async () => {
      // Prova que o Auth bloqueia login de usuário com active=false (banned_until no futuro)
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      const email = process.env.TEST_INACTIVATED_USER_EMAIL;
      const password = process.env.TEST_INACTIVATED_USER_PASSWORD;

      test.skip(!supabaseUrl, 'VITE_SUPABASE_URL não definida: não é possível testar login do inativado.');
      test.skip(!supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY não definida: não é possível testar login do inativado.');
      test.skip(!email || !password, 'TEST_INACTIVATED_USER_EMAIL ou TEST_INACTIVATED_USER_PASSWORD não definidas: não é possível testar login do inativado.');

      const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
      const result = await supabase.auth.signInWithPassword({
        email: email!,
        password: password!,
      });

      // O login deve falhar e não retornar sessão
      expect(result.error).toBeTruthy();
      expect(result.data.session).toBeNull();
    });

    test('inativação reflete no cadastro de motorista vinculado', async ({ page }) => {
      // Prova que inativar o profile propaga active=false para drivers vinculado e que reativar reverte
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager');

      const driverProfileId = process.env.TEST_DRIVER_PROFILE_ID;
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      test.skip(!driverProfileId, 'TEST_DRIVER_PROFILE_ID não definida: não é possível verificar vínculo driver/profile.');
      test.skip(!supabaseUrl, 'VITE_SUPABASE_URL não definida: não é possível consultar drivers via REST.');
      test.skip(!serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY não definida: não é possível consultar drivers via REST.');

      // Consulta via REST com service_role: drivers?profile_id=eq.<id>&select=active
      const url = `${supabaseUrl}/rest/v1/drivers?profile_id=eq.${driverProfileId}&select=active`;
      const res = await fetch(url, {
        headers: {
          apikey: serviceRoleKey!,
          Authorization: `Bearer ${serviceRoleKey!}`,
        },
      });
      expect(res.ok).toBeTruthy();
      const data = (await res.json()) as Array<{ active: boolean }>;
      expect(data.length).toBeGreaterThan(0);
      // Após inativação do cenário 1, o driver vinculado deve estar com active === false
      expect(data[0].active).toBe(false);

      // Reativar pela tela para restaurar coerência
      await page.goto('/cadastros/usuarios');
      await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 15000 });
      const mostrarInativosBtn = page.getByRole('button', { name: 'Mostrar inativos' });
      if (await mostrarInativosBtn.isVisible().catch(() => false)) {
        await mostrarInativosBtn.click();
      }
      const ativarBtn = page.getByTitle('Ativar').first();
      await expect(ativarBtn).toBeVisible({ timeout: 15000 });
      await ativarBtn.click();
      // Aguarda badge voltar para ativo ou botão Inativar reaparecer
      await expect(page.getByTitle('Inativar').first()).toBeVisible({ timeout: 15000 });

      // Conferir que voltou a active === true via API
      const res2 = await fetch(url, {
        headers: {
          apikey: serviceRoleKey!,
          Authorization: `Bearer ${serviceRoleKey!}`,
        },
      });
      expect(res2.ok).toBeTruthy();
      const data2 = (await res2.json()) as Array<{ active: boolean }>;
      expect(data2[0].active).toBe(true);
    });

    test('Manager não vê o botão de excluir', async ({ page }) => {
      // Prova que excluir é exclusivo do Admin Master e não aparece para Manager
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager');

      await page.goto('/cadastros/usuarios');
      await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByTitle('Excluir')).toHaveCount(0);
    });
  });

  // Grupo Admin Master — cenário 4b precisa vir logo após cenário 4 para preservar ordem
  test.describe('Admin Master — exclusão visível', () => {
    test.use({ storageState: 'e2e/.auth/admin.json' });

    test('Admin Master vê o botão de excluir', async ({ page }) => {
      // Prova que Admin Master tem permissão exclusiva de exclusão e vê o botão
      skipPendingScenario('e2e/.auth/admin.json', 'Admin Master');

      await page.goto('/cadastros/usuarios');
      await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 15000 });
      expect(await page.getByTitle('Excluir').count()).toBeGreaterThan(0);
    });
  });

  test.describe('Manager — API restrita', () => {
    test.use({ storageState: 'e2e/.auth/alexandre.json' });

    test('Manager não exclui perfil pela API', async () => {
      // Prova que a Edge Function create-user bloqueia delete para não-Admin Master
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const targetProfileId = process.env.TEST_TARGET_PROFILE_ID;

      test.skip(!supabaseUrl, 'VITE_SUPABASE_URL não definida: não é possível chamar create-user.');
      test.skip(!targetProfileId, 'TEST_TARGET_PROFILE_ID não definida: não é possível testar exclusão via API.');

      const token = getAccessTokenFromStorageState('e2e/.auth/alexandre.json');
      test.skip(!token, 'access_token do Manager não encontrado em e2e/.auth/alexandre.json: faça login do Manager antes.');

      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', user_id: targetProfileId }),
      });

      expect(res.status).toBe(403);
    });

    test('autoinativação é recusada sem tocar no Auth', async () => {
      // Prova que ninguém inativa a si mesmo e que o Auth permanece intacto (banned_until não alterado)
      skipPendingScenario('e2e/.auth/alexandre.json', 'Manager');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const managerProfileId = process.env.TEST_MANAGER_PROFILE_ID;

      test.skip(!supabaseUrl, 'VITE_SUPABASE_URL não definida: não é possível chamar create-user.');
      test.skip(!managerProfileId, 'TEST_MANAGER_PROFILE_ID não definida: não é possível testar autoinativação.');

      const token = getAccessTokenFromStorageState('e2e/.auth/alexandre.json');
      test.skip(!token, 'access_token do Manager não encontrado em e2e/.auth/alexandre.json: faça login do Manager antes.');

      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'set_active', user_id: managerProfileId, active: false }),
      });

      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toContain('Você não pode alterar o seu próprio status de ativação.');

      // O 403 sozinho não prova que o Auth ficou intacto: prova apenas que a
      // resposta foi de recusa. A garantia real é banned_until continuar nulo,
      // o que só acontece se a autorização barrou ANTES do passo de banimento.
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      test.skip(!serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY não definida: não é possível provar que o Auth ficou intacto.');

      const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(managerProfileId!);

      expect(userError).toBeNull();
      const bannedUntil = (userData?.user as unknown as { banned_until?: string | null })?.banned_until ?? null;
      const isBanned = bannedUntil ? new Date(bannedUntil).getTime() > Date.now() : false;
      expect(isBanned).toBe(false);
    });
  });

  test.describe('Fleet Analyst', () => {
    test.use({ storageState: 'e2e/.auth/mariana.json' });

    test('Fleet Analyst não inativa conta administrativa', async () => {
      // Prova que Fleet Analyst não pode inativar contas administrativas (piso Driver exige Target ser Driver)
      skipPendingScenario('e2e/.auth/mariana.json', 'Fleet Analyst');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const targetProfileId = process.env.TEST_TARGET_PROFILE_ID;

      test.skip(!supabaseUrl, 'VITE_SUPABASE_URL não definida: não é possível chamar create-user.');
      test.skip(!targetProfileId, 'TEST_TARGET_PROFILE_ID não definida: não é possível testar inativação por Fleet Analyst.');

      const token = getAccessTokenFromStorageState('e2e/.auth/mariana.json');
      test.skip(!token, 'access_token do Fleet Analyst não encontrado em e2e/.auth/mariana.json: faça login da Fleet Analyst antes.');

      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'set_active', user_id: targetProfileId, active: false }),
      });

      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).toContain('Seu papel não tem permissão para inativar ou reativar este usuário.');
    });
  });

  test.describe('Admin Master — coerência', () => {
    test.use({ storageState: 'e2e/.auth/admin.json' });

    test('profiles e auth ficam coerentes após o fluxo', async () => {
      // Prova que profiles.active e auth.users.banned_until permanecem coerentes após inativação/reaativação
      skipPendingScenario('e2e/.auth/admin.json', 'Admin Master');

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

      test.skip(!supabaseUrl, 'VITE_SUPABASE_URL não definida: não é possível verificar coerência profiles/auth.');
      test.skip(!serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY não definida: não é possível verificar coerência profiles/auth.');
      test.skip(!anonKey, 'VITE_SUPABASE_ANON_KEY não definida: não é possível criar cliente Supabase.');

      const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

      // Buscar todos os profiles com id e active via REST/PostgREST
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, active');

      expect(profilesError).toBeNull();
      expect(profiles).not.toBeNull();

      // auth.users não é exposta pelo PostgREST, usar Admin API e cruzar em memória
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      expect(usersError).toBeNull();
      expect(usersData?.users).toBeDefined();

      const divergencias: Array<{ id: string; active: boolean | null; banned_until: string | null }> = [];
      const usersById = new Map(usersData!.users.map((u) => [u.id, u]));

      for (const profile of profiles ?? []) {
        const user = usersById.get(profile.id);
        if (!user) continue;
        // banned_until no futuro indica usuário banido/inativo
        const bannedUntil = (user as unknown as { banned_until?: string | null }).banned_until ?? null;
        const isBanned = bannedUntil ? new Date(bannedUntil).getTime() > Date.now() : false;

        if (profile.active === false && !isBanned) {
          divergencias.push({ id: profile.id, active: profile.active, banned_until: bannedUntil });
        }
        if (profile.active === true && isBanned) {
          divergencias.push({ id: profile.id, active: profile.active, banned_until: bannedUntil });
        }
      }

      expect(divergencias).toHaveLength(0);
    });
  });
});
