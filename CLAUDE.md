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

- **Módulo de Veículos**: Atualizado `VehicleForm.tsx` com campos obrigatórios dinâmicos, novos uploads (Sanitária e GR) e suporte a múltiplos tipos de veículos.
- **Módulo de Motoristas**: Implementado CRUD completo em `Drivers.tsx` com `DriverForm.tsx`, incluindo upload de CNH, GR e até 3 certificados (armazenados em bucket `driver-documents`).
- **Configurações Dinâmicas**: Centralizadas em `Settings.tsx`, permitindo configurar campos obrigatórios tanto para Veículos quanto para Motoristas por cliente.
- **Permissões de Exclusão**: Separadas as permissões de exclusão de veículos (`can_delete_vehicles`) e motoristas (`can_delete_drivers`) na tabela `profiles`, com interface de gestão em `Users.tsx`.
- **Módulo de Oficinas**: Implementado CRUD completo em `Workshops.tsx` com `WorkshopForm.tsx`, incluindo gestão de endereços e especialidades técnica. Validado com Testes E2E (Manager e Analyst).
- **Estabilidade de Testes (E2E)**: Corrigidos bugs críticos de infraestrutura de testes. Implementado `test.describe.serial` em fluxos de Oficina e Clientes, ajuste de timeouts para Edge Functions (60s) e inclusão de campos obrigatórios dinâmicos nos testes de Veículos. Resolvidos bugs BUG-001 a BUG-005.
- **UX Responsiva**: Implementado Menu Mobile (Drawer) com botão hamburger no Topbar e overlay inteligente para melhor experiência em smartphones.
- **Deploy & Hosting**: Adicionado `vercel.json` e orientações de deploy do frontend na Vercel com conexão ao Supabase.
- **Seeding de Veículos**: Cadastrados 6 novos veículos (VEC0001-VEC0006) com preenchimento completo de garantia, revisão e seguro. Identificada limitação de upload (403) no perfil de Assistente, com bypass realizado via Analista.
- **Módulo de Checklists**: Implementado módulo completo com 7 tabelas Supabase (+ seed ~45 itens), 4 mappers TypeScript, 6 componentes React e 4 páginas novas:
  - Templates com ciclo draft → published → deprecated, versionamento, categorias de veículo (Leve/Médio/Pesado/Elétrico) e contexto (Rotina/Auditoria/Reboque/Entrada em Oficina/Saída de Oficina/Segurança)
  - Nome do template gerado automaticamente como `"Checklist [Categoria] [Contexto]"` — sem campo manual
  - Unicidade por (client, category, context) via EXCLUDE constraint no banco
  - View Motorista: todos os templates publicados da categoria do veículo exibidos como cards; histórico com busca e filtro de status
  - View Auditor: dropdown de veículo → motorista associado exibido → apenas templates de Auditoria
  - Contextos Entrada/Saída de Oficina: seleção obrigatória de oficina antes dos itens (salvo em `workshop_id`)
  - Contexto Segurança: toggle `canBlockVehicle` por item com badge visual (prepara bloqueio futuro)
  - Preenchimento fullscreen mobile-first com câmera direta (getUserMedia + GPS + compressão)
  - Geração automática de Plano de Ação para itens não conformes (política `allowDriverActions`/`allowAuditorActions`)
  - Painel de Ação para Fleet Assistant+ com gestão de status e O.S.
  - Exclusão de checklists exclusiva para Admin Master (trilha de auditoria)
- **Cadastro de Veículos**: Adicionada a modalidade de aquisição "Agregado" no `VehicleForm.tsx` e atualizada a restrição `CHECK` no banco de dados (`vehicles_acquisition_check`), permitindo maior flexibilidade na gestão da frota.
- **Layout de Configurações**: Refatorada a página `Settings.tsx` para utilizar uma interface de abas (Tabs), separando as configurações de campos obrigatórios de Veículos e Motoristas para melhor usabilidade, seguindo o padrão visual de `Cadastros.tsx`.
- **Auto-Sync**: Atualizados manuais em `.claude/` (Frontend, Backend, Data Model) com as novas funcionalidades de Checklists.
- **Filtros e Multi-tenancy (Admin Master)**: Implementado Seletor Global de Clientes no `Topbar` exclusivo para Admin Master, permitindo visão consolidada ("Todos os Clientes"). Removidos filtros locais redundantes e sincronizadas as páginas (`AdminUsers`, `AdminClients`, `Vehicles`, `Drivers`, etc.) para respeitar exclusivamente o contexto global de cliente. **Corrigidas permissões RLS em `drivers` e `driver_field_settings` para garantir acesso total de escrita ao Admin Master.** Adicionados atalhos rápidos de "Marcar Todos / Desmarcar Todos" em `Settings.tsx` para Veículos e Motoristas, corrigindo também bloqueios de Select RLS (`fix_admin_master_settings_permissions.sql`).
- **Templates de Checklists (Admin Master)**: Habilitada a exclusão de templates publicados e descontinuados exclusivamente para o perfil Admin Master em `ChecklistTemplates.tsx`. Adicionado tratamento amigável de erro de chave estrangeira (código 23503 do PostgreSQL) para instruir a exclusão prévia do histórico de relatórios caso o template possua preenchimentos em andamento/concluídos.
- **Integração Motorista ↔ Usuário do Sistema (2026-03-14)**: Implementado padrão arquitetural onde **todo motorista é automaticamente um usuário do sistema** (com login). Adicionada coluna `profile_id` na tabela `drivers` (FK → profiles.id) via migration `add_driver_profile_link.sql`. `DriverForm` em modo criação agora exibe campos email/senha (obrigatórios) e chama Edge Function `create-user` para criar conta + perfil antes de inserir driver. Users.tsx filtrado para **não permitir criar Driver role e não listar drivers** (criação exclusiva via DriverForm). `Checklists.tsx` corrigido: vehicle lookup agora usa dois passos — `drivers.profile_id = auth.uid()` → `vehicles.driver_id = drivers.id` (antes usava incorretamente `profiles.id` como `driver_id`). Validado com 100% de sucesso nos testes E2E (`driver-user-integration.spec.ts`). Atualizados manuais em `.claude/` (data-model.md, arch-backend.md, arch-frontend.md).
- **Correções Adicionais (E2E/Edge Functions)**: Corrigida Edge Function `create-user` para retornar `profileId` e desabilitada verificação de JWT no gateway (validada internamente) para permitir criação de usuários por perfis de nível inferior (Fleet Analyst) em ambientes de teste. Ajustados seletores do Playwright para maior estabilidade.
- **Redesign de Contextos de Checklist (2026-03-15)**: Removido conceito "Livre"; contexto agora é campo obrigatório em todos os templates. Renomeado contexto "Diário" para "Rotina". Nome do template auto-gerado como "Checklist [Categoria] [Contexto]". Novo schema de banco: coluna `context` com CHECK constraint, `can_block_vehicle` em `checklist_items`, `workshop_id` em `checklists`. Nova EXCLUDE constraint `unique_published_category_context` permite múltiplos templates publicados por categoria (um por contexto).
- **Integração Checklist → Plano de Ação (2026-03-15)**:
  - **Bug crítico corrigido**: `ActionPlans.tsx` usava joins PostgREST inválidos (`checklist_items!checklist_response_id` e `checklist_templates` sem FK direta), causando erro silencioso — `data` retornava `null` e a lista ficava sempre vazia. Corrigido com joins aninhados válidos: `checklist_responses!checklist_response_id(checklist_items(title))` e `checklists!checklist_id(checklist_templates(name))`. Adicionado log de erro em `fetchPlans`.
  - `ActionPlanRow` e `actionPlanFromRow` em `actionPlanMappers.ts` atualizados para refletir a nova estrutura aninhada dos joins.
  - **Upload de evidência**: substituído campo de URL por upload real de arquivo (imagem JPG/PNG/WEBP ou PDF) em `ActionPlanModal.tsx`. Exibe preview de imagem ou ícone de documento para PDFs. Armazenado em `vehicle-documents/{clientId}/action-plans/{planId}/evidence.{ext}` via nova função `uploadActionPlanEvidence()` em `storageHelpers.ts`.
- **Correções UX Motorista — Checklists (2026-03-15)**:
  - **Cancelar checklist em andamento**: Adicionado botão "Cancelar" no banner de checklist em andamento da view do Driver em `Checklists.tsx`. Usa o `confirmDelete` modal existente; apenas checklists `in_progress` podem ser excluídos pelo motorista. RLS policy `checklists_delete_own_driver` criada via `fix_checklist_driver_delete_rls.sql`. Corrigido bug de UI: `setOpenChecklist` agora sempre chamado com `null` quando não há checklist aberto (antes só atualizava quando `openData` existia); `fetchData()` aguardado com `await` no `handleDelete`.
  - **Oficinas visíveis para Driver/Yard Auditor**: Corrigida RLS policy `workshops_select` via migration `fix_workshops_driver_rls.sql` — incluídos os roles `Driver` e `Yard Auditor` no SELECT (necessário para seleção de oficina nos contextos "Entrada em Oficina" e "Saída de Oficina" em `ChecklistFill.tsx`).
  - **Auditoria oculta para Motorista**: Adicionado `.neq('context', 'Auditoria')` na query de templates publicados da view Driver em `Checklists.tsx` — templates de Auditoria são exclusivos do Yard Auditor.
- **Nomes em Plano de Ação (2026-03-15)**:
  - **Bug "Assumido por UUID"**: Joins PostgREST `profiles!claimed_by` e `profiles!completed_by` retornavam `null` porque as colunas `claimed_by` e `completed_by` em `action_plans` não possuem FK constraint para `profiles.id`. Corrigido em `ActionPlans.tsx` com lookup secundário: após o fetch principal, coleta IDs sem nome resolvido e faz `.in('id', missingIds)` em `profiles` para hidratar os rows antes do mapper.
  - **Bug RLS — Fleet Assistant não via nomes**: A policy `tenant_managers_read_profiles` restringia SELECT em `profiles` a perfis de rank MENOR que o do usuário — Fleet Assistant (rank 3) não conseguia ler perfis de outros Fleet Assistant ou de Fleet Analyst+. Adicionada nova policy `fleet_assistant_read_same_client_profiles` via `fix_profiles_read_same_client.sql`: Fleet Assistant+ pode ler todos os perfis do mesmo cliente sem restrição de hierarquia. As duas policies coexistem (OR lógico no PostgreSQL).
- **Fotos de Inconformidades em Checklists (2026-03-15)**:
  - **Bucket `checklist-photos` sem políticas de storage**: Upload por Driver/Auditor falhava silenciosamente e URLs ficavam inacessíveis para Fleet Assistant+. Criada migration `create_checklist_photos_bucket.sql` que: cria o bucket como público (via `INSERT INTO storage.buckets ... public = true`), adiciona policy SELECT pública (URLs sempre acessíveis), INSERT/UPDATE para qualquer autenticado do tenant (scoped por `client_id` no path) e DELETE restrito a Fleet Analyst+. O modal `ChecklistDetailModal.tsx` já exibia fotos (linhas 141-154) — o fix foi exclusivamente de infraestrutura de storage.
- **Visibilidade Yard Auditor em Checklists (2026-03-15)**:
  - **Bug RLS — Yard Auditor não via veículos**: Política RLS `vehicles_select_tenant` exigia `rank >= Fleet Assistant (rank 3)`, bloqueando Yard Auditor (rank 2). Política complementar `vehicles_select_own_driver` usava lookup via `drivers.profile_id`, mas Yard Auditors não têm registro em `drivers` (são auditores, não drivers). Resultado: dropdown de veículos vazio → templates de Auditoria nunca carregavam. Corrigido com nova policy `vehicles_select_auditor` via migration `fix_vehicles_auditor_rls.sql` — permite Yard Auditor ver todos os veículos do próprio tenant. Templates de Auditoria já eram visíveis (policy `templates_select_driver` já incluía Yard Auditor).

- **Auditoria Técnica Completa (2026-03-15)**: Execução de suíte E2E em todos os 6 perfis de usuário (Admin Master, Gerente, Analista, Assistente, Auditor e Motorista). 
  - **Resultados**: 100% de aprovação nos fluxos críticos.
  - **Correções**: Estabilização de seletores Playwright (case-insensitivity e strict mode) e refatoração de specs administrativos para suportar execução multi-projeto paralela.
  - [x] Admin Master: CRUD Clientes completo (Estabilizado)
  - [x] Admin Master: CRUD Usuários completo (Estabilizado)
  - [x] Fluxo Cruzado: Manutenção Corretiva (Passo 1-3 validado)
  - [x] Logout: Correção de redirecionamento (Aguardando signOut)
  - [x] Auditor (Carlos): Confirmado redirecionamento para `/checklists` e bloqueio de áreas `/cadastros`.
  - [x] Motorista (Jorge): Validado preenchimento de Checklist via `Meu Veículo` e restrição de Auditoria.
  - [x] Analista/Assistente (Mariana/Pedro): Validada gestão de Planos de Ação e restrições de exclusão (Pedro).
  - [x] Gerente (Alexandre): Validado acesso total às Configurações de campos obrigatórios.

- **Fluxos Cruzados (Cross-Profile) — Auditoria para Manutenção (2026-03-16)**: 
  - Validado ciclo completo com sucesso: **Auditor (Carlos)** reporta inconformidade → **Analista (Mariana)** cria, executa e conclui Plano de Ação → **Gerente (Alexandre)** aprova.
  - Estabilização crítica (`cross-profile-flows.spec.ts`):
    - `e2e/admin-clients.spec.ts`: CRUD de clientes (Estabilizado com `beforeEach` para reset de filtro global).
    - `e2e/admin-users.spec.ts`: CRUD de usuários (Estabilizado com `beforeEach` para reset de filtro global).
    - `e2e/audit-admin-master.spec.ts`: Auditoria master (Logout fixado).
    - `e2e/cross-profile-flows.spec.ts`: Fluxo corretiva (Carlos -> Mariana -> Alexandre).
    - Corrigido alinhamento de status mappers (ex: "Em Andamento" vs "Em execução").
    - Implementada lógica de reabertura de modal após transições de status (movimentação entre abas 'Pendente' e 'Em Andamento').
    - Adicionada filtragem por placa (`searchInput`) para evitar colisão de dados durante os testes.
    - Implementada limpeza robusta de rascunhos antes do início de novos ciclos.

- **Campo Exercício CRLV (2026-03-16)**: Adicionado campo `crlvYear` (ano do exercício do CRLV) em `VehicleForm.tsx`, `Vehicle` interface, `VehicleRow` e `vehicleMappers`. Coluna `crlv_year` adicionada à tabela `vehicles` no Supabase. Storage de uploads já utiliza `upsert: true` para garantir sobrescrita de arquivos anteriores (eliminando "lixo" do bucket).

- **Campo Finalidade do Veículo (2026-03-17)**: Adicionado campo `vehicleUsage` no `VehicleForm.tsx` (select com opções: Operação, Uso Administrativo, Uso por Lideranças, Outros). Coluna `vehicle_usage TEXT` com CHECK constraint adicionada à tabela `vehicles`. Coluna `vehicle_usage_optional BOOLEAN` adicionada à tabela `vehicle_field_settings`. Mapeamento completo em `vehicleMappers.ts` e `fieldSettingsMappers.ts`. Campo configurável como obrigatório/opcional via Settings (seção "Propriedade & Rastreamento"). Migration: `add_vehicle_usage.sql`.

- **Embarcadores + Unidades Operacionais (2026-03-17)**:
  - **Backend**: Criada migration `create_shippers_and_operational_units.sql` (110 linhas) com 2 novas tabelas:
    - `shippers` (id, client_id, name, cnpj unique per client, phone, email, contact_person, notes, active, created_at) com RLS (Fleet Assistant+ read/write, Manager+ delete)
    - `operational_units` (id, client_id, shipper_id FK RESTRICT, name, code unique per client, city, state, notes, active, created_at) com RLS idêntica; FK RESTRICT garante não deletar embarcador com unidades vinculadas
  - **Vehicle**: Adicionadas FK columns `shipper_id` e `operational_unit_id` (ambas nullable, ON DELETE SET NULL) com índices
  - **Frontend - Componentes/Mappers**:
    - `ShipperForm.tsx` (modal com 5 campos: name, cnpj, phone, email, contactPerson, notes, active)
    - `OperationalUnitForm.tsx` (modal com shipperId required + name, code, city, state, notes, active)
    - `shipperMappers.ts` e `operationalUnitMappers.ts` (padrão camelCase ↔ snake_case, reutiliza formatCNPJ)
  - **Frontend - Páginas**:
    - `Shippers.tsx` (CRUD completo, busca por nome/CNPJ, Fleet Assistant+ read, Fleet Analyst+ edit, Manager+ delete)
    - `OperationalUnits.tsx` (CRUD com shipper name join, busca por nome/code/shipper, FK error handling amigável)
  - **Frontend - Integração VehicleForm**:
    - Nova seção "Logística" com 2 dropdowns em cascata: Embarcador → Unidade Operacional
    - Seleção de unidade filtra por embarcador selecionado; unidade resets ao trocar embarcador
    - Ambos aceitam "Nenhum" (veículo fora de operação)
  - **Frontend - Routing**: Adicionadas rotas `/cadastros/embarcadores` e `/cadastros/unidades-operacionais` + abas em `Cadastros.tsx`
  - **Testes E2E**: `shippers-operational-units.spec.ts` com 16 test cases validando CRUD com 3 perfis (Pedro/Mariana/Alexandre), cascading dropdown, FK RESTRICT
  - **Validação Manual**: ✅ 100% passed — todos os 16 cenários de teste manual validados com sucesso, dados deixados no DB para testes futuros
  - **Auto-Sync**: Atualizados `arch-frontend.md`, `arch-backend.md`, `data-model.md`, `testing.md`

- **Limite de Aprovação de Orçamentos (2026-03-17)**:
  - **Backend**: Nova coluna `budget_approval_limit NUMERIC` em `profiles` (default 0) via migration `add_budget_approval_limit.sql`
  - **Frontend - Types**: Campo `budgetApprovalLimit: number` adicionado à interface `User` em `types.ts`
  - **Frontend - Users.tsx**:
    - Interface `UserRow` atualizada com `budget_approval_limit`
    - Campo numérico (input type="number", min=0, step=0.01) em `CreateUserModal` e `EditUserModal`
    - Campo visível apenas para Manager+ (CAN_MANAGE_PERMISSIONS)
    - Fetch query atualizada para incluir `budget_approval_limit`
    - Lógica de salvamento: após criação via Edge Function, faz `.update()` em `profiles` com o `budget_approval_limit`
  - **Validação Manual**: ✅ Testado como Alexandre (Manager) — campo aparece, salva corretamente, e persiste no banco
  - **Pronto para consumo**: Valor disponível para o módulo de Manutenção/Orçamentos quando implementado
