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

## Registro de Mudanças (Sessão Atual)

(Anteriores changelog entries remain unchanged)

- **Agendamento de Oficina (2026-03-18)**:
   - **Nova tabela**: `workshop_schedules` (id, client_id, vehicle_id FK RESTRICT, workshop_id FK RESTRICT, scheduled_date, status CHECK('scheduled','completed','cancelled'), completed_at, checklist_id FK SET NULL, notes, created_by, created_at, updated_at) com RLS: SELECT Driver (veículo próprio via join drivers→vehicles) + Fleet Assistant+ (tenant) + Admin Master; INSERT Fleet Assistant+; UPDATE Fleet Assistant+ + Driver (veículo próprio, para auto-complete); DELETE Manager+.
   - **Novos arquivos**: `src/lib/workshopScheduleMappers.ts` (WorkshopScheduleRow, scheduleFromRow, scheduleToRow, buildGoogleMapsUrl, formatWorkshopAddress), `src/components/ScheduleForm.tsx` (modal com vehicle/workshop dropdowns + date + notes), `src/pages/WorkshopSchedules.tsx` (dual-view: tabela Fleet Assistant+ com ações Concluir/Cancelar/Editar/Excluir; cards para Driver com endereço + Google Maps link + histórico colapsável).
   - **Routing**: Rota `/agendamentos` em `App.tsx`; item "Agendamentos" com ícone `CalendarClock` no `Sidebar.tsx` (visível para Driver + Fleet Assistant+).
   - **Auto-conclusão**: `ChecklistFill.tsx` `handleFinish()` — após marcar checklist como `completed`, se contexto = "Entrada em Oficina", busca agendamento pending mais antigo (FIFO) com mesmo `vehicle_id` + `workshop_id` e atualiza para `completed` (best-effort, não bloqueia). Bug corrigido: condição usava `checklist?.workshopId` (null no estado inicial); corrigido para `resolvedWorkshopId = selectedWorkshopId || checklist?.workshopId`.
   - **Bug RLS workshops**: `add_supervisor_coordinator_roles.sql` havia recriado `workshops_select` sem Driver/Yard Auditor. Corrigido via `fix_workshops_roles_rls.sql`. ⚠️ Ao atualizar `workshops_select` no futuro, SEMPRE incluir: Driver, Yard Auditor, Fleet Assistant, Fleet Analyst, Supervisor, Manager, Coordinator, Director + Admin Master.

- **Correcções Associação Motorista-Veículo (2026-03-17 - Noite)**:
   - **Bug Multi-tenancy — Índice UNIQUE Global**: Índice `idx_vehicles_driver_unique` em `driver_id` era **global** (não scoped por client), violando multi-tenancy — um motorista de um cliente bloqueava todo o sistema. Criada migration `fix_driver_unique_index_multitenant.sql`: remove índice quebrado e cria novo índice `(client_id, driver_id)` permitindo que cada cliente tenha seu próprio motorista vinculado a 1 veículo.
   - **Bug Auth — currentClient NULL para Drivers**: AuthContext tentava fazer LEFT JOIN implícito em profiles com clients, retornando null para motoristas. Corrigido em `AuthContext.tsx`: agora faz SELECT direto em clients usando profile.client_id, garantindo que todo usuário com client_id válido terá currentClient preenchido.
   - **Bug Checklists — Queries falhavam com currentClient null**: Adicionadas guardas em Checklists.tsx para retornar early se currentClient?.id for vazio, evitando queries inválidas. Melhorada precisão da query de driver: agora filtra por `(profile_id, client_id)` e depois busca veículo com `(driver_id, client_id)`.
   - **UX — Mensagens de erro claras**: VehicleForm.tsx agora diferencia erro 23505 entre motorista vinculado e placa duplicada, inspecionando a mensagem PostgreSQL. Validação em tempo real quando motorista é selecionado, com feedback imediato se não estiver disponível.

- **Refatoração para React Query e Performance (2026-03-18)**:
    - **WorkshopSchedules.tsx**: Migrado para `useQuery` e `useMutation`. Adicionado suporte a `useMemo` para filtragem otimizada. Persistência de formulário em `sessionStorage`.
    - **ActionPlans.tsx**: Migrado para `useQuery`. Implementada hidratação pós-fetch para nomes de perfis e filtragem otimizada com `useMemo`.
    - **ChecklistFill.tsx**: Migrado para `useQuery` e `useMutation`. Otimizada a consolidação de estados de itens e respostas via `useMemo`.
    - **Módulo de Manutenção (`Maintenance.tsx`)**:
        - Tabela `maintenance_orders` no Supabase com RLS baseada em `role_rank`.
        - Mappers de dados (`src/lib/maintenanceMappers.ts`).
        - Migração completa para React Query (`useQuery`, `useMutation`).
        - Otimização de filtros e contadores com `useMemo`.
        - Implementado `actual_exit_date` automático na conclusão da O.S.
        - Trigger `set_maintenance_updated_at` para auditoria de timestamps.

- **Integração Agendamento → Manutenção (2026-03-18 - Tarde)**:
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

- **Estabilização de Testes E2E (Shippers/Units - 2026-03-18)**:
    - Resolvidos erros de **Strict Mode** no Playwright substituindo `getByText` por `getByRole('cell', ...).first()`.
    - Implementado handler global de **diálogos nativos** (`window.confirm`) para aceitar exclusões automaticamente.
    - Resolvido bug de **duplicidade de dados** em testes sequenciais através do uso de sufixos dinâmicos (`Math.random()`) e CNPJs randômicos por execução.
    - Refatorado `OperationalUnits.tsx` para usar **React Query** (`useQuery`, `useMutation`), melhorando a performance e o tratamento de erros de integridade referencial (FK).
    - Adicionado suporte a **aria-modal** e **roles de diálogo** nos formulários de cadastro para maior acessibilidade e facilidade de teste.
    - Corrigido fluxo de seleção em cascata (Embarcador → Unidade) no `VehicleForm.tsx`. Sincronizado para garantir que o dropdown de unidades seja filtrado e limpo corretamente ao trocar o embarcador.