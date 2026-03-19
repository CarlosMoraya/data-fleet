# CLAUDE.md — Context Router

> **Instrução de Entrada**: Sempre leia este índice antes de qualquer ação. Identifique a categoria da tarefa e carregue o módulo de contexto correspondente ANTES de codificar.

---

## Atalhos Rápidos

```bash
npm run dev       # Dev server (porta 3000)
npm run lint      # Type-check (tsc --noEmit)
npm run build     # Build produção
npm run preview   # Preview do build
npx playwright test  # Rodar testes E2E
```

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

## Histórico de Mudanças

Consulte [CHANGELOG.md](CHANGELOG.md) para o histórico detalhado de todas as sessões.