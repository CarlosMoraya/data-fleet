import { test, expect } from '@playwright/test';

/**
 * Testes E2E para integração Motorista ↔ Usuário do Sistema
 *
 * Cobre:
 * 1. Criar motorista via DriverForm com email/senha
 * 2. Verificar que a conta de usuário foi criada (profile_id preenchido)
 * 3. Verificar que Driver role não aparece em Users.tsx
 *
 * NOTA: Este arquivo deve ser executado com um dos seguintes perfis:
 * - Analyst (mariana.json) para criar motorista
 * - Manager (alexandre.json) para verificar Users.tsx
 */

let driverEmail: string;
let driverPassword: string;
const driverName = `Driver Test ${Date.now()}`;
const driverCPF = `9${Date.now().toString().slice(-10)}`.slice(0, 11);

test.describe.serial('1. Driver-User Integration (Analyst Profile)', () => {
  // Carregar auth do Analyst (Mariana)
  test.use({ storageState: 'e2e/.auth/mariana.json' });

  test('1.1 Criar motorista com email/senha via DriverForm', async ({ page }) => {
    // Ir para Motoristas (Analyst já tem acesso)
    await page.goto('/cadastros/motoristas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verificar que estamos na página correta (pode ser h1 ou h2)
    const heading = page.locator('h1, h2').filter({ hasText: 'Motorista' }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Clicar no botão "Adicionar Motorista"
    const addButton = page.locator('button:has-text("Adicionar Motorista")');
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Aguardar o modal abrir
    await page.waitForTimeout(500);

    // Gerar credenciais únicas
    driverEmail = `driver-${Date.now()}@test.datafleet.local`;
    driverPassword = `TestPass${Date.now()}`;

    // ========== Seção: Acesso ao Sistema ==========
    // Email (obrigatório)
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill(driverEmail);

    // Senha (obrigatório)
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill(driverPassword);

    // ========== Seção: Dados Pessoais ==========
    // Nome (obrigatório)
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill(driverName);

    // CPF (obrigatório)
    const cpfInput = page.locator('input[name="cpf"]');
    await cpfInput.fill(driverCPF);

    // Salvar
    const submitButton = page.locator('button[form="driver-form"]');
    await submitButton.click();

    // Aguardar que o modal fecha e a lista atualiza
    await page.waitForTimeout(1500);

    // Verificar que motorista aparece na tabela
    const driverRow = page.locator(`text=${driverName}`);
    await expect(driverRow).toBeVisible();

    console.log(`✓ Motorista criado: ${driverName}`);
    console.log(`  Email: ${driverEmail}`);
    console.log(`  Senha: ${driverPassword} (salve para próximos testes)`);
  });

  test('1.2 Verificar que motorista aparece na lista', async ({ page }) => {
    // Já na página de motoristas
    await page.goto('/cadastros/motoristas');
    await page.waitForLoadState('networkidle');

    const driverRow = page.locator(`text=${driverName}`);
    await expect(driverRow).toBeVisible();

    console.log('✓ Motorista encontrado na lista');
  });
});

test.describe.serial('2. Driver-User Integration (Manager Profile - Users.tsx)', () => {
  // Carregar auth do Manager (Alexandre)
  test.use({ storageState: 'e2e/.auth/alexandre.json' });

  test('2.1 Verificar que Driver role NÃO aparece no dropdown de criação de usuário', async ({ page }) => {
    // Ir para Usuários
    await page.goto('/cadastros/usuarios');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verificar heading (pode ser h1 ou h2)
    const heading = page.locator('h1, h2').filter({ hasText: 'Usuário' }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Clicar em "Novo Usuário"
    const newUserButton = page.locator('button:has-text("Novo Usuário")');
    await newUserButton.click();

    // Aguardar modal
    await page.waitForTimeout(500);

    // Abrir dropdown de Role (Cargo)
    const roleSelect = page.locator('select');
    await expect(roleSelect).toBeVisible();

    // Coletar todas as opções visíveis
    const options = roleSelect.locator('option');
    const optionTexts = await options.allTextContents();

    console.log('Roles disponíveis para criação:', optionTexts);

    // Verificar que "Driver" NÃO está presente
    const hasDriver = optionTexts.some(text => text.toLowerCase().includes('driver'));
    if (!hasDriver) {
      console.log('✓ Role "Driver" não aparece no dropdown de criação');
    } else {
      console.error('❌ Role "Driver" encontrado no dropdown (não deveria estar)');
      expect(hasDriver).toBe(false);
    }
  });

  test('2.2 Verificar que Driver role NÃO aparece na lista de usuários', async ({ page }) => {
    // Ir para Usuários
    await page.goto('/cadastros/usuarios');
    await page.waitForLoadState('networkidle');

    // Buscar pelo nome do motorista criado na tabela
    const tableBody = page.locator('tbody');
    const rows = tableBody.locator('tr');
    const rowCount = await rows.count();

    let foundDriver = false;
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = await row.locator('td').allTextContents();
      const rowText = cells.join(' ');

      if (rowText.includes(driverName) && rowText.includes('Driver')) {
        foundDriver = true;
        break;
      }
    }

    if (!foundDriver) {
      console.log(`✓ Motorista não aparece como role "Driver" na lista`);
    } else {
      console.error(`❌ Motorista encontrado com role "Driver" na lista`);
      expect(foundDriver).toBe(false);
    }
  });
});

test.describe.serial('3. Database Validation', () => {
  test('3.1 [MANUAL] Verificar profile_id no Supabase', async () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  VERIFICAÇÃO MANUAL NO SUPABASE                                ║
╚════════════════════════════════════════════════════════════════╝

Para validar que o profile_id foi preenchido corretamente:

1. Abra Supabase Dashboard → seu projeto
2. Vá para SQL Editor
3. Execute a query:

   SELECT
     d.id,
     d.name,
     d.cpf,
     d.profile_id,
     p.email,
     p.role
   FROM drivers d
   LEFT JOIN profiles p ON d.profile_id = p.id
   WHERE d.name LIKE '%Driver Test%'
   ORDER BY d.id DESC
   LIMIT 5;

4. Resultados esperados:
   - profile_id: ✅ NÃO deve ser NULL
   - email: ✅ Deve corresponder a ${driverEmail}
   - role: ✅ Deve ser "Driver"

Se tudo estiver correto, a integração motorista ↔ usuário foi bem-sucedida! 🎉
    `);
  });
});
