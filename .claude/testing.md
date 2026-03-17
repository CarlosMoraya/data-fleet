# Testes E2E (Playwright)

## Visão Geral

- **61 testes E2E** passando across 4 perfis de autenticação
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
├── tenant-users.spec-analyst-workshops.ts # Oficinas Permissões - Analista
├── shippers-operational-units.spec.ts # Embarcadores + Unidades Operacionais CRUD (3 perfis: Pedro/Mariana/Alexandre) — 16 test cases, dados deixados no DB
└── cross-profile-flows.spec.ts # Fluxos cruzados (auditoria para manutenção)
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

### Serial Execution (Race Conditions)
Para fluxos dependentes (ex: criar -> editar -> deletar), usar `test.describe.serial` e aguardar o DB estabilizar:
```ts
test.describe.serial('Fluxo Crítico', () => {
  // specs...
  await page.waitForTimeout(500); // estabilizar estados asíncronos após post
});
```

### Dialog Handling
```ts
page.on('dialog', (dialog) => dialog.accept()); // antes de triggerar delete
```

## E2E Tests para Embarcadores + Unidades Operacionais (2026-03-17)

**Arquivo**: `e2e/shippers-operational-units.spec.ts` (16 test cases)

### Contexto
- Valida CRUD completo de Embarcadores (Shippers) e Unidades Operacionais com 3 perfis de usuário
- Testa cascading dropdown em VehicleForm (selecionar embarcador filtra unidades)
- Testa FK RESTRICT: não permite deletar embarcador que possui unidades vinculadas
- **Dados deixados intencionalmente no DB** para testes manuais posteriores

### Perfis Testados
| Perfil | Ação |
|--------|------|
| **Pedro** (Fleet Assistant) | Criar 2 embarcadores |
| **Mariana** (Fleet Analyst) | Criar 3 unidades operacionais; testar cascading |
| **Alexandre** (Manager) | Tentar deletar com FK error; deletar órfãos; deletar livremente |

### Test Cases
1. Pedro: Login ✅
2. Pedro: Navigate to Embarcadores ✅
3. Pedro: Create Transportadora A (Embarcador) ✅
4. Pedro: Create Transportadora B ✅
5. Mariana: Login ✅
6. Mariana: Navigate to Unidades Operacionais ✅
7. Mariana: Create Base São Paulo (→ Transportadora A) ✅
8. Mariana: Create Base Rio de Janeiro (→ Transportadora A) ✅
9. Mariana: Create Base Brasília (→ Transportadora B) ✅
10. Mariana: Verify cascading dropdown (unidades filtram por embarcador) ✅
11. Alexandre: Login ✅
12. Alexandre: Try delete Transportadora A (should fail with FK error) ✅
13. Alexandre: Delete Base Brasília (orphan) ✅
14. Alexandre: Delete Transportadora B (now succeeds) ✅
15. Alexandre: Verify data persists (Transportadora A + suas 2 unidades ainda existem)

### Padrões Críticos (Embarcadores)
- **Cascading dropdown**: Selecionar embarcador resets unidade e filtra opções
- **FK RESTRICT**: Error message: "unidades operacionais vinculadas" quando tenta deletar embarcador com unidades
- **Data persistence**: Testes deixam dados em DB para validação manual
- **Modal selectors**: Usar `getByRole('button', {name: '...'})` em vez de `has-text()` para strict mode
