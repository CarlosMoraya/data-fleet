# Testes E2E (Playwright)

## Visão Geral

- **44 testes E2E** passando across 4 perfis de autenticação
- Framework: **Playwright**
- Config: `playwright.config.ts`
- Diretório: `e2e/`

## Comandos

```bash
# Rodar todos os testes
npx playwright test

# Rodar um spec específico
npx playwright test e2e/auth.spec.ts

# Rodar com UI mode
npx playwright test --ui

# Ver relatório HTML
npx playwright show-report
```

## Perfis de Teste

| Project | Role | Auth File | Env Vars | Specs |
|---------|------|-----------|----------|-------|
| `setup` → `chromium` | Admin Master | `e2e/.auth/admin.json` | `TEST_ADMIN_EMAIL/PASSWORD` | auth, access-control, admin-clients, admin-users |
| `setup-mariana` → `analyst` | Fleet Analyst | `e2e/.auth/mariana.json` | `TEST_ANALYST_EMAIL/PASSWORD` | tenant-users.spec.ts |
| `setup-pedro` → `assistant` | Fleet Assistant | `e2e/.auth/pedro.json` | `TEST_ASSISTANT_EMAIL/PASSWORD` | tenant-users-assistant.spec.ts |
| `setup-alexandre` → `manager` | Manager | `e2e/.auth/alexandre.json` | `TEST_MANAGER_EMAIL/PASSWORD` | tenant-users-manager.spec.ts |

## Specs Existentes

```
e2e/
├── setup/
│   ├── admin.setup.ts         # Auth setup Admin Master
│   ├── mariana.setup.ts       # Auth setup Fleet Analyst
│   ├── pedro.setup.ts         # Auth setup Fleet Assistant
│   └── alexandre.setup.ts     # Auth setup Manager
├── .auth/                     # Session storage (gitignored)
├── assets/                    # Documentos de teste (PDF/PNG)
├── auth.spec.ts               # Login/logout flow
├── access-control.spec.ts     # Role-based route access
├── admin-clients.spec.ts      # Client CRUD (Admin Master)
├── admin-users.spec.ts        # User CRUD (Admin Master)
├── tenant-users.spec.ts       # User CRUD (Fleet Analyst)
├── tenant-users-manager-vehicles.spec.ts  # Veículos CRUD + Configs
├── tenant-users-assistant-vehicles.spec.ts # Veículos Permissões
├── tenant-users.spec-analyst.ts # Veículos Permissões - Analista
├── tenant-users-manager-seed.spec.ts # Seeding (Massa de Dados)
├── tenant-users-manager-workshops.spec.ts # Oficinas CRUD (Fluxo Completo)
└── tenant-users.spec-analyst-workshops.ts # Oficinas Permissões - Analista
```

## Configuração

- `workers: 1` — execução sequencial
- `fullyParallel: false`
- `webServer`: inicia `npm run dev` automaticamente na porta 3000
- Credenciais em `.env.local` (dotenv carregado no config)

## Padrões Críticos

### Modal Form (Race Condition)
React `useEffect` reseta o form ao abrir o modal. **Sempre** aguardar antes de preencher:
```ts
const modal = page.locator('.fixed.inset-0');
await expect(modal.locator('h2', { hasText: 'Título' })).toBeVisible();
await modal.locator('input[type="text"]').first().waitFor({ state: 'visible' });
await page.waitForTimeout(300); // aguardar useEffect
await modal.locator('input[type="text"]').first().fill(value);
```

### Strict Mode — Escopar Locators
Evitar locators ambíguos que matcham múltiplos elementos:
```ts
// ERRADO: page.locator(`text=${name}`)
// CERTO:  page.locator('table').getByText(name)
```

### Isolamento de Dados
- `Date.now()` no nível do módulo para dados únicos por run
- Cada teste CRUD: cria → edita → deleta seus próprios dados

### Dialog Handling
```ts
page.on('dialog', (dialog) => dialog.accept()); // antes de triggerar delete
```
