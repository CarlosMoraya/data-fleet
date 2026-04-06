# Guia de Execução de Testes E2E — Beta Fleet

> **Para agentes de IA:** Leia este documento inteiro antes de executar qualquer ação.
> Todo o contexto necessário para criar, executar e reportar os testes está aqui.

---

## 1. Visão Geral

**Projeto:** βetaFleet — SaaS multi-tenant de gestão de frotas  
**Stack:** React 19 + Vite + TypeScript + Supabase  
**Framework:** Playwright (workers: 1, execução serial)  
**Total de testes:** ~197 testes em 35 arquivos spec

### Objetivo deste guia

Executar todos os testes E2E, coletar resultados e gerar um relatório de status em:
```
.claude/reports/test-execution-report-{YYYYMMDD}.md
```

**Regra de ouro:** Se um teste falhar → registrar erro completo → continuar para o próximo. **Nunca corrigir código durante a execução.**

---

## 2. Pré-requisitos

### 2.1 Ambiente

```bash
# Verificar se dev server está rodando
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Esperado: 200

# Se não estiver rodando:
npm run dev &
```

### 2.2 Variáveis de Ambiente (`.env.local`)

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima

# Credenciais dos usuários de teste (6 perfis)
TEST_ADMIN_EMAIL=...        TEST_ADMIN_PASSWORD=...
TEST_ANALYST_EMAIL=...      TEST_ANALYST_PASSWORD=...
TEST_ASSISTANT_EMAIL=...    TEST_ASSISTANT_PASSWORD=...
TEST_MANAGER_EMAIL=...      TEST_MANAGER_PASSWORD=...
TEST_AUDITOR_EMAIL=...      TEST_AUDITOR_PASSWORD=...
TEST_DRIVER_EMAIL=...       TEST_DRIVER_PASSWORD=...
```

### 2.3 Arquivos de Autenticação (`.auth/`)

Os arquivos abaixo são gerados automaticamente na primeira execução dos setups:

```
e2e/.auth/admin.json      # Admin Master
e2e/.auth/mariana.json    # Fleet Analyst
e2e/.auth/pedro.json      # Fleet Assistant
e2e/.auth/alexandre.json  # Manager
e2e/.auth/carlos.json     # Auditor
e2e/.auth/jorge.json      # Driver
```

Se não existirem, rodar os setups primeiro:
```bash
npx playwright test --project=setup
npx playwright test --project=setup-mariana
npx playwright test --project=setup-pedro
npx playwright test --project=setup-alexandre
npx playwright test --project=setup-carlos
npx playwright test --project=setup-jorge
```

---

## 3. Perfis de Usuário (Roles)

| Perfil | Role | Env | StorageState | Arquivo Auth |
|--------|------|-----|--------------|--------------|
| Admin Master | Admin Master | TEST_ADMIN_* | admin.json | admin.setup.ts |
| Mariana | Fleet Analyst | TEST_ANALYST_* | mariana.json | mariana.setup.ts |
| Pedro | Fleet Assistant | TEST_ASSISTANT_* | pedro.json | pedro.setup.ts |
| Alexandre | Manager | TEST_MANAGER_* | alexandre.json | alexandre.setup.ts |
| Carlos | Auditor | TEST_AUDITOR_* | carlos.json | carlos.setup.ts |
| Jorge | Driver | TEST_DRIVER_* | jorge.json | jorge.setup.ts |

---

## 4. Projetos Playwright e Mapeamento de Specs

| Projeto | StorageState | testMatch | testIgnore |
|---------|--------------|-----------|------------|
| `chromium` | admin.json | todos exceto `tenant-users*` | `tenant-users` |
| `analyst` | mariana.json | `tenant-users(-analyst*)?`, `audit-admin-tenant` | `seed` |
| `assistant` | pedro.json | `tenant-users-assistant*`, `audit-admin-tenant` | `seed` |
| `assistant-actions` | pedro.json | `tenant-users-assistant-actions` | — |
| `manager` | alexandre.json | `tenant-users-manager*`, `audit-admin-tenant` | `seed` |
| `auditor` | carlos.json | `auditor-flow` | — |
| `driver` | jorge.json | `driver-flow` | — |

---

## 5. Tabela Mestre de Todos os Testes

| # | Módulo | Arquivo Spec | Testes | Projeto | Tipo |
|---|--------|--------------|--------|---------|------|
| 1 | Autenticação | auth.spec.ts | 3 | chromium | Login/Logout |
| 2 | Controle de Acesso | access-control.spec.ts | 4 | chromium | RBAC routes |
| 3 | Checklists (Admin) | admin-checklist-delete.spec.ts | 3 | chromium | Exclusão |
| 4 | Clientes | admin-clients.spec.ts | 6 | chromium | CRUD |
| 5 | Usuários (Admin) | admin-users.spec.ts | 7 | chromium | CRUD |
| 6 | Auditoria Admin Master | audit-admin-master.spec.ts | 7 | chromium | Fluxo completo |
| 7 | Auditoria Tenant | audit-admin-tenant.spec.ts | 5 | analyst/assistant/manager | Multi-perfil |
| 8 | Fluxo Auditor | audit-auditor-flow.spec.ts | 4 | auditor | Fluxo |
| 9 | Fluxo Driver | audit-driver-flow.spec.ts | 3 | driver | Fluxo |
| 10 | Fluxos Cruzados | cross-profile-flows.spec.ts | 3 | analyst | Integração |
| 11 | Integração Driver | driver-user-integration.spec.ts | 5 | analyst | Integração |
| 12 | Novos Roles (Coord/Sup) | new-roles-audit.spec.ts | 36 | chromium | Auditoria permissões |
| 13 | Embarcadores | shippers-operational-units.spec.ts | 5 | chromium | CRUD + FK |
| 14 | Usuários (Analyst) | tenant-users.spec.ts | 8 | analyst | CRUD |
| 15 | Drivers (Analyst) | tenant-users-analyst-drivers.spec.ts | 1 | analyst | Seed |
| 16 | Seed Pesado (Analyst) | tenant-users-analyst-heavy-seed.spec.ts | 1 | analyst | Seed |
| 17 | Veículos (Analyst) | tenant-users-analyst-vehicles.spec.ts | 1 | analyst | Seed |
| 18 | Oficinas (Analyst) | tenant-users-analyst-workshops.spec.ts | 2 | analyst | Seed |
| 19 | Ações (Assistant) | tenant-users-assistant-actions.spec.ts | 5 | assistant-actions | Plano de Ação |
| 20 | Drivers (Assistant) | tenant-users-assistant-drivers.spec.ts | 1 | assistant | Seed |
| 21 | Seed Pesado (Assistant) | tenant-users-assistant-heavy-seed.spec.ts | 2 | assistant | Seed |
| 22 | Manutenção | tenant-users-assistant-maintenance.spec.ts | 7 | assistant | Agendamento→OS |
| 23 | **[NOVO] Pneus (Assistant)** | **tenant-users-assistant-tires.spec.ts** | **2** | **assistant** | **Permissões** |
| 24 | Permissões (Assistant) | tenant-users-assistant.spec.ts | 6 | assistant | CRUD |
| 25 | Veículos (Assistant) | tenant-users-assistant-vehicles.spec.ts | 2 | assistant | Seed |
| 26 | **[NOVO] Axle Config** | **tenant-users-manager-axle-config.spec.ts** | **12** | **manager** | **Configuração Eixos** |
| 27 | Templates Checklist | tenant-users-manager-checklist-templates.spec.ts | 7 | manager | CRUD |
| 28 | Drivers (Manager) | tenant-users-manager-drivers.spec.ts | 1 | manager | CRUD |
| 29 | Seed (Manager) | tenant-users-manager-seed.spec.ts | 1 | manager | Seed |
| 30 | Seed Drivers (Manager) | tenant-users-manager-seed-drivers.spec.ts | 1 | manager | Seed |
| 31 | **[NOVO] Pneus (Manager)** | **tenant-users-manager-tires.spec.ts** | **14** | **manager** | **CRUD completo** |
| 32 | Veículos (Manager) | tenant-users-manager-vehicles.spec.ts | 4 | manager | CRUD + Config |
| 33 | Partnership Oficinas | tenant-users-manager-workshop-partnership.spec.ts | 14 | manager | Partnership |
| 34 | Oficinas (Manager) | tenant-users-manager-workshops.spec.ts | 6 | manager | CRUD |
| 35 | Usuários (Manager) | tenant-users-manager.spec.ts | 6 | manager | CRUD |

**TOTAL: ~197 testes em 35 arquivos spec**

---

## 6. Padrões Críticos (Ler Antes de Criar/Editar Specs)

### 6.1 Race Condition em Modais

Sempre aguardar antes de preencher formulários em modais:

```typescript
const modal = page.locator('.fixed.inset-0');
await expect(modal.locator('h2', { hasText: 'Título do Modal' })).toBeVisible({ timeout: 5000 });
await modal.locator('input').first().waitFor({ state: 'visible' });
await page.waitForTimeout(300); // aguardar useEffect do formulário React
await modal.locator('input[name="campo"]').fill('valor');
```

### 6.2 Testes Seriais com Skip Condicional

Para fluxos que dependem de dados criados por testes anteriores:

```typescript
test.describe.serial('Fluxo Completo', () => {
  test('01 — seed: criar dados', async ({ page }) => {
    const count = await page.locator('select option').count();
    if (count < 2) {
      test.skip(true, 'Nenhum dado disponível — rode o seed primeiro');
      return;
    }
    // criar dados...
  });

  test('02 — usar dados criados em 01', async ({ page }) => {
    // assume que 01 criou os dados
  });
});
```

### 6.3 Padrão rec() / writeReport() para Relatório

**Todo spec novo DEVE incluir este padrão:**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const ALL_TESTS: { id: string; name: string }[] = [
  { id: '01', name: 'descrição do teste' },
  // ...
];

const recorded = new Map<string, { status: '✅ PASSOU' | '❌ FALHOU'; error: string }>();

function rec(id: string) {
  return {
    pass() { recorded.set(id, { status: '✅ PASSOU', error: '—' }); },
    fail(e: unknown) {
      const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e);
      recorded.set(id, { status: '❌ FALHOU', error: msg });
      throw e; // Relança para Playwright marcar como failed
    },
  };
}

function writeReport() {
  const reportDir = path.join(process.cwd(), '.claude', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const rows = ALL_TESTS.map((t) => {
    const r = recorded.get(t.id);
    if (!r) return `| ${t.id} | ${t.name} | ⏭️ PULADO | — |`;
    return `| ${t.id} | ${t.name} | ${r.status} | ${r.error} |`;
  }).join('\n');

  const bugs = ALL_TESTS.filter((t) => recorded.get(t.id)?.status === '❌ FALHOU');
  const passed = [...recorded.values()].filter((r) => r.status === '✅ PASSOU').length;
  const failed = bugs.length;
  const skipped = ALL_TESTS.length - recorded.size;

  const bugsSection = bugs.length === 0
    ? '_Nenhum bug encontrado._'
    : bugs.map((t) => `- **Teste ${t.id} — ${t.name}**: ${recorded.get(t.id)!.error}`).join('\n');

  const report = [
    `# Relatório E2E — {Nome do Módulo}`,
    `Data: ${date}`,
    '',
    `**Resumo:** ${passed} passaram · ${failed} falharam · ${skipped} pulados`,
    '',
    '## Resultados',
    '',
    '| # | Teste | Status | Erro |',
    '|---|-------|--------|------|',
    rows,
    '',
    '## Bugs Encontrados',
    '',
    bugsSection,
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, '{nome-modulo}-report.md'), report, 'utf-8');
}

// No describe:
test.afterAll(() => { writeReport(); });

// Em cada test:
test('01 — descrição', async ({ page }) => {
  const r = rec('01');
  try {
    // assertions...
    r.pass();
  } catch (e) {
    r.fail(e);
  }
});
```

### 6.4 Locators Confiáveis

```typescript
// ✅ CORRETO — específico e sem ambiguidade
page.locator('table').getByText('Nome do Item')
page.locator('tr', { hasText: 'Dado Específico' }).locator('button[title="Editar"]')
page.locator('.fixed.inset-0').locator('h2', { hasText: 'Título' })

// ❌ ERRADO — pode ser ambíguo
page.locator(`text=${name}`)       // pode pegar múltiplos elementos
page.locator('button').first()     // frágil, depende de ordem

// Timeouts
await expect(page.locator('h1')).toBeVisible({ timeout: 15000 }); // carga inicial
await expect(modal).not.toBeVisible({ timeout: 5000 });            // fechar modal
```

### 6.5 Dados Únicos por Execução

```typescript
const UID = Date.now().toString().slice(-6);
const TEST_NAME = `E2E Item ${UID}`;
const TEST_EMAIL = `e2e-${UID}@teste.com`;
// Garante que cada execução cria dados diferentes, sem conflito
```

---

## 7. Protocolo de Execução para Agente IA

> Siga estas fases na ordem. Não pule etapas. Nunca corrija código quando um teste falhar.

### FASE 1 — Inicialização (TodoWrite)

Criar task list com todos os módulos:

```
TodoWrite:
- [ ] FASE 1: Verificar pré-requisitos
- [ ] FASE 2: Verificar specs existentes
- [ ] FASE 3: Executar chromium (Admin Master)
- [ ] FASE 4: Executar manager (Alexandre)
- [ ] FASE 5: Executar assistant (Pedro)
- [ ] FASE 6: Executar analyst (Mariana)
- [ ] FASE 7: Executar auditor (Carlos)
- [ ] FASE 8: Executar driver (Jorge)
- [ ] FASE 9: Gerar relatório consolidado
```

### FASE 2 — Verificar Pré-requisitos

```bash
# 1. Dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# 2. Arquivos de auth
ls e2e/.auth/

# 3. Variáveis de ambiente
grep "TEST_" .env.local | wc -l
# Deve retornar >= 12 (6 pares de email/senha)
```

Se algum arquivo `.auth/` estiver faltando, rodar o setup correspondente antes de continuar.

### FASE 3 — Executar Testes por Projeto

**Comandos de execução individuais:**

```bash
# Projeto chromium (Admin Master) — auth, admin, auditoria, novos roles
npx playwright test --project=chromium 2>&1

# Projeto manager (Alexandre) — veículos, oficinas, manutenção, pneus, eixos
npx playwright test --project=manager 2>&1

# Projeto assistant (Pedro) — permissões, manutenção, pneus
npx playwright test --project=assistant 2>&1

# Projeto assistant-actions (Pedro) — plano de ação
npx playwright test --project=assistant-actions 2>&1

# Projeto analyst (Mariana) — usuários, veículos, seeds
npx playwright test --project=analyst 2>&1

# Projeto auditor (Carlos)
npx playwright test --project=auditor 2>&1

# Projeto driver (Jorge)
npx playwright test --project=driver 2>&1
```

**Para executar um spec individual:**

```bash
npx playwright test e2e/tenant-users-manager-tires.spec.ts --project=manager 2>&1
```

**Para extrair resumo do output:**

O output do Playwright contém no final algo como:
```
  197 passed (5m)
  # ou
  180 passed, 17 failed (5m)
```

### FASE 4 — Coletar Resultados

Para cada spec executado, registrar:
- **Passou**: número de testes `passed`
- **Falhou**: número de testes `failed` + mensagem de erro de cada falha
- **Pulado**: número de testes `skipped`

Relatórios individuais gerados automaticamente em:
```
.claude/reports/workshop-partnership-report.md
.claude/reports/tire-management-report.md
.claude/reports/tire-management-assistant-report.md
.claude/reports/axle-config-report.md
```

### FASE 5 — Gerar Relatório Consolidado

Criar arquivo `.claude/reports/test-execution-report-{YYYYMMDD}.md` com a estrutura abaixo.

**Formato do Relatório Consolidado:**

```markdown
# Relatório de Execução de Testes E2E — Beta Fleet
Data: {data e hora}
Executado por: {modelo de IA}
Duração total: {tempo}

---

## Resumo Geral

| Métrica | Valor |
|---------|-------|
| Total de Testes | {N} |
| ✅ Passaram | {N} |
| ❌ Falharam | {N} |
| ⏭️ Pulados | {N} |
| Taxa de Sucesso | {%} |

---

## Resultados por Módulo

| Módulo | Spec | Projeto | Testes | ✅ | ❌ | ⏭️ | Status |
|--------|------|---------|--------|---|---|---|--------|
| Autenticação | auth.spec.ts | chromium | 3 | 3 | 0 | 0 | ✅ |
| ... | ... | ... | ... | ... | ... | ... | ... |

---

## Falhas Detalhadas

### {Nome do Módulo} — {Spec}

| Teste | Erro |
|-------|------|
| {id} — {nome} | {mensagem de erro} |

---

## Módulos com Atenção

### ✅ Módulos 100% Funcionais
- Lista de specs que passaram todos os testes

### ❌ Módulos com Falhas Críticas
- Lista de specs com falhas + resumo do problema

### ⚠️ Módulos com Testes Pulados
- Lista de specs com skips + motivo (geralmente: dados insuficientes)

---

## Ações Recomendadas

1. **Crítico** — {descrição do problema mais grave}
2. **Médio** — {problema secundário}
3. **Baixo** — {melhoria opcional}

---

## Relatórios Individuais Disponíveis

- [Workshop Partnership](.claude/reports/workshop-partnership-report.md)
- [Tire Management — Manager](.claude/reports/tire-management-report.md)
- [Tire Management — Assistant](.claude/reports/tire-management-assistant-report.md)
- [Axle Configuration](.claude/reports/axle-config-report.md)
```

### FASE 6 — Finalização

```
TodoWrite: marcar todos os itens como completed
Informar o usuário: caminho do relatório final + resumo dos resultados
```

---

## 8. Specs de Seed (Ordem de Execução Recomendada)

Alguns specs criam dados que outros dependem. Executar na ordem:

```
1. tenant-users-manager-seed.spec.ts        → cria dados base (Manager)
2. tenant-users-manager-seed-drivers.spec.ts → cria drivers (Manager)
3. tenant-users-analyst-heavy-seed.spec.ts   → cria veículos pesados (Analyst)
4. tenant-users-assistant-heavy-seed.spec.ts → adiciona dados de veículos (Assistant)
5. tenant-users-analyst-drivers.spec.ts      → cria drivers (Analyst)
6. tenant-users-analyst-vehicles.spec.ts     → cria veículos (Analyst)
7. tenant-users-analyst-workshops.spec.ts    → cria oficinas (Analyst)
8. tenant-users-assistant-drivers.spec.ts    → cria drivers (Assistant)
9. tenant-users-assistant-vehicles.spec.ts   → cria veículos (Assistant)
```

Para executar seeds do manager:
```bash
npx playwright test e2e/tenant-users-manager-seed.spec.ts --project=manager 2>&1
```

---

## 9. Troubleshooting Comum

| Problema | Causa Provável | Solução |
|----------|---------------|---------|
| Teste pulado com "Nenhum veículo disponível" | Seeds não executados | Rodar specs de seed primeiro |
| `.auth/xxx.json` não encontrado | Setup não executado | `npx playwright test --project=setup-xxx` |
| Timeout em `toBeVisible` | Dev server lento ou não rodando | Verificar `localhost:3000` |
| "Sessão inválida" em mutations | Token expirado | Re-executar setup do perfil |
| Modal race condition | useEffect do React | Adicionar `await page.waitForTimeout(300)` após abrir modal |
| Strict mode — multiple elements | Locator ambíguo | Usar `.locator('table').getByText()` em vez de `.getByText()` |

---

## 10. Visualizar Relatório HTML do Playwright

```bash
# Após executar os testes:
npx playwright show-report

# O relatório abre no browser com:
# - Lista de todos os testes por status
# - Screenshots das falhas
# - Traces para replay da execução
# - Filtros por status, projeto, duração
```

---

## 11. Arquitetura de Arquivos de Teste

```
e2e/
├── setup/
│   ├── admin.setup.ts
│   ├── mariana.setup.ts       # Fleet Analyst
│   ├── pedro.setup.ts         # Fleet Assistant
│   ├── alexandre.setup.ts     # Manager
│   ├── carlos.setup.ts        # Auditor
│   └── jorge.setup.ts         # Driver
├── .auth/                      # [gitignored] Tokens de sessão
│   ├── admin.json
│   ├── mariana.json
│   ├── pedro.json
│   ├── alexandre.json
│   ├── carlos.json
│   └── jorge.json
├── assets/                     # Arquivos para upload em testes
│   ├── test-document.pdf
│   └── test-image.png
├── TEST_EXECUTION_GUIDE.md     # Este arquivo
│
│   # ── Testes existentes ──
├── auth.spec.ts
├── access-control.spec.ts
├── admin-checklist-delete.spec.ts
├── admin-clients.spec.ts
├── admin-users.spec.ts
├── audit-admin-master.spec.ts
├── audit-admin-tenant.spec.ts
├── audit-auditor-flow.spec.ts
├── audit-driver-flow.spec.ts
├── cross-profile-flows.spec.ts
├── driver-user-integration.spec.ts
├── new-roles-audit.spec.ts
├── shippers-operational-units.spec.ts
├── tenant-users.spec.ts
├── tenant-users-analyst-drivers.spec.ts
├── tenant-users-analyst-heavy-seed.spec.ts
├── tenant-users-analyst-vehicles.spec.ts
├── tenant-users-analyst-workshops.spec.ts
├── tenant-users-assistant-actions.spec.ts
├── tenant-users-assistant-drivers.spec.ts
├── tenant-users-assistant-heavy-seed.spec.ts
├── tenant-users-assistant-maintenance.spec.ts
├── tenant-users-assistant.spec.ts
├── tenant-users-assistant-vehicles.spec.ts
├── tenant-users-manager-checklist-templates.spec.ts
├── tenant-users-manager-drivers.spec.ts
├── tenant-users-manager-seed.spec.ts
├── tenant-users-manager-seed-drivers.spec.ts
├── tenant-users-manager-vehicles.spec.ts
├── tenant-users-manager-workshop-partnership.spec.ts
├── tenant-users-manager-workshops.spec.ts
├── tenant-users-manager.spec.ts
│
│   # ── Testes novos (criados por este guia) ──
├── tenant-users-assistant-tires.spec.ts      # [NOVO] Pneus — permissões Assistant
├── tenant-users-manager-axle-config.spec.ts  # [NOVO] Configuração de Eixos
└── tenant-users-manager-tires.spec.ts        # [NOVO] Pneus — CRUD Manager
```

---

*Documento criado em 2026-04-05. Manter atualizado ao criar novos specs.*
