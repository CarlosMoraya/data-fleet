# CLAUDE.md — Context Router

> **Instrução de Entrada**: Sempre leia este índice antes de qualquer ação. Identifique a categoria da tarefa e carregue o módulo de contexto correspondente ANTES de codificar.

---

## Atalhos Rápidos

```bash
npm run dev              # Dev server (porta 3000)
npm run lint             # Type-check (tsc --noEmit)
npm run build            # Build produção
npm run preview          # Preview do build
npm run test:e2e         # Rodar todos os testes E2E (Playwright)
npm run test:e2e:ui      # Abrir Playwright UI para debugging
npm run test:e2e:report  # Visualizar relatório HTML de últimas execuções
npm run test:shippers    # Rodar apenas testes de embarcadores
npm run migrate:shippers # Executar migration de dados de embarcadores
```

---

## Configuração de Ambiente

**Requisitos:**
- Node.js 18+
- Conta Supabase com projeto criado

**Passos Iniciais:**

1. Clone o repositório e instale dependências:
   ```bash
   npm install
   ```

2. Crie arquivo `.env.local` na raiz do projeto:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   GEMINI_API_KEY=sua-chave-gemini  # Para funcionalidade OCR
   ```

3. Verifique variáveis no `vite.config.ts` — apenas `VITE_*` são expostas ao navegador.

**Nota sobre Migrations:** Migrations SQL criadas em `supabase/migrations/` são executadas manualmente no **Supabase Dashboard** (SQL Editor). Veja seção "Fluxo de Migrations" abaixo.

---

## Mapa de Roteamento de Contexto

Antes de codificar, carregue o módulo relevante com `cat`:

| Categoria | Quando usar | Comando |
|-----------|-------------|---------|
| **Frontend** | Componentes React, páginas, routing, layout, Tailwind | `cat .claude/arch-frontend.md` |
| **Backend** | Supabase, auth, Edge Functions, RLS, banco de dados | `cat .claude/arch-backend.md` |
| **Testes** | Escrever/rodar E2E, Playwright, fixtures, debugging | `cat .claude/testing.md` |
| **Estilo** | Convenções de código, nomenclatura, padrões React/TS | `cat .claude/style-guide.md` |
| **Modelo de Dados** | Types, interfaces, roles, multi-tenancy, schema | `cat .claude/data-model.md` |

**Regra**: Para tarefas que cruzam múltiplas categorias, carregue todos os módulos relevantes. Ex: criar uma nova página com CRUD Supabase → carregue Frontend + Backend + Modelo de Dados.

---

## Padrões de Testing

**Abordagem:** Testes E2E com Playwright. Sem testes unitários (confiança via type-check e integração real).

**Estrutura:**
```
e2e/
  ├── fixtures/          # Fixtures reutilizáveis (auth, data setup)
  ├── utils/             # Utilitários (loginAs, createVehicle, etc.)
  ├── *.spec.ts          # Testes por funcionalidade
  ├── DRIVER_INTEGRATION_TESTS.md    # Docs de testes de driver
  ├── TESTS_SUMMARY.md              # Resumo de cobertura
```

**Setup & Teardown:**
- Fixtures em `e2e/fixtures/` — loginAs(role), createVehicle(), createChecklist()
- Cada teste usa `test()` do Playwright com page fixture automática
- Ambiente: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` do `.env.local`

**Padrões Comuns:**
1. **Login Multi-role**: Use fixture `loginAs('Driver')` ou `loginAs('Manager')`
2. **Validação Visual**: Espere por seletor + texto: `await page.locator('text=Confirmar').click()`
3. **Data Cleanup**: Migrations de teardown são executadas após cada spec (evita contaminação)
4. **Relatório**: `npm run test:e2e:report` mostra screenshots + traces de falhas

**Exemplo Mínimo:**
```typescript
import { test, expect } from '@playwright/test';

test('Driver pode preencher checklist', async ({ page }) => {
  await loginAs(page, 'Driver');
  await page.goto('/checklists/new');
  await page.fill('input[name="odometerKm"]', '5000');
  await expect(page.locator('text=Checklist salvo')).toBeVisible();
});
```

Consulte `e2e/testing.md` para setup detalhado.

---

## Protocolo de Auto-Sincronização

> **DIRETRIZ RÍGIDA**: Se você alterar ferramentas, bibliotecas, padrões arquiteturais, interfaces, tabelas do banco, configuração de testes ou convenções de código, sua **última ação obrigatória ANTES do commit** deve ser atualizar o módulo correspondente na pasta `.claude/`.

Checklist de sincronização:
- [ ] Adicionou/removeu dependência → atualizar `arch-frontend.md` ou `arch-backend.md`
- [ ] Criou/alterou interface/type → atualizar `data-model.md`
- [ ] Criou/alterou tabela Supabase ou RLS → atualizar `arch-backend.md` + `data-model.md`
- [ ] Adicionou/alterou página ou componente → atualizar `arch-frontend.md`
- [ ] Adicionou/alterou teste E2E → atualizar `testing.md`
- [ ] Mudou convenção ou padrão → atualizar `style-guide.md`

---

## Fluxo de Migrations do Supabase

**Padrão Atual:** Migrations SQL são criadas em `supabase/migrations/` mas **executadas manualmente** via Supabase Dashboard.

**Por que manual?** Projeto usa Supabase sem CLI de deployment automático. Isso garante controle total sobre quando schema é alterado e permite rollback manual se necessário.

**Checklist ao Criar Nova Migration:**

1. Crie arquivo em `supabase/migrations/` com naming: `YYYYMMDDHHMMSS_descricao.sql`
2. Escreva SQL com suporte a múltiplos tenants (use `client_id` em WHERE clauses e RLS policies)
3. Teste localmente contra Supabase dev/sandbox
4. Commit do arquivo
5. **ANTES de mergear:** adicione flag `⚠️ EXECUTAR NO SUPABASE DASHBOARD` ao CLAUDE.md na seção de "Novos Recursos"
6. Após merge, executor (usuário com acesso Supabase) copia SQL do arquivo e executa no **Supabase Dashboard → SQL Editor**
7. Confirme execução com sucesso (sem erros)
8. Remova flag `⚠️` do CLAUDE.md

**Tipos Comuns de Migrations:**
- `ALTER TABLE ... ADD COLUMN` — adiciona campo, declare tipo e constraint
- `CREATE TABLE ... WITH (RLS ENABLED)` — nova tabela sempre com RLS policies
- `CREATE POLICY ... ON table_name` — políticas de segurança por role
- `ALTER TYPE status ADD VALUE 'NewStatus'` — expande enum (APPEND ONLY, sem remover)

**Verificação de RLS:** Após executar, valide que políticas foram criadas corretamente — Admin Master (`client_id = NULL`) frequentemente precisa de `OR role = 'Admin Master'` em WHEREs.

---

## Gestão de Memória (Gatilho /compact)

Após concluir tarefas que envolveram leitura de **2 ou mais módulos de contexto** da pasta `.claude/`, você **DEVE**:

1. Sugerir ao usuário: _"Tarefa concluída. Recomendo executar `/compact` para limpar a janela de contexto e economizar tokens."_
2. Ou executar `/compact` automaticamente se a janela de contexto estiver acima de 70% de utilização.

Isso garante que sessões longas não degradem a qualidade das respostas por saturação de contexto.

---

## Identificação do Projeto

**Data Fleet** — SaaS multi-tenant de gestão de frotas.
Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase.
Para detalhes completos, consulte os módulos em `.claude/`.

---

## Referência Rápida de Papéis (Roles)

Sistema é multi-tenant com 6 papéis por rank (descendente de permissão). **`client_id`** diferencia tenants; **Admin Master** tem `client_id = NULL`.

| Role | Rank | Acesso | Notas |
|------|------|--------|-------|
| **Admin Master** | 0 | Sistema inteiro, todos os clientes | Sem `client_id`; precisa de `OR role = 'Admin Master'` em RLS |
| **Manager** | 2 | Todas as abas do cliente; usuários, oficinas, configurações | Acesso total dentro do tenant |
| **Fleet Assistant** | 3 | Veículos, checklists, manutenção, configurações | Sem acesso a Usuários; pode criar/editar workshops |
| **Supervisor** | 4 | Checklists, manutenção, planos de ação (coordenação) | Apenas leitura de usuários/oficinas |
| **Driver** | 5 | Preenchimento de checklists, dados pessoais | Acesso a veículos atribuídos apenas |
| **Workshop** | 1 | Visão de manutenção, atualiza OS com orçamento/status | Login próprio; acesso a veículos em suas OS |

**Guardrails Comuns:**
- `ROLES_CAN_ACCESS_SETTINGS`: Manager+ (excluir Driver, Supervisor)
- `ROLES_CAN_EDIT_MAINTENANCE`: Manager+, Fleet Assistant, Workshop (update parcial)
- `ROLES_CAN_CREATE_WORKSHOP`: Manager+, Fleet Assistant
- `isWorkshopUser`: Deteta Workshop via `workshopId` em AuthContext — adapta UI (Manutenção apenas, UPDATE parcial)

**Admin Master Gotcha:** Sempre use `OR role = 'Admin Master'` em RLS checks de coluna `client_id`, pois Admin Master tem `client_id = NULL`.

---

## Mapa de Localização de Código — Áreas Principais

| Área | Localização | Módulo Contexto |
|------|-------------|-----------------|
| **Autenticação & Contexto** | `src/context/AuthContext.tsx`, `src/pages/Login.tsx` | Backend + Frontend |
| **Estrutura de Páginas** | `src/pages/` (Dashboard, Vehicles, Drivers, Checklists, Maintenance, etc.) | Frontend |
| **Componentes Reutilizáveis** | `src/components/` (Forms, Modals, Sidebar, Dashboard) | Frontend |
| **Mapeadores de Dados** | `src/lib/*Mappers.ts` (vehicleMappers, checklistMappers, etc.) | Frontend |
| **Queries React-Query** | Inline em páginas; `queryKey` pattern: `['resource', filter1, filter2]` | Frontend |
| **Edge Functions** | `supabase/functions/create-user/`, `supabase/functions/...` | Backend |
| **Migrations & RLS** | `supabase/migrations/`, `supabase/policies/` | Backend |
| **Testes E2E** | `e2e/` (Playwright fixtures, specs, utilities) | Testing |
| **Tipos & Interfaces** | `src/types.ts` (type-safe, sincronizar com DB schema) | Data Model |
| **Estilos Tailwind** | Inline com `className=` + `tailwind.config.ts` | Frontend |

---

## Novos Recursos (2026-03-18) — Km entre Revisões

**Configuração de Km entre Revisões por Veículo:**

- Nova aba "Revisões" em `src/pages/Settings.tsx` — acessível a Fleet Assistant+
- Mostra todos os veículos do cliente com campo para km entre revisões
- Filtros por marca, modelo e categoria (client-side); paginação de 50/página
- Bulk apply: insere o mesmo km em todos os veículos filtrados de uma só vez
- Salva via `.upsert({ onConflict: 'vehicle_id' })` — um round-trip para N alterações
- Guard de página alterado: `ROLES_CAN_ACCESS_SETTINGS` (Fleet Assistant+); abas Veículos/Motoristas condicionais (Manager+)
- Sidebar: "Configurações" agora visível para Fleet Assistant+
- Tabela: `vehicle_km_intervals` (migration: `create_vehicle_km_intervals.sql` — ✅ EXECUTADA NO SUPABASE DASHBOARD)
- Componente: `src/components/VehicleKmIntervalSettings.tsx` (props: clientId, userId)

**Arquivos Modificados:**
- `src/types.ts` — Adicionado `VehicleKmInterval` interface
- `src/pages/Settings.tsx` — Nova aba + role guards atualizados
- `src/components/Sidebar.tsx` — Configurações visível para Fleet Assistant+
- `src/components/VehicleKmIntervalSettings.tsx` — Novo componente
- `supabase/migrations/create_vehicle_km_intervals.sql` — Nova tabela com RLS (✅ executada)
- `.claude/arch-backend.md` — Documentada tabela `vehicle_km_intervals`
- `.claude/arch-frontend.md` — Documentados Settings.tsx e VehicleKmIntervalSettings
- `.claude/data-model.md` — Documentada interface `VehicleKmInterval`

---

## Novos Recursos (2026-03-19)

**Rastreamento de Hodômetro em Checklists:**

1. **Km Inicial em Veículos** — Novo campo obrigatório (configurável por cliente) no cadastro de veículos.
   - Campo: `initialKm` (INTEGER) — baseline para validação de checklists
   - Mapper: Incluído em `src/lib/vehicleMappers.ts` (bidirectional: camelCase ↔ snake_case)
   - UI: Novo input na seção "Propriedade & Rastreamento" em `src/components/VehicleForm.tsx`
   - Config: Campo `initial_km_optional` em `vehicle_field_settings` permite configuração por cliente
   - Migration: `supabase/migrations/add_initial_km_vehicles.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

2. **Hodômetro em Checklists** — Campo obrigatório como **primeira etapa** de todo preenchimento de checklist.
   - Campo: `odometerKm` (INTEGER) — hodômetro do veículo no momento do preenchimento
   - Validação: Não pode ser menor que o último `odometer_km` registrado (ou `initial_km` se nenhum checklist anterior)
   - UI: Seção dedicada em `src/pages/ChecklistFill.tsx` com:
     * Referência visual do último KM registrado (com fallback para `initial_km`)
     * Input numérico com validação em tempo real
     * Bloqueio dos itens até KM ser confirmado (mesmo padrão da seleção de oficina)
     * Badge verde indicando KM confirmado + botão "Alterar"
   - Mapper: Incluído em `src/lib/checklistMappers.ts` com type `odometerKm?: number`
   - Migration: `supabase/migrations/add_odometer_km_checklists.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Sequência de Preenchimento (ChecklistFill.tsx):**
1. Confirmar oficina (se contexto é Entrada/Saída de Oficina)
2. Confirmar hodômetro (novo)
3. Responder todos os itens obrigatórios
4. Finalizar checklist

**Arquivos Modificados:**
- `src/types.ts` — Adicionado `initialKm?: number` em Vehicle, `initialKmOptional` em VehicleFieldSettings, `odometerKm?: number` em Checklist
- `src/lib/vehicleMappers.ts` — Mapeamento completo de initial_km
- `src/lib/checklistMappers.ts` — Mapeamento completo de odometer_km
- `src/lib/fieldSettingsMappers.ts` — Suporte a initial_km_optional com mapa FIELD_TO_SETTING
- `src/components/VehicleForm.tsx` — Novo input para Km Inicial (section "Propriedade & Rastreamento")
- `src/pages/ChecklistFill.tsx` — Lógica e UI do hodômetro com queries para lastOdometerKm e vehicleInitialKm
- `.claude/arch-frontend.md` — Documentado VehicleForm (Km Inicial) e ChecklistFill (hodômetro)
- `.claude/arch-backend.md` — Documentadas novas colunas e migrations

---

## Novos Recursos (2026-03-19) — Acesso de Oficinas Parceiras

**Workshop Login e Visão de Manutenção:**

- Novo role `'Workshop'` (rank 1) — oficinas parceiras acessam o sistema com login próprio
- Fluxo de criação: Fleet Assistant+ cria workshop com campos opcionais `loginEmail + loginPassword`
- Edge Function `create-user` suporta get-or-create semântico para Workshop (como Driver)
- Tabela `workshops` nova coluna: `profile_id UUID FK → profiles(id)` — liga workshop ao perfil do usuário
- `AuthContext.tsx` busca `workshopId` ao fazer login com role 'Workshop'
- Sidebar: Workshop vê apenas "Manutenção"; redirect HomeRedirect → `/manutencao`
- Maintenance.tsx:
  - Query filtra por `workshop_id` quando Workshop
  - Botão "Nova Manutenção" oculto para Workshop
  - Coluna OS mostra `workshopOs` em vez de `os` para Workshop
  - UPDATE parcial: Workshop atualiza apenas `expected_exit_date, workshop_os_number, mechanic_name, current_km`
- MaintenanceForm.tsx:
  - Novo prop `mode?: 'default' | 'workshop'`
  - Modo Workshop: 4 campos obrigatórios (expectedExitDate, workshopOs, mechanicName, currentKm) + PDF obrigatório
  - Botão: "Enviar Orçamento" (Workshop) vs "Criar/Editar Manutenção" (padrão)
- WorkshopForm.tsx:
  - Seção "Acesso ao Sistema" apenas na criação (loginEmail, loginPassword opcionais)
  - Badge "Com/Sem acesso ao sistema" na edição
- RLS: Múltiplas migrations para suportar Workshop
  - `20260319100000_add_workshop_login.sql`: role 'Workshop' em CHECK, role_rank(1), profile_id em workshops, policies de maintenance_orders/items
  - `fix_workshop_vehicles_rls.sql`: policy SELECT em vehicles para Workshop (acesso a veículos em suas OS)

**Arquivos Modificados:**
- `src/types.ts` — 'Workshop' em Role, workshopId em User, profileId em Workshop
- `src/context/AuthContext.tsx` — busca workshopId para role Workshop
- `supabase/functions/create-user/index.ts` — Workshop rank 1, get-or-create semântico
- `src/components/WorkshopForm.tsx` — loginEmail/loginPassword opcionais, badge acesso
- `src/lib/workshopMappers.ts` — profileId mapeado
- `src/pages/Workshops.tsx` — saveMutation chama create-user se login fornecido
- `src/components/Sidebar.tsx` — 'Workshop' em Manutenção roles
- `src/App.tsx` — HomeRedirect para Workshop → /manutencao
- `src/pages/Maintenance.tsx` — isWorkshopUser, query/UPDATE/UI adaptativos
- `src/components/MaintenanceForm.tsx` — modo='workshop' com 4 campos + PDF obrigatório
- `.claude/data-model.md` — Role union, User.workshopId, Workshop.profileId
- `.claude/arch-backend.md` — workshops.profile_id, migrations 20260319100000 + fix_workshop_vehicles_rls
- `.claude/arch-frontend.md` — WorkshopForm, MaintenanceForm, Maintenance adaptações

**Pendente Execução Manual (Supabase Dashboard):**
1. `supabase/migrations/20260319100000_add_workshop_login.sql` — role check, role_rank, profile_id, RLS
2. `supabase/migrations/fix_workshop_vehicles_rls.sql` — vehicles SELECT policy para Workshop
3. Republicar Edge Function `create-user` com suporte Workshop

---

## Novos Recursos (2026-03-19) — Intervalo em Dias entre Checklists

**Configuração de Intervalo entre Checklists de Rotina e Segurança:**

- Nova aba "Checklists" em `src/pages/Settings.tsx` — acessível a Fleet Assistant+
- Configuração global por cliente (não por veículo) do intervalo em dias entre checklists consecutivos
- Dois campos: intervalo máximo em dias para Rotina e intervalo máximo em dias para Segurança
- Campos opcionais (podem ser deixados em branco = não configurado)
- Informativo — valores usados futuramente para gerar alertas de checklists em atraso
- Tabela: `checklist_day_intervals` (migration: `create_checklist_day_intervals.sql` — ⚠️ EXECUTAR NO SUPABASE DASHBOARD)
- Componente: `src/components/ChecklistDayIntervalSettings.tsx` (props: clientId, userId)
- Padrão de upsert: `onConflict: 'client_id'` — cria ou atualiza em um round-trip

**Arquivos Modificados:**
- `src/types.ts` — Adicionado `ChecklistDayInterval` interface
- `src/pages/Settings.tsx` — Nova aba "Checklists" com import do componente, TabType expandido, tabs array com novo item
- `src/components/ChecklistDayIntervalSettings.tsx` — Novo componente com validação inline
- `supabase/migrations/create_checklist_day_intervals.sql` — Nova tabela com RLS
- `.claude/data-model.md` — Documentada tabela `checklist_day_intervals` e interface `ChecklistDayInterval`
- `.claude/arch-backend.md` — Documentada tabela `checklist_day_intervals` + migration
- `.claude/arch-frontend.md` — Documentado componente `ChecklistDayIntervalSettings` + Settings.tsx description

---

## Correções Recentes (2026-03-18)

**Correções de Bugs de Multi-Tenancy e RLS:**

1. **Maintenance.tsx** — Query não filtrava por `client_id` quando cliente era selecionado no dropdown. Admin Master via sempre os mesmos dados (Grupo LLE) independente do cliente selecionado.
   - Alteração: Adicionado `.eq('client_id', currentClient.id)` na query quando `currentClient?.id` existe
   - Arquivo: `src/pages/Maintenance.tsx`

2. **BudgetApprovals.tsx** — Mesmo problema: query sem filtro por `client_id`. Removido também o `enabled: expanded` desnecessário que fazia subtotal sumir após refresh.
   - Alteração: Adicionado filtro `client_id` + removido `enabled: expanded` de budgetItems query
   - Arquivo: `src/pages/BudgetApprovals.tsx`

3. **Users.tsx + AdminUsers.tsx** — Token JWT expirado ao editar usuário (erro "JWT expired"). SDK do Supabase não fazia refresh automático antes de operações críticas.
   - Alteração: Adicionado `await supabase.auth.refreshSession()` antes do `.update()` nas mutations
   - Arquivos: `src/pages/Users.tsx`, `src/pages/AdminUsers.tsx`

4. **CreateActionPlanModal.tsx** — Admin Master bloqueado de criar planos de ação por bug de RLS no banco.
   - Alteração: Melhorado tratamento de erro para exibir mensagem real do Supabase (não genérica)
   - Arquivo: `src/components/CreateActionPlanModal.tsx`
   - **Correção de BD**: Nova migration `supabase/migrations/fix_action_plans_admin_master_rls.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Causa Raiz de action_plans RLS:**
- Admin Master tem `client_id = NULL` no profile
- Migration `add_supervisor_coordinator_roles.sql` usava `client_id IN (SELECT client_id FROM profiles WHERE ... OR role = 'Admin Master')`
- Em SQL, `coluna IN (NULL)` é sempre UNKNOWN (nunca TRUE) → Admin Master ficava bloqueado
- Solução: Usar `EXISTS` com check direto `p.role = 'Admin Master'` em vez de depender de `client_id`

---

## Novos Recursos (2026-03-19) — Dashboard com Painéis Operacional e de Custos

**Dashboard Completo com KPIs Reais e Gráficos Interativos:**

- Dois painéis (abas): **Painel Operacional** e **Painel de Custos de Manutenção**
- Gráficos interativos que atuam como filtros (click = toggle filtro)
- Filtros aditivos (AND) compartilhados entre painéis: `vehicleType` + `maintenanceType`

**Painel Operacional — 5 KPIs:**
1. **Total de Veículos** (Truck, azul) — contagem de veículos filtrados
2. **Em Manutenção** (Wrench, âmbar) — OS com `status !== 'Concluído'`
3. **Checklists Vencidos** (CalendarDays, vermelho) — veículos cuja última checklist de Rotina ou Segurança ultrapassa intervalo em `checklist_day_intervals`
4. **CRLVs Vencidos** (FileWarning, laranja) — veículos com `crlv_year < ano atual`
5. **CNHs Vencidas** (UserX, vermelho) — motoristas com `expiration_date < hoje`

**Painel Operacional — 2 Gráficos:**
- Barras: veículos por tipo (8 tipos)
- Rosca: contagem de OS por tipo de manutenção (Corretiva/Preventiva/Preditiva)

**Painel de Custos — 3 KPIs:**
1. **Custo Total** (DollarSign, verde) — `SUM(approved_cost)` de OS com custo aprovado
2. **Custo por Veículo** (Truck, azul) — Custo Total / nº de veículos distintos com OS
3. **Custo por KM** (Gauge, roxo) — Custo Total / km total agregado (por veículo: MAX(current_km) - initial_km)

**Painel de Custos — 2 Gráficos:**
- Barras: custo por tipo de veículo
- Rosca: custo por tipo de manutenção

**Arquivos Criados:**
- `src/components/dashboard/DashboardKpiCard.tsx` — Card reutilizável (icon, label, value, subtitle, isAlert)
- `src/components/dashboard/VehicleTypeBarChart.tsx` — Gráfico de barras com click=filtro; click novamente limpa
- `src/components/dashboard/MaintenanceTypeDonutChart.tsx` — Gráfico de rosca com click=filtro; cores: Corretiva=#ef4444, Preventiva=#3b82f6, Preditiva=#8b5cf6
- `src/components/dashboard/OperationalPanel.tsx` — 5 KPIs + 2 gráficos; exporta interfaces VehicleRow, MaintenanceOrderDashboard, DashboardFilters
- `src/components/dashboard/CostPanel.tsx` — 3 KPIs + 2 gráficos; cálculo de cost per KM

**Arquivo Modificado:**
- `src/pages/Dashboard.tsx` — Reescrito: 5 queries (dashboard-vehicles, dashboard-maintenance, dashboard-checklists, dashboard-intervals, dashboard-drivers); state de filtros lifted; abas + loading state; cálculo de overdue checklists via useMemo

**Arquivos de Migração:**
- `supabase/migrations/fix_vehicles_admin_master_rls.sql` — Corrige SELECT RLS em vehicles table para incluir `OR role = 'Admin Master'` (Admin Master tem client_id = NULL, precisava de exceção especial como em maintenance_orders e action_plans). **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Queries (react-query):**
```ts
dashboard-vehicles    → vehicles: SELECT id, type, crlv_year, driver_id
dashboard-maintenance → maintenance_orders: SELECT id, vehicle_id, type, status, approved_cost, current_km, vehicles(type)
dashboard-checklists  → checklists: SELECT vehicle_id, context, completed_at (status='completed')
dashboard-intervals   → checklist_day_intervals: SELECT rotina_day_interval, seguranca_day_interval (maybeSingle)
dashboard-drivers     → drivers: SELECT id, expiration_date
```

**Filtros Interativos:**
```ts
type DashboardFilters = {
  vehicleType: string | null;       // ex: 'Passeio'
  maintenanceType: string | null;   // ex: 'Corretiva'
};
```
- Client-side filtering via useMemo em ambos os painéis
- Alterar filtro atualiza KPIs e ambos os gráficos
- Filtros persistem ao trocar entre abas

**Arquivos Modificados:**
- `src/pages/Dashboard.tsx` — Reescrito com 5 queries, filtros, abas, painéis
- `src/components/dashboard/OperationalPanel.tsx` — Criado com VehicleRow interface (sem coluna `status` pois não existe no DB)
- `src/components/dashboard/CostPanel.tsx` — Criado com cálculo de cost per KM
- `.claude/arch-frontend.md` — Documentado Dashboard e componentes do dashboard/
- `.claude/arch-backend.md` — Documentada migration fix_vehicles_admin_master_rls.sql
- `.claude/data-model.md` — Documentadas interfaces VehicleRow, MaintenanceOrderDashboard, DashboardFilters

---

## Novos Recursos (2026-03-19) — Gráficos de Embarcador e Unidade Operacional no Dashboard

**Novos gráficos no Painel Operacional e Painel de Custos:**

**Painel Operacional:**
- Gráfico "Frota por Embarcador" — contagem de veículos filtrados agrupados por `shipper_name`
- Gráfico "Frota por Unidade Operacional" — contagem de veículos filtrados agrupados por `operational_unit_name`

**Painel de Custos:**
- Gráfico "Custo por Embarcador" — soma de `approved_cost` das OS filtradas, agrupadas por embarcador
- Gráfico "Custo por Unidade Operacional" — soma de `approved_cost` das OS filtradas, agrupadas por unidade operacional
- Todos os 4 novos gráficos são condicionais (renderizam apenas se `data.length > 0`)

**Correções de KPIs no Painel de Custos:**
- **Custo por Veículo**: denominator corrigido para `filteredVehicles.length` (todos os veículos filtrados, não só com OS aprovada)
- **Custo por KM**: fórmula reescrita — usa `odometer_km` dos **checklists** (não `current_km` de maintenance_orders); por veículo: `MAX(odometer_km) - MIN(odometer_km)` nos checklists dentro do `dateRange`; props `checklistRows` e `dateRange` adicionadas ao `CostPanel`

**Arquivos Modificados:**
- `src/components/dashboard/OperationalPanel.tsx` — Interface `VehicleRow` expandida com `shipper_name?` e `operational_unit_name?`; 2 novos `useMemo` + 2 novos `VehicleTypeBarChart` condicionais
- `src/pages/Dashboard.tsx` — Query `dashboard-vehicles` expandida com `shippers(name), operational_units(name)` + mapeamento explícito para extração dos joins; query `dashboard-checklists` adicionada coluna `odometer_km`; `checklistRows` e `dateRange` passados ao `CostPanel`
- `src/components/dashboard/CostPanel.tsx` — Props `checklistRows` e `dateRange` adicionadas; `costPerVehicle` corrigido; `costPerKm` reescrito para usar checklists; 2 novos `useMemo` + 2 novos `VehicleTypeBarChart` condicionais
- `.claude/data-model.md` — `VehicleRow` atualizado com campos `shipper_name?` e `operational_unit_name?`
- `.claude/arch-frontend.md` — Atualizado descrição de `OperationalPanel.tsx`, `CostPanel.tsx`, queries do Dashboard, fórmulas de KPI

---

## Novos Recursos (2026-03-19) — Novo Logo Tipográfico βetaFleet

**Implementação do Logo BetaFleet:**

- Criação de um novo logo tipográfico, substituindo o ícone e texto originais "Data Fleet" na barra lateral (`Sidebar.tsx`) pelo formato original da marca: **βetaFleet**.
- Utilização da letra grega beta (`β`) em cor laranja (`orange-500`) combinada com "etaFleet" em branco, alinhadas milimetricamente na mesma baseline da fonte Inter.
- Inclusão do subtítulo "Evolution always" em uppercase com amplo espaçamento entre caracteres para uma aparência harmônica e moderna.
- Implementação baseada em texto e classes Tailwind (100% livre de assets ou complexidade SVG).
- Criação do arquivo auxiliar `betafleet_logo_guidelines.md` (o qual possui histórico de design system alternativo também).

**Arquivos Modificados:**
- `src/components/Sidebar.tsx` — Nova construção flex-col no header contendo a tipografia βetaFleet pura.
- `.claude/arch-frontend.md` — Modificações refletidas no layout da Sidebar.

---

## Novos Recursos (2026-03-20) — OCR Inteligente com Cache e Portabilidade (βetaFleet)

**Arquitetura de OCR Otimizada para Custo e Escalabilidade:**

- **Cache de Resultados**: Implementada tabela `ocr_cache` no Supabase que armazena o hash SHA-256 do arquivo e o JSON retornado pela IA. Isso evita cobranças duplicadas para o mesmo documento.
- **Portabilidade de IA (Vendor Agnostic)**: A lógica do Gemini foi abstraída para `src/lib/ocr/geminiProvider.ts` seguindo a interface `OcrProvider`. Trocar de IA agora requer apenas a criação de um novo provider.
- **Orquestrador Central**: `src/lib/ocr/ocrEngine.ts` gerencia o fluxo: Hash → Busca Cache → (Miss) Chamada IA → Salva Cache → Retorno.
- **Utilitários**: `src/lib/hashUtils.ts` para cálculo de SHA-256 no navegador.

**Arquivos Criados/Modificados:**
- `src/lib/ocr/` (types.ts, geminiProvider.ts, cacheService.ts, ocrEngine.ts) — Nova infraestrutura.
- `src/lib/hashUtils.ts` — Cálculo de hash de arquivos.
- `src/lib/documentOcr.ts`, `src/lib/budgetOcr.ts` — Refatorados para usar a nova engine.
- `supabase/migrations/20260320090000_create_ocr_cache.sql` — Nova tabela com RLS. **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

---

## Novos Recursos (2026-03-20) — Redesign da Tela de Login com Logo βetaFleet e Background Mídia

**Tela de Login Alinhada com Marca + Preparada para Mídia:**

- **Logo βetaFleet**: Substituição do ícone Truck + texto "Sign in to Data Fleet" pelo logo tipográfico βetaFleet (β em orange-500 + etaFleet em branco) + tagline "Evolution always", mesmo padrão visual do Sidebar
- **Texto**: "Sign in to βetaFleet"
- **Background com Fallback Inteligente**:
  - Prioridade 1: Vídeo em `public/videos/login-bg.mp4` (autoPlay, loop, muted, playsInline)
  - Prioridade 2: Imagem em `public/images/login-bg.jpg` (fallback se vídeo falha)
  - Prioridade 3: Fundo sólido `bg-zinc-900` (fallback se ambos falham)
  - Detecção via `onError` handlers — sem pré-fetch, browser determina o que consegue carregar
- **Overlay**: `bg-black/50` sobre mídia para garantir legibilidade do formulário
- **Card do Formulário**: Branco semi-transparente `bg-white/95` com backdrop-blur, posicionado sobre a mídia com z-index adequado

**Estrutura de Pastas:**
```
public/
  videos/
    login-bg.mp4   ← colocar vídeo aqui
  images/
    login-bg.jpg   ← colocar imagem aqui (fallback)
```

**Arquivo Modificado:**
- `src/pages/Login.tsx` — Reescrito com logo βetaFleet, texto "Sign in to βetaFleet", lógica de background com fallback vídeo → imagem → cor, estados `videoFailed` e `imageFailed` para detecção de erros via `onError`
- `.claude/arch-frontend.md` — Atualizado descrição de Login.tsx

---

## Novos Recursos (2026-03-20) — Cancelamento de Ordens de Serviço de Manutenção

**Gerenciamento de OS Canceladas:**

- Status **'Cancelado'** agora disponível como terminal (sem Edit/Complete, sem reabrir inline)
- Fleet Assistant+ (`!isWorkshopUser`) pode cancelar qualquer OS ativa (não-concluída, não-cancelada)
- Botão **Ban** (cancelar) abre modal de confirmação com resumo: OS, placa, status atual
- Cancelamento persiste `cancelled_at` (TIMESTAMPTZ) + `cancelled_by_id` (UUID FK → profiles) para auditoria
- OS canceladas **não contam** em cálculos de custo do Dashboard:
  - Query `dashboard-maintenance`: `.neq('status', 'Cancelado')`
  - Filtro defensivo em `CostPanel`: `maintenanceOrders.filter(o => o.status !== 'Cancelado')`
  - KPI "Em Manutenção" em `OperationalPanel`: exclui tanto 'Concluído' quanto 'Cancelado'
- Fluxo "Reabrir": botão **RotateCcw** em OS canceladas → abre formulário clone pré-preenchido (sem `id`, sem `os`, sem `cancelledAt/By`) com status resetado para 'Aguardando orçamento' → ao salvar, INSERT com nova OS gerada
  - Reutiliza mecanismo `prefillData` existente (já usado por schedule-to-maintenance)
  - Registro cancelado permanece intocado com status 'Cancelado'
- 6º card de resumo "Cancelados" adicionado (grid 5→6 colunas, status terminal cinzento)

**Arquivos Modificados:**
- `src/pages/Maintenance.tsx` — Tipo `MaintenanceStatus` + 'Cancelado'; mutation `cancelMutation`; botões Cancel/Reopen; modal confirmação; card Cancelados; `counts['Cancelado']`
- `src/lib/maintenanceMappers.ts` — `MaintenanceOrderRow` + colunas `cancelled_at/by`; mapper atualizado
- `src/components/MaintenanceDetailModal.tsx` — `statusColor('Cancelado')`
- `src/pages/Dashboard.tsx` — `.neq('status', 'Cancelado')` na query `dashboard-maintenance`
- `src/components/dashboard/CostPanel.tsx` — Filtro defensivo client-side
- `src/components/dashboard/OperationalPanel.tsx` — KPI "Em Manutenção" exclui canceladas
- `supabase/migrations/add_cancelled_status_maintenance.sql` — ALTER CHECK de status, colunas de auditoria (⚠️ EXECUTADA NO SUPABASE DASHBOARD)
- `.claude/arch-backend.md` — Documentada migration + CHECK status + colunas de auditoria
- `.claude/arch-frontend.md` — Maintenance.tsx (cancel/reopen flow), Dashboard queries, panel filters
- `.claude/data-model.md` — `MaintenanceStatus` union + `MaintenanceOrder` campos de auditoria

---

## Novos Recursos (2026-03-25) — Configuração Detalhada de Eixos em Veículos

**Configurador dinâmico de eixos no cadastro de veículos com cálculo automático de pneus:**

- Campo `eixos` agora dispara um editor dinâmico "Configuração de Eixos" (oculto para Moto)
- Cada eixo configurável: **Tipo de Eixo** (direcional, simples, duplo, duplo_tandem, triplo_tandem, elevação) + **Rodagem** (simples, dupla, tripla)
- Regras de negócio: primeiro eixo fixo como Direcional; rodagem tripla proibida no primeiro eixo; tipos multi-eixo (duplo=2, triplo_tandem=3) consomem múltiplos slots e filtram opções disponíveis
- Campo "Estepes de fábrica" (`stepsCount`) para estepes incluídos de fábrica
- Total de pneus calculado automaticamente (mostra `—` enquanto configuração incompleta)
- Badge de status: âmbar (incompleto) / esmeralda (completo com X/N eixos)
- Dados persistidos como JSONB (`axle_config`) e INT (`steps_count`) na tabela `vehicles`
- Módulo de pneus atualizado: `generatePositionsFromConfig()` usa a config detalhada quando disponível; fallback para `VehicleTireConfig` seed em veículos sem config
- Rodagem tripla gera posições `E{n}I/E{n}M/E{n}E/D{n}I/D{n}M/D{n}E`

**Arquivos Criados:**
- `supabase/migrations/20260325081826_add_axle_config_vehicles.sql` — Colunas `axle_config JSONB`, `steps_count INT` em vehicles; atualiza CHECK `position_type` em tires para suportar `triple_*` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**
- `src/lib/axleConfigUtils.ts` — Funções puras: `getPhysicalAxles`, `getAvailableAxleTypes`, `getAvailableRodagem`, `calculateTotalTires`, `totalPhysicalAxles`, `isConfigComplete` + labels
- `src/components/AxleConfigEditor.tsx` — Editor dinâmico com rows por eixo, dropdowns filtrados, estepes e total

**Arquivos Modificados:**
- `src/types.ts` — `AxleType`, `RodagemType`, `AxleConfigEntry` types; `TirePositionType` expandido com `triple_*`; `axleConfig?` e `stepsCount?` em `Vehicle`
- `src/lib/vehicleMappers.ts` — `axle_config` / `steps_count` em `VehicleRow`, `vehicleFromRow`, `vehicleToRow`
- `src/lib/tirePositions.ts` — `generatePositionsFromConfig()`; `classifyPositionType()` atualizado para sufixo `M`
- `src/components/VehicleForm.tsx` — Integração do `AxleConfigEditor`; useEffect para auto-inicializar primeiro eixo; reset de config ao alterar `eixos`
- `src/pages/Tires.tsx`, `src/components/TireForm.tsx`, `src/components/TireBatchForm.tsx` — Suporte a `axleConfig` + `stepsCount`; usa `generatePositionsFromConfig` quando disponível

---

## Novos Recursos (2026-03-24) — Módulo de Gestão de Pneus

**Cadastro, rastreamento e histórico de movimentação de pneus da frota:**

- Rota: `/pneus` — item "Pneus" na Sidebar (icon: Circle, Fleet Assistant+)
- Dois modos de cadastro: Por Placa (individual) e Por Modelo (lote multi-step)
- Posições por veículo baseadas em `vehicle_tire_configs`: eixos simples (E/D), duplos (I/E), estepes (Step N)
- Histórico de movimentação append-only em `tire_position_history`
- Índice parcial `WHERE active = true` garante 1 pneu ativo por posição por veículo
- Classificação visual: Novo / Meia vida / Troca
- Toggle ativar/desativar com confirmação

**Arquivos Criados:**
- `supabase/migrations/20260324000000_create_tire_management.sql` — 3 tabelas + RLS + seed **⚠️ EXECUTAR NO SUPABASE DASHBOARD**
- `src/types.ts` — Tire, TirePositionHistory, VehicleTireConfig + TireVisualClassification, TirePositionType
- `src/lib/tireMappers.ts` — TireRow + converters camelCase ↔ snake_case
- `src/lib/tirePositions.ts` — generatePositions(), validatePositionAssignment(), classifyPositionType()
- `src/pages/Tires.tsx` — Página principal (cards + tabela + modais)
- `src/components/TireForm.tsx` — Modal de cadastro/edição individual
- `src/components/TireBatchForm.tsx` — Modal multi-step de lote por modelo
- `src/components/TireHistoryModal.tsx` — Modal de histórico de movimentação

**Arquivos Modificados:**
- `src/App.tsx` — `<Route path="pneus" element={<Tires />} />`
- `src/components/Sidebar.tsx` — Item "Pneus" após Manutenção (icon Circle)
- `.claude/arch-frontend.md`, `.claude/arch-backend.md`, `.claude/data-model.md` — Documentados

---

## Novos Recursos (2026-03-25) — Exclusão de Pneus para Admin Master

**Funcionalidade de exclusão permanente de pneus:**

- Admin Master pode deletar pneus cadastrados permanentemente
- Ícone `Trash2` (vermelho) na coluna Ações da tabela de pneus em `/pneus`
- Modal de confirmação `DeleteConfirmModal` com aviso de ação irreversível
- Histórico de movimentação deletado automaticamente via `ON DELETE CASCADE`
- RLS policy `tires_delete` já existia na migration `20260324000000_create_tire_management.sql` — permite DELETE para Director/Admin Master com bypass de client_id para Admin Master
- Frontend restrito a Admin Master apenas via `ROLES_CAN_DELETE_TIRES = ['Admin Master']`

**Arquivos Modificados:**
- `src/pages/Tires.tsx` — Adicionado import `Trash2`, constante `ROLES_CAN_DELETE_TIRES`, booleano `canDelete`, state `tireToDelete`, mutation `deleteMutation`, componente `DeleteConfirmModal`, botão delete na tabela, renderização do modal
- `.claude/arch-frontend.md` — Documentada exclusão em seção Tires.tsx
- `.claude/arch-backend.md` — Clarificada RLS policy `tires_delete` com suporte a Admin Master

**⚠️ Nenhuma migration adicional necessária** — RLS já suporta a operação.

---

## Novos Recursos (2026-03-26) — Visibilidade de Embarcador, Unidade Operacional e Finalidade na Tabela de Veículos

**Exibição de informações de alocação e uso de veículos na lista:**

- Tabela de Veículos em `/cadastros/veiculos` agora exibe **Embarcador** e **Unidade Operacional** em coluna única (stacked) com quebra de linha
- Nova coluna **Finalidade** com field `vehicleUsage` (Operação | Uso Administrativo | Uso por Lideranças | Outros)
- Coluna **Motorista** agora quebra nome após o segundo nome para evitar desproporção (ex: "João da" / "Silva Santos")
- Quando campos vazios: exibem `—` em cinza para clareza visual
- Colunas totais: 7 (Veículo | Tipo/Energia | Proprietário | Motorista | Embarcador/Unid.Op. | Finalidade | Ações)
- Dados já vinham da query via `.select('*, drivers(name), shippers(name), operational_units(name)')`
- Tipos Vehicle já possuíam `shipperName`, `operationalUnitName` e `vehicleUsage` — apenas renderização ajustada

**Arquivos Modificados:**
- `src/pages/Vehicles.tsx` — Tabela atualizada: header + cells com novo layout stackable para Embarcador/Unid.Op.; quebra de linha em Motorista; `colSpan` ajustado de 5 para 7
- `.claude/arch-frontend.md` — Documentado padrão visual e layout de Vehicles.tsx

**⚠️ Nenhuma alteração de BD, tipos ou queries necessária** — dados já existiam.

---

## Troubleshooting & Gotchas Comuns

### Autenticação & Multi-Tenancy

**Problema:** Admin Master vê apenas dados de um cliente mesmo após selecionar outro
**Causa:** Query sem filtro `client_id` ou RLS sem `OR role = 'Admin Master'`
**Solução:**
1. Adicione `.eq('client_id', currentClient.id)` na query quando `currentClient?.id` existe
2. Verifique RLS — Admin Master precisa de `OR role = 'Admin Master'` em WHEREs de `client_id`

**Problema:** "JWT expired" ao fazer edit/delete
**Causa:** Token de sessão expirou antes da operação crítica
**Solução:** Adicione `await supabase.auth.refreshSession()` antes de `.update()` ou `.delete()`

### TypeScript & Tipos

**Problema:** `Cannot find type Vehicle` em novo arquivo
**Causa:** `src/types.ts` não foi importado
**Solução:** `import { Vehicle } from '../types'` no topo do arquivo

**Problema:** Type error em mapeador: `Property 'initial_km' doesn't exist`
**Causa:** Campo novo no DB mas mapeador não foi atualizado
**Solução:**
1. Leia a migration que criou o campo
2. Atualize `src/lib/*Mappers.ts` com novo mapeamento camelCase ↔ snake_case
3. Atualize interface em `src/types.ts`

### Migrations & Schema

**Problema:** "ERROR: Current identity has insufficient privileges to..." ao executar migration
**Causa:** Role SQL não tem permissão ou RLS está bloqueando INSERT/UPDATE
**Solução:**
1. Verifique `check_auth_role()` em migration — user precisa ser `postgres` ou `authenticated` com role correto
2. Valide RLS policies — teste com role específica em Supabase SQL Editor

**Problema:** Migration executada mas coluna não aparece em SELECT
**Causa:** RLS policy está bloqueando visibilidade da coluna ou migração não foi sincronizada
**Solução:**
1. Execute `SELECT * FROM tabela LIMIT 1` no Supabase SQL Editor (bypass de RLS com role `postgres`)
2. Se coluna existe — RLS está filtrando; verifique SECURITY DEFINER em view/function
3. Se coluna não existe — migration falhou silenciosamente; verifique logs do Supabase Dashboard

### React-Query & Data Fetching

**Problema:** Query retorna `undefined` mesmo após sucesso
**Causa:** `select()` transformer está retornando `undefined` ou `queryFn` não está retornando nada
**Solução:**
1. Adicione `console.log(data)` antes do `select()`
2. Valide que `queryFn` retorna objeto ou array completo
3. Se usar `select()`, certifique-se de retornar valor válido (não undefined)

**Problema:** Dados não atualizam após mutation
**Causa:** Faltou `queryClient.invalidateQueries({ queryKey: ['...'] })`
**Solução:** Após mutation bem-sucedida, invalide query manualmente:
```typescript
await mutateAsync(...);
queryClient.invalidateQueries({ queryKey: ['vehicles', clientId] });
```

### Dashboard & Filtros

**Problema:** Valores de KPI não aparecem ou mostram 0
**Causa:** Filtro `vehicleType` ou `maintenanceType` está excluindo todos os dados
**Solução:**
1. Abra DevTools → Console, verifique `filteredVehicles.length` e `filteredMaintenance.length`
2. Se ambos são 0 — adicione dados de teste com tipo correspondente
3. Verifique lógica de filtro em `useMemo` — AND vs OR

### Supabase RLS & Policies

**Problema:** "You do not have access to this table"
**Causa:** RLS policy bloqueia SELECT/INSERT/UPDATE/DELETE
**Solução:**
1. Verifique `auth.uid()` matches `profiles(id)` do user logado
2. Verifique `auth.jwt()->>'client_id'` matches `profile.client_id`
3. Para Admin Master: certifique-se de `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin Master')`

---

## Histórico de Mudanças

Consulte [CHANGELOG.md](CHANGELOG.md) para o histórico detalhado de todas as sessões.