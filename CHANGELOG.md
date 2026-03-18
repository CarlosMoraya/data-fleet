# Changelog — Data Fleet

## 2026-03-19 — Coluna Total + Remoção de campos redundantes

- **Adição**: `BudgetItemsTable.tsx` agora exibe coluna `Total (R$)` = `Qtd × Valor` em cada linha (modo edição e leitura), com `colSpan` atualizado de 4 para 5.
- **Remoção**: Removidos campos `Custo Estimado (R$)` e `Subtotal da OS (R$)` de `MaintenanceForm.tsx` — o subtotal já aparece no rodapé da tabela. Removida constante `hasItemsWithValue` e callback `onSubtotalChange`.
- **Estado inicial**: `estimatedCost: 0` mantido para garantir INSERT sem erros; `approvedCost` não é mais exposto no formulário.

## 2026-03-18 — Auditoria de RLS & Admin Master Access

- **Investigação exaustiva**: Analisadas **19 tabelas** em todas as migrations e `schema.sql` para verificar suporte correto a Admin Master.
- **Problema identificado**: `maintenance_orders` usava políticas que requeriam `role_rank >= 3 AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())` SEM exceção para Admin Master, bloqueando-o 100%.
- **Solução**: Criada migration `fix_maintenance_orders_admin_master_rls.sql` recriando as 4 policies (SELECT, INSERT, UPDATE, DELETE) com padrão `(... role_rank(...) AND client_id = ...) OR role = 'Admin Master'`.
- **Resultado final**: ✓ Todas as 19 tabelas agora suportam Admin Master corretamente. Nenhuma outra tabela afetada.
- **Padrão para futuro**: Ao criar novas tabelas com RLS baseada em `client_id`, SEMPRE adicionar `OR role = 'Admin Master'` (sem restrição de tenant) em TODAS as policies.

## 2026-03-18 — Testes E2E: Integração Agendamento → Manutenção e Dual OS

- **Novo arquivo**: `e2e/tenant-users-assistant-maintenance.spec.ts` — 7 testes seriais cobrindo o fluxo completo sob o perfil Fleet Assistant (Pedro).
- **Cobertura**:
  1. Seed: cria agendamento com primeiro veículo/oficina disponíveis.
  2. Navegação: botão "Gerar OS" (`ClipboardList`) em `/agendamentos` navega para `/manutencao` e abre form automaticamente.
  3. Prefill: `vehicleId`, `workshopId`, `entryDate`, `type` e `status` pré-preenchidos do agendamento.
  4. OS Interna read-only: verifica ausência de `input[name="os"]` e presença de "Será gerada automaticamente".
  5. Salvar via prefill: OS Interna gerada com padrão `OS-AAMM-XXXX`; OS da Oficina persistida.
  6. Editar: OS Interna mostra valor real read-only; `input[name="workshopOs"]` tem o valor salvo.
  7. Fluxo manual: "+ Nova Manutenção" também exibe OS Interna read-only.
- **Padrão**: `sessionStorage.clear()` removido (causava `SecurityError` em Playwright serial tests); `goto` antes de `evaluate` quando necessário.

## 2026-03-18 — Estabilização de Testes E2E (Shippers/Units)

- Resolvidos erros de **Strict Mode** no Playwright substituindo `getByText` por `getByRole('cell', ...).first()`.
- Implementado handler global de **diálogos nativos** (`window.confirm`) para aceitar exclusões automaticamente.
- Resolvido bug de **duplicidade de dados** em testes sequenciais através do uso de sufixos dinâmicos (`Math.random()`) e CNPJs randômicos por execução.
- Refatorado `OperationalUnits.tsx` para usar **React Query** (`useQuery`, `useMutation`), melhorando a performance e o tratamento de erros de integridade referencial (FK).
- Adicionado suporte a **aria-modal** e **roles de diálogo** nos formulários de cadastro para maior acessibilidade e facilidade de teste.
- Corrigido fluxo de seleção em cascata (Embarcador → Unidade) no `VehicleForm.tsx`. Sincronizado para garantir que o dropdown de unidades seja filtrado e limpo corretamente ao trocar o embarcador.

## 2026-03-18 — Integração Agendamento → Manutenção (Dual OS System)

- **Fluxo semi-automatizado**: Botão "Gerar OS" (ícone `ClipboardList`) em WorkshopSchedules.tsx navega para `/manutencao` com dados pré-preenchidos via React Router `state`.
- **Dual OS System**:
  - **OS Interna** (`os_number`): auto-gerada no INSERT via formato `OS-YYMM-XXXX`, **imutável** (nunca incluída em UPDATE).
  - **OS da Oficina** (`workshop_os_number`): novo campo editável por Fleet Assistant+, armazena OS fornecida pela oficina.
- **Arquivos modificados**:
  - `src/pages/Maintenance.tsx`: adicionado `useLocation` para ler `prefillMaintenance` do state; `saveMutation` separado INSERT/UPDATE logic; novo state `prefillData`; auto-abertura do form via `useEffect`.
  - `src/components/MaintenanceForm.tsx`: novo prop `prefill`, inicialização mergeada com `...prefill`; substituição do campo OS único por dual fields (OS Interna read-only display + OS da Oficina editable input).
  - `src/lib/maintenanceMappers.ts`: adicionado `workshop_os_number` a `MaintenanceOrderRow`; mapeamento no return `workshopOs: row.workshop_os_number || undefined`.
  - `src/pages/WorkshopSchedules.tsx`: função `handleGenerateMaintenance()` com `navigate()` + state; botão no `ScheduleRow` visível apenas para Fleet Assistant+ (status !== 'cancelled').
- **Migration SQL**: `20260318110000_add_workshop_os_to_maintenance.sql` — adiciona coluna `workshop_os_number VARCHAR(100) NULL`.
- **MaintenanceOrder interface**: adicionado `workshopOs?: string` (opcional).
- **Bug Fix**: Maintenance.tsx desestruturava `profile` inválido de `useAuth()` — corrigido com alias `user: profile`.

## 2026-03-18 — Refatoração para React Query e Performance

- **WorkshopSchedules.tsx**: Migrado para `useQuery` e `useMutation`. Adicionado suporte a `useMemo` para filtragem otimizada. Persistência de formulário em `sessionStorage`.
- **ActionPlans.tsx**: Migrado para `useQuery`. Implementada hidratação pós-fetch para nomes de perfis e filtragem otimizada com `useMemo`.
- **ChecklistFill.tsx**: Migrado para `useQuery` e `useMutation`. Otimizada a consolidação de estados de itens e respostas via `useMemo`.
- **Módulo de Manutenção** (`Maintenance.tsx`):
  - Tabela `maintenance_orders` no Supabase com RLS baseada em `role_rank`.
  - Mappers de dados (`src/lib/maintenanceMappers.ts`).
  - Migração completa para React Query (`useQuery`, `useMutation`).
  - Otimização de filtros e contadores com `useMemo`.
  - Implementado `actual_exit_date` automático na conclusão da O.S.
  - Trigger `set_maintenance_updated_at` para auditoria de timestamps.

## 2026-03-18 — Agendamento de Oficina (Workshop Schedules)

- **Nova tabela**: `workshop_schedules` (id, client_id, vehicle_id FK RESTRICT, workshop_id FK RESTRICT, scheduled_date, status CHECK('scheduled','completed','cancelled'), completed_at, checklist_id FK SET NULL, notes, created_by, created_at, updated_at) com RLS: SELECT Driver (veículo próprio via join drivers→vehicles) + Fleet Assistant+ (tenant) + Admin Master; INSERT Fleet Assistant+; UPDATE Fleet Assistant+ + Driver (veículo próprio, para auto-complete); DELETE Manager+.
- **Novos arquivos**:
  - `src/lib/workshopScheduleMappers.ts` (WorkshopScheduleRow, scheduleFromRow, scheduleToRow, buildGoogleMapsUrl, formatWorkshopAddress)
  - `src/components/ScheduleForm.tsx` (modal com vehicle/workshop dropdowns + date + notes)
  - `src/pages/WorkshopSchedules.tsx` (dual-view: tabela Fleet Assistant+ com ações Concluir/Cancelar/Editar/Excluir; cards para Driver com endereço + Google Maps link + histórico colapsável)
- **Routing**: Rota `/agendamentos` em `App.tsx`; item "Agendamentos" com ícone `CalendarClock` no `Sidebar.tsx` (visível para Driver + Fleet Assistant+).
- **Auto-conclusão**: `ChecklistFill.tsx` `handleFinish()` — após marcar checklist como `completed`, se contexto = "Entrada em Oficina", busca agendamento pending mais antigo (FIFO) com mesmo `vehicle_id` + `workshop_id` e atualiza para `completed` (best-effort, não bloqueia). Bug corrigido: condição usava `checklist?.workshopId` (null no estado inicial); corrigido para `resolvedWorkshopId = selectedWorkshopId || checklist?.workshopId`.
- **Bug RLS workshops**: `add_supervisor_coordinator_roles.sql` havia recriado `workshops_select` sem Driver/Yard Auditor. Corrigido via `fix_workshops_roles_rls.sql`. ⚠️ Ao atualizar `workshops_select` no futuro, SEMPRE incluir: Driver, Yard Auditor, Fleet Assistant, Fleet Analyst, Supervisor, Manager, Coordinator, Director + Admin Master.

## 2026-03-17 — Correcções Associação Motorista-Veículo

- **Bug Multi-tenancy — Índice UNIQUE Global**: Índice `idx_vehicles_driver_unique` em `driver_id` era **global** (não scoped por client), violando multi-tenancy — um motorista de um cliente bloqueava todo o sistema. Criada migration `fix_driver_unique_index_multitenant.sql`: remove índice quebrado e cria novo índice `(client_id, driver_id)` permitindo que cada cliente tenha seu próprio motorista vinculado a 1 veículo.
- **Bug Auth — currentClient NULL para Drivers**: AuthContext tentava fazer LEFT JOIN implícito em profiles com clients, retornando null para motoristas. Corrigido em `AuthContext.tsx`: agora faz SELECT direto em clients usando profile.client_id, garantindo que todo usuário com client_id válido terá currentClient preenchido.
- **Bug Checklists — Queries falhavam com currentClient null**: Adicionadas guardas em Checklists.tsx para retornar early se currentClient?.id for vazio, evitando queries inválidas. Melhorada precisão da query de driver: agora filtra por `(profile_id, client_id)` e depois busca veículo com `(driver_id, client_id)`.
- **UX — Mensagens de erro claras**: VehicleForm.tsx agora diferencia erro 23505 entre motorista vinculado e placa duplicada, inspecionando a mensagem PostgreSQL. Validação em tempo real quando motorista é selecionado, com feedback imediato se não estiver disponível.
