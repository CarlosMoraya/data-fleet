# MEMORY-HISTORY - Registro Histórico e Decisões

Este documento preserva o histórico de evolução do projeto **βetaFleet** e as principais decisões de arquitetura tomadas ao longo do tempo.

## Sessão — 2026-06-20 (13:20)

### Aba Conformidade como tela própria de regularidade documental

**O que foi implementado:** a aba `Conformidade` do Dashboard deixou de ser empty-state e passou a renderizar a tela própria de regularidade documental de veículos e motoristas. O painel agora exibe 7 cards fixos, a `Fila de Ação Documental` com 14 categorias acionáveis por deep link e navegação aditiva para `Cadastros > Veículos` e `Cadastros > Motoristas`.

**Arquivos criados:**
- `e2e/completed/dashboard-conformidade.spec.ts`: valida navegação até a aba, presença dos 7 cards, estado vazio da fila e deep link quando houver item acionável.

**Arquivos modificados:**
- `src/components/dashboard/OperationalPanel.tsx`: `VehicleRow` ampliado com campos documentais opcionais compartilhados pelo Dashboard.
- `src/pages/Dashboard.tsx`: queries `dashboard-vehicles` e `dashboard-drivers` expandidas; cálculos documentais adicionados em `useMemo`; `ConformityPanel` agora recebe dados prontos; navegação via `COMPLIANCE_ACTION_ROUTES`.
- `src/lib/dashboardKpi.ts`: adicionadas funções puras de conformidade documental, `ComplianceActionCategory`, `ComplianceActionItem` e `buildComplianceActionQueue`.
- `src/lib/dashboardKpi.test.ts`: cobertura unitária dos helpers documentais, predicados de irregularidade, taxa documental e fila documental.
- `src/lib/actionQueueRoutes.ts`: adicionado `COMPLIANCE_ACTION_ROUTES`.
- `src/lib/actionQueueRoutes.test.ts`: cobertura das 14 categorias e validação dos `issue` de veículo/motorista.
- `src/lib/vehicleFilters.ts`: novos valores de `issue` para documentos/seguro/contrato, reaproveitando `isBlank`.
- `src/lib/vehicleFilters.test.ts`: cobertura dos novos casos de pendência de veículo.
- `src/lib/driverFilters.ts`: novos valores de `issue` para GR vencida, CNH ausente e GR ausente com restrição de vínculo a veículo.
- `src/lib/driverFilters.test.ts`: cobertura dos novos casos de pendência de motorista.
- `src/components/dashboard/ConformityPanel.tsx`: reescrito como componente apresentacional com 7 cards, loading e `Fila de Ação Documental`.
- `src/components/dashboard/ConformityPanel.test.tsx`: suíte reescrita para refletir o novo painel.
- `docs/MEMORY.md`: estado vigente do Dashboard e definições documentais atualizados.
- `docs/MEMORY-HISTORY.md`: este arquivamento.

**Decisões tomadas:**
- `Conformidade Documental` usa base = `veículos.length + motoristas.length`; quando a base é 0, a taxa retorna `100`.
- `Itens Críticos` = `Documentos Vencidos + Documentos Ausentes`; itens `a vencer em 30 dias` não são críticos.
- `Sem GR/CRLV/CNH` usa upload nulo, indefinido, vazio ou em branco.
- `Veículo sem Apólice de Seguro` usa `has_insurance !== true`; `Veículo sem Contrato de Manutenção` usa `has_maintenance_contract !== true`.
- `Motoristas sem GR` contam apenas motoristas vinculados a pelo menos 1 veículo; GR vencida/a vencer continua considerando todos os motoristas.
- Configuração per-cliente de campos opcionais (`VehicleFieldSettings`/`DriverFieldSettings`) permanece ignorada nesta v1 da Conformidade.

**Validações executadas:**
- `npm run lint` ✅
- `npm run test:unit` ✅ (496 testes)
- `npm run test:smoke` ✅ (6/6)
- `npx playwright test e2e/completed/dashboard-conformidade.spec.ts --project=chromium` ✅ (2/2, incluindo setup)

**Observações para sessões futuras:**
- Se o produto quiser distinguir “tem seguro” de “tem documento do seguro anexado”, a próxima versão pode cruzar `has_insurance` com `insurance_policy_upload`.
- O mesmo vale para contrato de manutenção: hoje a conformidade usa apenas a flag `has_maintenance_contract`.

## Sessão — 2026-06-20 (10:45)

### Reescrita da aba Operação do Dashboard

**O que foi implementado:** a aba `Operação` do Dashboard foi reescrita para focar exclusivamente em disponibilidade, manutenção, checklists, recuperação de frota e gargalos de rodagem. O painel agora renderiza exatamente 8 cards fixos e a `Fila de Ação Operacional`, sem gráficos e sem cards/filas de documentos.

**Arquivos modificados:**
- `src/lib/dashboardKpi.ts`: adicionados `OperationalActionCategory`, `OperationalActionItem`, `buildOperationalActionQueue` e as novas funções puras `getEndOfWeekIso`, `countVehiclesWithoutDriver`, `getVehiclesWithoutDriverPlates`, `countOpenOrders`, `countActiveOrdersExitingByEndOfWeek`, `getActiveOrdersExitingByEndOfWeekVehicleIds`, `countActiveOrdersDueWithinDays`, `getActiveOrdersDueWithinDaysVehicleIds`, `countPendingBudgetOrders` e `getPendingBudgetVehicleIds`.
- `src/lib/dashboardKpi.test.ts`: cobertura unitária das novas regras de KPI e da fila operacional.
- `src/lib/actionQueueRoutes.ts`: adicionado `OPERATIONAL_QUEUE_ROUTES` com cobertura total das categorias operacionais.
- `src/lib/actionQueueRoutes.test.ts`: validação das novas rotas operacionais e dos deep links existentes.
- `src/components/dashboard/ActionQueue.tsx`: generalizado para item estrutural e novo `title` opcional, preservando o visual e o comportamento da fila.
- `src/components/dashboard/OperationalPanel.tsx`: reescrito como componente apresentacional com 8 cards fixos e `Fila de Ação Operacional`.
- `src/components/dashboard/OperationalPanel.test.tsx`: suíte reescrita para refletir a nova composição da aba.
- `src/pages/Dashboard.tsx`: nova query `dashboard-action-plans-open`, novos cálculos operacionais em `useMemo`, novo handler via `OPERATIONAL_QUEUE_ROUTES` e remoção da antiga fila documental da aba `Operação`.
- `e2e/completed/dashboard-action-queue-navigation.spec.ts`: navegação operacional alinhada aos itens atuais da fila na aba `Operação`.
- `docs/MEMORY.md`: estado vigente atualizado.
- `docs/MEMORY-HISTORY.md`: este arquivamento.

**Decisões tomadas:**
- `Veículos Indisponíveis` reutiliza a mesma regra da Visão Geral (`countVehiclesInMaintenance(...)` sobre veículos distintos com OS ativa).
- `OS com Prazo Vencido` substitui apenas o rótulo anterior `OS em Atraso`; a regra permanece `expected_exit_date < hoje` em OS ativa.
- `Saída Prevista até Fim da Semana` usa janela `today..domingo da semana corrente`; `OS vencendo nos próximos 7 dias` permanece apenas na fila.
- `Planos de Ação Abertos` usam SELECT direto em `action_plans` com status `pending`, `in_progress` e `awaiting_conclusion`, sem migration e sem nova RPC.
- O card de planos mostra o total de planos abertos; o item da fila usa apenas placas resolvidas por `vehicle_id`.

**Validações executadas:**
- `npm run lint` ✅
- `npm run test:unit -- dashboardKpi actionQueueRoutes OperationalPanel` ✅

**Observações para sessões futuras:**
- A aba `Conformidade` continua sendo o destino natural para a fila documental removida da Operação; `buildActionQueue` e os mapas antigos foram preservados para esse uso futuro.
- Se a tela de `Manutenção` ganhar deep links por status, `OPERATIONAL_QUEUE_ROUTES` deve ser refinado para os cards e itens hoje apontando genericamente para `/manutencao`.

---

## Sessão — 2026-06-20 (10:00)

### Visão Geral do Dashboard reescrita como raio-x executivo da frota

**O que foi implementado:** reescrita da aba `Visão Geral` do Dashboard para exibir exatamente 8 cards executivos e o bloco `Mapa da Frota` com 6 gráficos, sem alterar schema de banco e sem mexer na lógica/render da aba `Operação` além da ampliação opcional do tipo `VehicleRow`.

**Arquivos modificados:**
- `src/components/dashboard/OperationalPanel.tsx`: interface `VehicleRow` expandida com `category`, `brand`, `model`, `acquisition`, `has_insurance` e `tracker` como campos opcionais.
- `src/pages/Dashboard.tsx`: query `dashboard-vehicles` expandida para ler os 6 novos campos; cálculo e injeção dos novos KPIs executivos (`availableVehicles`, `unavailableVehicles`, `trackerCoverageRate`, `insuranceCoverageRate`) no `OverviewPanel`; remoção das props antigas de OS da Visão Geral.
- `src/lib/dashboardKpi.ts`: adicionadas funções puras `calculateInsuranceCoverageRate`, `calculateTrackerCoverageRate`, `buildFleetCountByKey` e `buildTopFleetModels`.
- `src/lib/dashboardKpi.test.ts`: cobertura unitária para os novos cálculos de cobertura e agrupamento.
- `src/components/dashboard/OverviewPanel.tsx`: painel reescrito para renderizar os 8 cards aprovados e o bloco `Mapa da Frota` com 6 instâncias de `VehicleTypeBarChart` em `Suspense`.
- `src/components/dashboard/OverviewPanel.test.tsx`: regressões atualizadas para ausência dos cards removidos e presença dos novos rótulos/cabeçalho.
- `docs/MEMORY.md`: estado vigente do Dashboard atualizado.
- `docs/MEMORY-HISTORY.md`: este arquivamento.

**Decisões tomadas:**
- `Veículos Indisponíveis` reutiliza `countVehiclesInMaintenance(...)` por equivalência exata com a definição de veículo com OS ativa.
- `Veículos Disponíveis` = total da frota menos indisponíveis; `Disponibilidade da Frota` continua derivada por `calculateFleetAvailability(...)`.
- `Cobertura de Seguro` usa `has_insurance`; `Cobertura de Rastreador` usa `tracker` não-vazio, sem heurística semântica nesta sessão.
- Os 6 gráficos do `Mapa da Frota` são apenas exibição nesta v1: `activeFilter={null}` e `onFilterChange={() => {}}`, sem deep link novo.

**Validações executadas:**
- `npm run lint` ✅
- `npm run test:unit` ✅ (460 testes)
- `npm run test:smoke` ✅ (6/6)

**Observações para sessões futuras:**
- Migrar `Cobertura de Rastreador` para coluna booleana dedicada (`has_tracker`) com backfill aditivo no banco.
- Avaliar drill-down interativo nos gráficos do `Mapa da Frota` em sessão separada.

---

## Sessão — 2026-06-19 (21:20)

### Padronização de deep links de filtros operacionais (Veículos e Motoristas)

**O que foi implementado:** padronização dos filtros de navegação acionável das telas de Veículos e Motoristas como deep links em query params, com nomes unificados em inglês (`issue`, `shipper`, `unit`, `q`), mantendo retrocompatibilidade com nomes/valores legados em português.

**Arquivos criados:**
- `e2e/completed/filter-deeplink-standard.spec.ts`: 6 testes E2E cobrindo link compartilhável, botão voltar, limpar filtro, não persistência, retrocompat e busca na URL.

**Arquivos modificados:**
- `src/lib/vehicleFilters.ts`: valores de `VehiclePendency` renomeados para inglês (`crlv_expired`/`crlv_expiring`/`gr_expiring`/`no_driver`/`checklist_overdue`); `parseVehicleFiltersFromParams` lê `issue`/`shipper`/`unit` com fallback legado; `serializeVehicleFiltersToParams` escreve nomes novos + `q` opcional; adicionados `LEGACY_VEHICLE_ISSUE_VALUES`, `SEARCH_PARAM`, `parseSearchFromParams`, `hasLegacyVehicleParams`.
- `src/lib/vehicleFilters.test.ts`: atualizados para novos valores + testes de retrocompat, serialize com `q`, `hasLegacyVehicleParams`, migração de legado.
- `src/lib/driverFilters.ts`: valores de `DriverPendency` renomeados para inglês (`cnh_expired`/`cnh_expiring`/`gr_expiring`/`with_vehicle`/`without_vehicle`); `parseDriverFiltersFromParams` lê `issue` com fallback `situacao`; `serializeDriverFiltersToParams` escreve nomes novos; adicionados `LEGACY_DRIVER_ISSUE_VALUES`, `hasLegacyDriverParams`.
- `src/lib/driverFilters.test.ts`: idem com retrocompat e novos testes.
- `src/lib/actionQueueRoutes.ts`: rotas atualizadas para `?issue=` com valores em inglês.
- `src/lib/actionQueueRoutes.test.ts`: asserções atualizadas.
- `src/pages/Vehicles.tsx`: busca derivada da URL (`parseSearchFromParams`); `setSearch` com `replace: true`; `updateFilter` preserva search com `replace: false`; `clearAllFilters` sem `setSearch('')`; `useEffect` de normalização de legado; removido `usePersistentFilterState` para search.
- `src/pages/Drivers.tsx`: idem com funções de `driverFilters.ts`.
- `src/components/VehicleActiveFilterBanner.tsx`: props renomeadas (`pendencyLabel`→`issueLabel`, `onClearPendency`→`onClearIssue`); `aria-label` → "Remover filtro".
- `src/components/DriverActiveFilterBanner.tsx`: idem (`situationLabel`→`issueLabel`, `onClearSituation`→`onClearIssue`).
- `e2e/completed/vehicles-structured-filters.spec.ts`: atualizado para novos params/valores.
- `e2e/completed/driver-structured-filters.spec.ts`: idem.
- `e2e/completed/dashboard-action-queue-navigation.spec.ts`: idem + `aria-label` "Remover filtro".
- `agent/AGENT-FRONTEND.md`: adicionada seção "Deep links de filtros operacionais" com regras, convenção de nomes, comportamento de `setSearchParams` e retrocompat.

**Decisões tomadas:**
- Valores internos do enum passam a ser idênticos aos valores da URL (inglês), eliminando camada de tradução.
- Busca textual movida de `sessionStorage` para a URL em ambas as telas — risco LGPD aceito (sistema enterprise interno, autenticado, multi-tenant com RLS).
- Banners continuam exibindo apenas o `issue` ativo (não `shipper`/`unit`/`q`).
- `uiStateStorage.ts` sem alterações de lógica; chaves antigas de search são limpas no logout pelo prefixo `session` existente.

**Validações executadas:**
- `npm run lint` ✅ (0 erros)
- `npm run test:unit` ✅ (444 testes, +14 novos)
- `npm run test:smoke` ✅ (6/6)
- `npx playwright test e2e/completed/filter-deeplink-* e2e/completed/vehicles-structured-filters.spec.ts e2e/completed/driver-structured-filters.spec.ts e2e/completed/dashboard-action-queue-navigation.spec.ts` ✅ (19/19)

**Observações para sessões futuras:**
- Considerar exibir `shipper`/`unit`/`q` no banner de filtro ativo.
- Convenção `q` pode ser estendida a outras telas com busca (Manutenção, Pneus).
- Avaliar `useUiPreference` para filtro padrão por usuário (ex: unidade fixa).

---

## Feature — 2026-06-19

### Nova aba "Evolução" no Dashboard — análise mensal e tendência histórica com seletor de horizonte

**O que foi implementado:** 4ª aba do Dashboard (`Evolução`), dedicada a indicadores mensais e tendência histórica, com seletor de horizonte (3/6/12 meses ou ano atual) em vez de datas soltas.

**Arquivos criados:**
- `src/components/dashboard/MonthlyMultiBarChart.tsx`: gráfico de barras multi-série (agrupado ou empilhado), reutilizável.
- `src/components/dashboard/HorizonSelector.tsx`: controle segmentado com 4 opções fixas.
- `src/components/dashboard/EvolutionPanel.tsx`: painel da aba, com `HorizonSelector` + 4 gráficos (2 linha, 2 barras).
- `src/components/dashboard/EvolutionPanel.test.tsx`: 4 testes de render (labels, títulos, interação, empty state).

**Arquivos modificados:**
- `src/lib/dashboardKpi.ts`: adicionados `HorizonOption`, `resolveHorizonRange`, `buildMonthlyOrderCounts`, `buildMonthlyAverageCompletionDays`, `buildMonthlyMaintenanceTypeCounts`.
- `src/lib/dashboardKpi.test.ts`: 12 testes novos para as funções acima.
- `src/pages/Dashboard.tsx`: adicionada aba `evolucao` (ícone `LineChart`), estado `horizon` persistido (default `6m`), query `dashboard-evolution` gated por `activeTab === 'evolucao'`, render do `EvolutionPanel`.

**Decisões tomadas:**
- Custo por KM mensal: FORA da v1 (dados esparsos → adiado para v2).
- Documentos/checklists vencidos: excluídos por design (estado atual, sem histórico armazenado).
- Tempo médio por mês mostra `0` em meses sem conclusão (limitação aceita; interrupção de linha fica como melhoria futura).
- Horizonte padrão: `6m`, persistido via `useUiPreference`.
- Aba `Custos` permanece intacta (reúso de `buildCostTrendSeries` + `CostTrendChart`, sem migração).

**Validações executadas:**
- `npm run lint` ✅ (`tsc --noEmit` limpo)
- `npm run test:unit` ✅ (434 testes, +16 novos)
- `npm run test:smoke` ✅ (6/6)

**Débitos para v2:**
- Custo por KM mensal — exige KM-rodado por mês confiável (nova RPC mensal ou modelo de odômetro por período).
- Tornar gráficos da Evolução interativos (drill-down por tipo/mês).
- "Tempo médio por mês" com interrupção de linha em meses vazios.

---

## Correção — 2026-06-19

### Bug corrigido — Fila de Ação não aplicava filtro ao navegar para Motoristas

**Sintoma:** clicar num item de motorista da Fila de Ação do Dashboard (Motoristas com CNH vencida, CNH a vencer ou GR do motorista a vencer) navegava para `/cadastros/motoristas` sem o parâmetro de filtro. A tela abria listando todos os motoristas, sem filtro aplicado, sem banner de "Filtro ativo" e sem o botão "Limpar filtros".

**Causa raiz (Tipo A — bug isolado):** `src/lib/actionQueueRoutes.ts` mapeava as 3 categorias de motorista (`cnh`, `cnh_expiring`, `gr_driver_expiring`) para a rota crua `/cadastros/motoristas`, sem o query param `?situacao=`. O Dashboard navega exatamente com a string desses mapas; a tela de Motoristas lê `situacao` corretamente — faltou estender o mapa de rotas, análogo ao `?pendencia=` que já existe para veículos.

**Correção aplicada:** adicionado `?situacao=cnh_vencida`, `?situacao=cnh_a_vencer` e `?situacao=gr_a_vencer` às chaves `cnh`, `cnh_expiring` e `gr_driver_expiring` em `GENERAL_ACTION_ROUTES` e `OPERATIONAL_ACTION_ROUTES`.

**Arquivos modificados:**
- `src/lib/actionQueueRoutes.ts`: valores das 3 chaves de motorista nos dois mapas.
- `src/lib/actionQueueRoutes.test.ts`: asserções atualizadas para as rotas com query param + novo teste de regressão "uses only valid driver situation values in driver routes".

**Validações executadas:**
- `npx vitest run src/lib/actionQueueRoutes.test.ts` ✅ (5 testes)
- `npm run test:unit` ✅ (414 testes, +1 novo de regressão)
- `npm run lint` ✅ (`tsc --noEmit` limpo)

**Observações para sessões futuras:**
- Débito técnico opcional: as rotas de veículo usam `pendencia` e as de motorista usam `situacao`. A divergência é intencional (cada tela tem sua chave), mas uma sessão futura poderia avaliar unificar ou centralizar a construção das rotas a partir das constantes de cada módulo.

---

### Bug corrigido — 404 (PGRST202) nas RPCs de agregação do Dashboard

**Sintoma:** ao abrir o Dashboard, o DevTools mostrava `POST 404 (Not Found)` para `dashboard_previous_period_cost`, `dashboard_cost_projection_monthly` e `dashboard_vehicle_km_in_period`. Os painéis de custo anterior/variação, projeção mensal e KM rodado ficavam sem dados. `dashboard_last_checklist_per_vehicle` funcionava normalmente (HTTP 200).

**Causa raiz (Tipo D — regressão):** as 3 funções `public.dashboard_previous_period_cost`, `public.dashboard_cost_projection_monthly` e `public.dashboard_vehicle_km_in_period` não existiam no banco Dev (`vvbnbzzhpiksacqudmfu`). Cronologia: em 2026-06-17 as 4 RPCs foram criadas e o bug de 404 foi corrigido; em 2026-06-19, um rollback removeu as 4 RPCs de ambos os bancos (`20260619000003`); a reversão subsequente recriou apenas `dashboard_last_checklist_per_vehicle` (`20260619000005`), e as outras 3 nunca foram reexecutadas no SQL Editor — migrações são manuais, então commitar o SQL não o aplica ao banco.

**Correção aplicada:** CREATE OR REPLACE das 3 funções `SECURITY INVOKER` + `GRANT EXECUTE TO authenticated` + `NOTIFY pgrst 'reload schema'` no SQL Editor do Supabase Dev (`vvbnbzzhpiksacqudmfu`). Conteúdo verbatim das migrações `20260617000000` e `20260617000100`. Nenhum arquivo de `src/` alterado.

**Arquivos criados:**
- `e2e/smoke/dashboard-rpcs-health.spec.ts`: teste E2E de regressão que valida que nenhuma das 4 RPCs do Dashboard retorna 404/PGRST202.

**Arquivos modificados:**
- `docs/MEMORY.md`: decisão "Dashboard RPCs removidas" atualizada para refletir que as RPCs são a abordagem vigente; registro do bug corrigido adicionado.
- `docs/MEMORY-HISTORY.md`: este arquivamento.

**Observações:**
- A lacuna de processo — deploy do frontend é automático (Vercel) mas migrações são manuais — pode causar reincidência deste tipo exato de bug. Avaliar gate de deploy com smoke de saúde das RPCs.
- Arquivos soltos no working tree (`manual-dev-migrations*.sql`, `apply-production-migration.sql`, `apply-dashboard-rpcs-production.sql`) sugerem histórico de migração fora de sync. Consolidação fora do escopo desta correção.
- Produção (`oajfjdadcicgoxrfrnny`) provavelmente está no mesmo estado (3 RPCs faltantes). Aplicar o mesmo SQL no SQL Editor de produção se autorizado pelo usuário.

---

## Arquivamento — 2026-06-19

### Separação do ambiente Dev e massa oficial de testes

**Objetivo:** deixar o desenvolvimento isolado em um Supabase próprio, com dados de teste consistentes e compatíveis com a suíte E2E atual.

**Mudanças aplicadas:**
- `.env.local` passou a apontar o app local para o projeto Supabase Dev `vvbnbzzhpiksacqudmfu`.
- Criado `scripts/seed-betafleet-demo.mjs` como seed oficial idempotente para Dev.
- Criada a migration `supabase/migrations/20260619000000_align_vehicle_columns.sql` para alinhar `vehicles` ao schema atual usado pelo frontend e pelos testes.
- Publicadas no Dev as Edge Functions `create-user`, `delete-user`, `workshop-invitation`, `workshop-accept-invitation` e `workshop-partnership-manage`.

**Massa oficial criada no Dev:**
- Clientes: `BetaFleet Demo`, `BetaFleet Isolamento`, `Deluna Transportes` e `BetaFleet`.
- Usuários alinhados ao Playwright: Admin Master, Fleet Analyst, Fleet Assistant, Manager, Yard Auditor, Driver, Coordinator, Supervisor, Operations Manager e Workshop.
- Dados operacionais: veículos, motoristas, oficina, conta de oficina, agendamento, checklist, plano de ação, OS de manutenção, pneus e inspeção de pneus.

**Ajustes de teste feitos:**
- `e2e/completed/driver-checklist-visibility.spec.ts` passou a usar o cliente do Dev e o schema atual.
- `e2e/completed/driver-user-integration.spec.ts` passou a fazer login explícito com `TEST_ANALYST_*` e `TEST_MANAGER_*`, removendo dependência de `storageState` frágil.
- `e2e/completed/regression-optim-tenant-isolation.spec.ts` passou a escolher o tenant por texto exato, evitando ambiguidade entre `BetaFleet` e `BetaFleet Demo`.

**Validação final:**
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:smoke` ✅
- `npm run test:e2e` ✅ (`170/170`)

**Nota operacional:** não houve commit nem push desta sessão; as mudanças ficaram apenas no worktree local.

### Auditoria e sincronização dos bancos Dev e Prod

**Objetivo:** garantir que os bancos de dados de desenvolvimento (`vvbnbzzhpiksacqudmfu`) e produção (`oajfjdadcicgoxrfrnny`) espelhem 100% a mesma estrutura — tabelas, colunas, funções, constraints, índices, triggers e RLS policies.

**Método:** extração de schema completo via `pg_dump --schema-only` de ambos os bancos (conexão direta via Docker com `public.ecr.aws/supabase/postgres:17.6.1.127`), comparação com `diff` e aplicação de migrations de sincronização.

**Migrations criadas:**
- `supabase/migrations/20260619000001_sync_dev_to_prod.sql`: aplica no DEV tudo que existe no PROD e ainda não foi aplicado (8 mudanças aditivas).
- `supabase/migrations/20260619000002_sync_prod_additions.sql`: aplica no PROD tudo que existe no DEV e ainda não foi aplicado (5 mudanças aditivas).
- `supabase/migrations/20260619000003_register_missing_schema.sql`: registra no projeto todos os elementos de schema que existem nos bancos mas nunca foram capturados em arquivos de migration.

**Sincronização DEV → espelhar PROD (aplicado no DEV):**

| # | Mudança | Impacto |
|---|---------|---------|
| 1 | Adicionar `'Agregado'` ao CHECK `vehicles_acquisition_check` | Expande opções, não remove dados |
| 2 | Remover coluna `brand_model` | Redundante (já existe `brand` + `model`) |
| 3 | Tornar `brand` e `model` NOT NULL com `DEFAULT ''` | Veículos sem marca recebem `''` |
| 4 | Criar função `handle_updated_at()` | Nova função, não conflita com a existente |
| 5 | Trocar trigger `set_maintenance_updated_at` para usar `handle_updated_at()` | Mesmo comportamento, função padronizada |
| 6 | Remover `CASCADE` da FK `vehicle_field_settings_client_id_fkey` | Igual ao PROD: bloqueia exclusão se houver settings |
| 7 | Adicionar 3 policies `tenant_managers_*` em `profiles` | Aditivas, não conflitam |
| 8 | Atualizar 3 policies de `drivers` (insert/update/delete) | Adiciona Supervisor e Coordinator |

**Sincronização PROD → adicionar do DEV (aplicado no PROD):**

| # | Mudança | Impacto |
|---|---------|---------|
| 1 | Adicionar coluna `status` com `DEFAULT 'Available'` | Veículos existentes recebem "Available" |
| 2 | Adicionar CHECK `vehicles_status_check` | Valida novos registros |
| 3 | Adicionar coluna `is_free_form` com `DEFAULT false` | Templates existentes recebem `false` |
| 4 | Tornar `vehicle_category` nullable | Permite categoria livre |
| 5 | Adicionar CHECK `check_free_form_or_category` | Garante consistência |

**Lacunas de migration registradas (elementos que existiam no DB mas nunca tiveram migration):**

| Elemento | Situação anterior | Status |
|----------|-------------------|--------|
| Tabela `vehicles` (base + todas as colunas) | Criada manualmente via Dashboard | ✅ Registrada |
| Tabela `vehicle_field_settings` (base + todas as colunas) | Criada manualmente via Dashboard | ✅ Registrada |
| Função `get_my_client_id()` | Usada por 7+ migrations, nunca criada | ✅ Registrada |
| Função `get_my_role()` | Usada por 5+ migrations, nunca criada | ✅ Registrada |
| Função `is_admin_master()` | Usada por 3+ migrations, nunca criada | ✅ Registrada |
| Função `set_updated_at()` | Usada pelo trigger, nunca criada | ✅ Registrada |
| Função `role_rank()` | Apenas `CREATE OR REPLACE`, sem criação inicial | ✅ Registrada |
| Função `handle_updated_at()` | Criada no sync | ✅ Registrada |
| Trigger `vehicles_updated_at` | Criado manualmente, sem migration | ✅ Registrado |
| Index `vehicles_client_plate_uniq` | Criado manualmente, sem migration | ✅ Registrado |
| Constraint `vehicles_energy_source_check` | Criada manualmente, sem migration | ✅ Registrada |
| Constraint `vehicles_category_check` | Existia só no DEV | ✅ Adicionada no PROD |
| Coluna `profiles.can_delete_vehicles` | Referenciada mas nunca adicionada | ✅ Registrada |
| Coluna `profiles.can_delete_workshops` | Referenciada mas nunca adicionada | ✅ Registrada |
| Dashboard RPCs (4 funções) | Deveriam ter sido removidas pelo rollback | ✅ Removidas de ambos |

**Resultado final:**
- DEV: 33 tabelas, 24 funções, 139 RLS policies, 5 triggers
- PROD: 33 tabelas, 24 funções, 139 RLS policies, 5 triggers
- Diferenças restantes: apenas cosméticas (formatação de funções e ordem de colunas — sem impacto funcional)

**Decisões tomadas:**
- `brand_model` removido do DEV (redundante com `brand` + `model` separados já usados pelo código).
- `status` adicionado ao PROD com `DEFAULT 'Available'` (aditivo, zero risco).
- `is_free_form` adicionado ao PROD com `DEFAULT false` (aditivo, zero risco).
- CASCADE removido da FK `vehicle_field_settings` no DEV (igual ao PROD: protege exclusão de cliente com settings).
- Dashboard RPCs removidas de ambos os bancos (rollback aplicado via `20260619000003`).

---

## Arquivamento — 2026-06-17

### Bug corrigido — Dashboard com 404 nas RPCs de agregação (dev e produção)

**Sintoma:** ao abrir o Dashboard (tanto em `localhost:3000` quanto em produção), o DevTools mostrava quatro `POST` com status **404 (Not Found)** para `rpc/dashboard_vehicle_km_in_period`, `rpc/dashboard_previous_period_cost`, `rpc/dashboard_cost_projection_monthly` e `rpc/dashboard_last_checklist_per_vehicle`. Os painéis de custo anterior/variação, projeção mensal, última checklist por veículo e KM rodado ficavam sem dados.

**Causa raiz (Tipo D — regressão):** as quatro funções `public.dashboard_*` nunca foram criadas no projeto Supabase `oajfjdadcicgoxrfrnny`. As migrações `20260617000000_create_dashboard_cost_rpcs.sql` e `20260617000100_create_dashboard_checklist_rpcs.sql` foram commitadas (commit `d3fa705`) e o `src/pages/Dashboard.tsx` passou a chamá-las via `supabase.rpc(...)`, mas o SQL nunca foi executado no SQL Editor (migrações são manuais). Dev e produção usam o **mesmo** backend Supabase (`.env.local` → `VITE_SUPABASE_URL=https://oajfjdadcicgoxrfrnny.supabase.co`), por isso o 404 aparecia em todos os ambientes.

**Correção aplicada:** execução, no SQL Editor do Supabase, do bloco idempotente `apply-dashboard-rpcs-production.sql` (CREATE OR REPLACE das 4 funções `SECURITY INVOKER` + `GRANT EXECUTE ... TO authenticated`), com conteúdo verbatim das duas migrações. Nenhum arquivo de `src/` foi alterado. Validado manualmente: Dashboard recarregado, as quatro RPCs retornam `200` e os painéis exibem dados. Aprovado pelo usuário em 2026-06-17.

**Observações registradas (fora do escopo da correção):**
- Dev e produção compartilham o mesmo projeto Supabase — não há banco de desenvolvimento isolado; avaliar projeto separado para dev.
- Lacuna de processo: frontend faz deploy automático (Vercel) mas migrações são manuais — risco de "código novo dependente de migração não aplicada". Considerar checklist de deploy e smoke de saúde das RPCs do Dashboard.
- Rollback disponível em `supabase/migrations/20260617000200_rollback_dashboard_rpcs.sql`.

### Suíte E2E de regressão pós-otimização e correções de persistência

Implementada suíte de regressão para validar que as otimizações recentes de cache, code splitting, lazy loading, persistência de UI e Dashboard não quebram fluxos críticos da SPA.

**Correções aplicadas:**
- `src/pages/Settings.tsx`: `saveDriverMutation.onSuccess` passou a invalidar `['driverFieldSettings', currentClient?.id]`, espelhando a mutação de veículo.
- `src/lib/cachePolicy.ts`: removidas da allowlist persistida as chaves `vehicleFieldSettings`, `vehicleSettings`, `driverFieldSettings` e `driverSettings`, evitando reidratação stale em reload após save.
- `src/pages/Checklists.tsx`: abas de Checklists receberam `role="tablist"`, `role="tab"` e `aria-selected`.
- `src/context/AuthContext.tsx`: logout passou a chamar `clearCurrentUserUiState(user.id)` diretamente antes do `signOut`, garantindo limpeza de chaves `bf:v1:ui:*` mesmo quando o callback assíncrono de auth não captura o usuário atual.

**Cobertura E2E adicionada:**
- `e2e/completed/regression-optim-persistence-reload.spec.ts`: filtros persistem e conteúdo reidrata após reload em Veículos, Motoristas, Pneus e Manutenção.
- `e2e/completed/regression-optim-tenant-isolation.spec.ts`: troca Admin Master entre Deluna Transportes e BetaFleet não vaza placas/dados do tenant anterior.
- `e2e/completed/regression-optim-logout-clears-data.spec.ts`: logout via UI remove `betafleet-rq-cache`, chaves `bf:v1:ui:*` e legados sensíveis.
- `e2e/completed/regression-optim-lazy-libs.spec.ts`: gráficos do Dashboard e rota de PDF não emitem erro de chunk/lazy loading.
- `e2e/completed/regression-optim-routesplit-ttuc.spec.ts`: rotas principais resolvem chunks e conteúdo útil dentro de 10s, com logs de TTUC.
- `e2e/completed/ui-state-persistence.spec.ts`: adicionada cobertura de Agendamentos para conteúdo útil, retorno à tela e rascunho sem dados sensíveis.

**Ajustes de testes existentes:**
- `src/lib/cachePolicy.test.ts`: teste de referência passou a usar chave ainda permitida e foi adicionada asserção explícita de que as 4 chaves de settings não persistem.
- `e2e/completed/tire-inspection-assistant.spec.ts`: helper da aba de inspeções passou de `getByRole('button')` para `getByRole('tab')`, acompanhando a semântica ARIA correta.
- `e2e/completed/ui-state-persistence.spec.ts`: teste de namespace agora provoca gravação de busca antes de inspecionar `sessionStorage`.

**Validações executadas:**
- `npm run lint` ✅
- `npm run test:unit` ✅ (39 arquivos, 384 testes)
- E2E direcionado de settings/UI state ✅ (15/15)
- Specs novas pós-otimização ✅ (11/11)
- `npm run test:smoke` ✅ (6/6)
- `npx playwright test` ✅ (165/165)

**Performance:** `npm run perf` executou build e testes Playwright de performance com sucesso, mas o gate comparativo acusou regressões acima de 15% em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs`. Em 17/06/2026, o usuário aceitou essas regressões como oportunidades de melhoria futura e decidiu seguir no desenvolvimento do sistema. O baseline de performance não foi atualizado nesta sessão.

## Arquivamento — 2026-06-17

### Agregações do Dashboard via RPCs Supabase

Implementada otimização do Dashboard Executivo para mover agregações pesadas de custo e checklist do cliente para o Postgres, preservando os números exibidos e mantendo as funções puras de KPI intactas.

**Arquivos criados:**
- `supabase/migrations/20260617000000_create_dashboard_cost_rpcs.sql`: cria `dashboard_previous_period_cost` e `dashboard_cost_projection_monthly` com `SECURITY INVOKER`.
- `supabase/migrations/20260617000100_create_dashboard_checklist_rpcs.sql`: cria `dashboard_last_checklist_per_vehicle` e `dashboard_vehicle_km_in_period` com `SECURITY INVOKER`.
- `supabase/migrations/20260617000200_rollback_dashboard_rpcs.sql`: remove as quatro RPCs da sessão.
- `src/lib/dashboardRpcParity.test.ts`: testes unitários de paridade entre o caminho antigo em linhas brutas e o novo formato agregado das RPCs.

**Arquivos modificados:**
- `src/pages/Dashboard.tsx`: queries `dashboard-maintenance-previous`, `dashboard-cost-projection` e checklist/KM passaram a usar `supabase.rpc(...)`; queries de veículos, manutenção do período, manutenção ativa, intervalos e motoristas permaneceram inalteradas.
- `src/components/dashboard/CostPanel.tsx`: `Custo por KM` passou a consumir `vehicleKmRows` agregado por veículo, mantendo `dateRange` para série histórica/granularidade.
- `docs/MEMORY.md`: estado vigente atualizado.

**Decisões e segurança:**
- RPCs usam `SECURITY INVOKER`, `SET search_path = public` e `GRANT EXECUTE ... TO authenticated`.
- `p_client_id = NULL` preserva a visão agregada do Admin Master, deixando o RLS existente governar o acesso cross-tenant.
- Média móvel, cálculo de período anterior e decisão de checklist vencido continuam no cliente via `dashboardKpi.ts`.
- `sumApprovedCostByMonthKeys` permanece em `dashboardKpi.ts` e seus testes, mas não é mais usado pelo Dashboard.

**Validações automatizadas:** `npm run lint` ✅; `npm run test:unit` ✅ (39 arquivos, 382 testes); `npm run test:smoke` ✅ (6 testes).

**Validação manual:** migrations aplicadas no SQL Editor do Supabase sem erro em 17/06/2026; correção de serialização de `checklistIssues` validada manualmente pelo usuário na tela `/checklists`.

## Correção — 2026-06-17

### Regressão de cache das RPCs do Dashboard

Bug corrigido: regressão de requests do Dashboard no protocolo de performance após migração de checklists/KM para RPCs.

**Causa raiz:** as novas query keys `dashboard-last-checklists` e `dashboard-vehicle-km` não estavam na allowlist de persistência React Query em `src/lib/cachePolicy.ts`, fazendo o `PersistQueryClientProvider` descartar essas queries por padrão (default-deny). Resultado: cada execução do protocolo de performance fazia 4 requests extras ao Dashboard, acusando regressão em `route.dashboard.requestCount`.

**Correção aplicada:** adicionadas as duas query keys à seção de chaves `dashboard-*` com `CACHE_TTL.dashboard`. Criado teste unitário de regressão `persists aggregated dashboard RPC queries inside dashboard TTL` para proteger as novas chaves.

**Arquivos modificados:** `src/lib/cachePolicy.ts`, `src/lib/cachePolicy.test.ts`, `e2e/setup/admin-perf.setup.ts`, `docs/MEMORY.md`, `docs/MEMORY-HISTORY.md`.

**Achado adicional:** a correção de cachePolicy.ts isolada não era suficiente. O `admin-perf.setup.ts` salvava o `storageState` antes das queries RPC completarem, capturando localStorage vazio. Adicionado `waitForLoadState('networkidle')` antes do `storageState`, garantindo que o cache React Query seja persistido antes da captura. Com isso, o perf test inicia com cache aquecido e `route.dashboard.requestCount` volta a 0.

**Validações:** `npm run lint` ✅; `npm run test:unit` ✅ (39 arquivos, 383 testes); `npm run perf` ✅ (route.dashboard.requestCount = 0; regressões residuais remanescentes: pneus e manutencao, fora do escopo).

---

## Arquivamento — 2026-06-16

### Política de persistência de cache React Query

Implementada política central e testável de persistência do cache React Query para telas operacionais, com isolamento multi-tenant preservado por `client_id` nas `queryKey`.

**Arquivos criados:**
- `src/lib/cachePolicy.ts`: fonte única default-deny com `CACHE_TTL`, `PERSIST_ALLOWLIST` e `shouldPersistQuery`.
- `src/lib/cachePolicy.test.ts`: cobertura de allowlist, PII recusada, workflows voláteis recusados, helpers sem escopo recusados e TTL expirado.
- `src/lib/cachePolicy.isolation.test.ts`: validação com `QueryClient` real de isolamento entre `['vehicles', 'clienteA']` e `['vehicles', 'clienteB']`, mantendo `drivers` fora da persistência.

**Arquivos modificados:**
- `src/App.tsx`: `PersistQueryClientProvider` passou a delegar `shouldDehydrateQuery` para `shouldPersistQuery`; `buster` atualizado de `v1` para `v2`.
- `docs/MEMORY.md`: estado vigente atualizado com a política ativa e risco aceito.

**Decisões e segurança:**
- Allowlist por prefixo de `queryKey[0]`, com negação por padrão.
- TTLs por tipo: referência 24h, operacional 8h, dashboard 1h e offline 24h.
- PII (`drivers`, `users`, `admin-users`, `driverVehicleMap`), workflows voláteis (`maintenanceOrders`, `budgetApprovals`, `dashboard-active-maintenance`, `workshopSchedules`) e helpers sem escopo (`vehicleTireConfigs`, `availableDrivers`, `availableLogistics`, `availableShippers`) não são persistidos.
- `switchClient` e logout não foram alterados; logout continua limpando `queryClient` e `persister`.
- Risco aceito em 2026-06-16: listas operacionais ficam no `localStorage` sem criptografia até o logout, mas sem PII pesada e com limpeza confirmada.

**Validação manual guiada executada em 16/06/2026 com `coordinator@demo.betafleet.local`:**
- Login e abertura de Cadastros -> Veículos: OK.
- Navegação Veículos -> Embarcadores -> Veículos: OK; tela de Veículos visível ao retornar.
- Reload em Veículos: OK; tela de Veículos visível após recarregar.
- Inspeção de `localStorage.betafleet-rq-cache`: OK; prefixos persistidos observados: `dashboard-checklists`, `dashboard-cost-projection`, `dashboard-drivers`, `dashboard-intervals`, `dashboard-maintenance`, `dashboard-maintenance-previous`, `dashboard-vehicles`, `operationalUnits`, `shippers`, `tires`, `vehicleFieldSettings`, `vehicles`, `vehiclesSimple`.
- Ausência confirmada de prefixos proibidos: `drivers`, `users`, `maintenanceOrders`, `budgetApprovals`, `admin-users`.
- Logout: OK; `betafleet-rq-cache` removido.

**Validações automatizadas:** `npm run test:unit -- cachePolicy` ✅ (2 arquivos, 11 testes); `npm run lint` ✅; `npm run test:unit` ✅ (344 testes); `npm run test:smoke` ✅ (6 testes).

---

### Lazy loading de pdfjs-dist e gráficos do Dashboard

Implementado carregamento sob demanda de `pdfjs-dist` nos fluxos de OCR e dos gráficos do Dashboard que dependem de `recharts`.

**Arquivos criados:**
- `src/lib/ocr/pdfLoader.ts`: loader único com `import()` dinâmico, memoization da Promise e configuração única de `GlobalWorkerOptions.workerSrc`.
- `src/lib/ocr/pdfLoader.test.ts`: cobertura unitária da memoization do loader.

**Arquivos modificados:**
- `src/lib/documentOcr.ts`: OCR de CRLV/CNH passou a obter `pdfjs-dist` via `loadPdfjs()` dentro de `extractPdfText`, sem alterar regex, prompts, fallback ou assinaturas exportadas.
- `src/lib/budgetOcr.ts`: OCR de orçamento passou a obter `pdfjs-dist` via `loadPdfjs()` dentro de `extractPdfText`, sem alterar parse, prompt, fallback ou assinatura exportada.
- `src/components/dashboard/OperationalPanel.tsx`: gráficos carregados com `React.lazy` e grid envolvido por um único `Suspense` com `RouteFallback`.
- `src/components/dashboard/CostPanel.tsx`: `CostTrendChart` e grid de gráficos carregados com `React.lazy` dentro de um único `Suspense` com `RouteFallback`.
- `src/components/dashboard/OperationalPanel.test.tsx`: teste de ordem dos gráficos ajustado para aguardar resolução assíncrona do lazy load.
- `docs/reports/perf/perf-baseline.json`: baseline atualizado após aceite explícito do resultado medido.
- `docs/reports/perf/perf-latest.md`, `docs/reports/perf/perf-latest.json` e `docs/reports/perf/history/perf-2026-06-16-2026.md`: relatório e histórico da medição pós-lazy loading.

**Decisões:**
- `performOcr` permanece importado estaticamente; o peso removido do caminho inicial é o `pdfjs-dist`.
- Os arquivos internos de gráfico permanecem inalterados e continuam importando `recharts`; o lazy loading foi aplicado no nível dos painéis.
- Sem `manualChunks` nesta sessão.
- Gate de performance aceito explicitamente mesmo com regressões em `route.manutencao.requestCount` (`5 -> 6`) e `returnBehavior.returnEntryMs` (`156 ms -> 211 ms`), porque o objetivo principal era deslocar `pdfjs-dist` e `recharts` para chunks sob demanda.

**Métricas antes/depois desta fase:**
- Dashboard: `421,6 KB raw / 118,8 KB gzip` -> `35,9 KB raw / 9,0 KB gzip`.
- `pdfjs-dist`: removido dos imports estáticos de OCR e separado em chunk `pdf-*.js` de `399,7 KB raw / 118,5 KB gzip`.
- `recharts`: removido do chunk principal do Dashboard e separado em chunks de gráficos (`VehicleTypeBarChart`, `MaintenanceTypeDonutChart`, `CostTrendChart`, `CategoricalChart`).
- Total JS gzip: `911,3 KB` -> `920,0 KB` (+0,9%).
- Entrada Dashboard: `1424 ms` -> `859 ms`.
- Requests Dashboard: `8` -> `0`.
- Maior chunk permanece `pdf.worker.min-*.mjs` com `1210,0 KB raw / 358,7 KB gzip`.

**Validações:** `npm run test:smoke` pré-implementação ✅ (6 testes); `npx vitest run src/lib/ocr/pdfLoader.test.ts` ✅; `npx vitest run src/components/dashboard/OperationalPanel.test.tsx` ✅ (16 testes); `npm run lint` ✅; `npm run test:unit` ✅ (333 testes); `npm run test:smoke` pós-implementação ✅ (6 testes); `npm run build` ✅; `npm run perf -- --update-baseline` ✅. Validação manual aprovada pelo usuário em 16/06/2026; checklist detalhado com PDFs/imagens reais e DevTools Network não foi executado pelo agente nesta sessão.

**Próxima fase sugerida:** avaliar `manualChunks`, cache/preload do `pdf.worker`, error boundary para falha de chunk de gráfico e teste de render para `CostPanel`.

---

### Code splitting por rota com React.lazy/Suspense

Implementado code splitting por rota no roteador central para eliminar o bundle monolítico inicial de páginas.

**Arquivos criados:**
- `src/components/RouteFallback.tsx`: fallback visual de carregamento de rota, reutilizando o spinner existente.
- `src/components/RouteFallback.test.tsx`: cobertura unitária do estado `role="status"` e da classe `animate-spin`.

**Arquivos modificados:**
- `src/App.tsx`: 21 componentes de página convertidos para `React.lazy`; `Login` preservado como import estático; `<Routes>` envolvido em `Suspense`.
- `src/components/Layout.tsx`: `<Outlet />` autenticado envolvido em `Suspense` para preservar sidebar/topbar durante carregamento de chunks.
- `src/pages/Cadastros.tsx`: `<Outlet />` das abas envolvido em `Suspense` para preservar a barra de abas durante carregamento de sub-rotas.
- `docs/reports/perf/perf-baseline.json`: baseline atualizado após aceite do resultado medido.
- `docs/reports/perf/perf-latest.md`, `docs/reports/perf/perf-latest.json` e `docs/reports/perf/history/perf-2026-06-16-1957.md`: relatório e histórico da medição pós-split.

**Decisões:**
- Escopo restrito a `React.lazy` + `Suspense`; sem `manualChunks` nesta fase.
- `Login` permanece eager para evitar spinner no primeiro acesso anônimo.
- Três fronteiras de `Suspense` foram usadas para preservar shell autenticado e tabs de Cadastros.
- Resultado aceito mesmo com aumento de `totalJsGzip`, porque o objetivo principal era quebrar o chunk monolítico e reduzir o maior chunk inicial.

**Métricas antes/depois:**
- Maior chunk raw: `1918.2 KB` (`index-*.js`) -> `1210.0 KB` (`pdf.worker.min-*.mjs`), redução de `36.9%`.
- Maior chunk gzip: `520.7 KB` -> `358.7 KB`, redução aproximada de `31.1%`.
- Total JS gzip: `867.1 KB` -> `911.3 KB`, aumento de `5.1%`.
- Shell visível: baseline pré-split `1993 ms`; medição pós-split aceita `2009 ms`.
- Primeira tela útil: baseline pré-split `2005 ms`; medição pós-split aceita `2144 ms`.

**Validações:** `npx vitest run src/components/RouteFallback.test.tsx` ✅ (2 testes); `npm run lint` ✅; `npm run test:unit` ✅ (332 testes); `npm run test:smoke` ✅ (6 testes); `npm run perf -- --update-baseline` ✅.

**Próxima fase sugerida:** investigar carregamento sob demanda de `pdf.worker`/`ocrEngine` e avaliar `manualChunks` em `vite.config.ts`.

---

### Protocolo objetivo de medição de performance

Implementado protocolo completo de medição de performance do βetaFleet (baseline + comparação antes/depois), conforme Fase 4 do SPEC.md.

**Arquivos criados:**
- `src/lib/perfReport.ts`: lógica pura de agregação de bundle, diff contra baseline com tolerância de regressão, e formatação Markdown.
- `src/lib/perfReport.test.ts`: testes unitários de `summarizeBundle`, `diffAgainstBaseline` e `formatPerfMarkdown`.
- `scripts/measure-bundle.ts`: lê `dist/assets/`, calcula tamanho raw/gzip, grava `.last-bundle.json`.
- `scripts/perf-report.ts`: orquestra leitura dos JSONs temporários + baseline + thresholds, gera `perf-latest.md`, `perf-latest.json` e histórico.
- `scripts/run-perf.ts`: pipeline completo (build → bundle → playwright → relatório), propagando exit code do gate de regressão.
- `playwright.perf.config.ts`: config Playwright isolada (porta 4173, preview, workers=1).
- `e2e/perf/perf-routes.spec.ts`: spec que mede cold start, entrada nas 6 rotas principais, e comportamento de voltar à página (Veículos).
- `docs/reports/perf/perf-thresholds.json`: limiares editáveis (shell 2500ms, firstUseful 3500ms, routeEntry 1500ms, largestChunk 800KB, tolerância 15%).

**Arquivos modificados:**
- `package.json`: adicionados scripts `perf` e `perf:bundle`.
- `.gitignore`: adicionados `docs/reports/perf/.last-bundle.json` e `docs/reports/perf/.last-routes.json`.

**Decisões:**
- Medir contra `vite preview` (build de produção), não contra `npm run dev`.
- Relatórios versionados em `docs/reports/perf/` (baseline committado), conforme política de artefatos persistentes.
- Limiares por baseline + regra de regressão de 15% como gate principal; metas absolutas ficam informativas.
- Config Playwright separada para isolar risco da suíte E2E existente.
- Scripts em TypeScript via `tsx` para reaproveitar lógica pura de `src/lib`.

**Débito identificado (NÃO tratado nesta sessão):** `dist/assets/index-*.js` tem ~1,96 MB num único chunk (sem code splitting).

**Validações:** `npm run lint` ✅; `npm run test:unit` ✅ (330 testes); `npm run test:smoke` ✅ (6 testes).

---

## Arquivamento — 2026-06-14

## 🆕 Atualização de Sessão (15/06/2026) — Fila operacional acionável na aba Operação

Feature implementada: a aba "Operação" do Dashboard passou a exibir uma Fila de Ação acionável, reaproveitando `ActionQueue` e `buildActionQueue`, com novos itens de CNH/GR a vencer e navegação própria para aprovação de orçamentos.
Mudanças aplicadas:
- `src/lib/dashboardKpi.ts`: `ActionItem.category` ampliado com `cnh_expiring`, `gr_vehicle_expiring` e `gr_driver_expiring`; adicionados `isWithinExpiryWindow`, `getExpiringSoonCnhNames`, `getExpiringSoonGrPlates` e `getExpiringSoonGrDriverNames`; `buildActionQueue` estendido com parâmetros opcionais e três novos itens `medium`, preservando o comportamento da Visão Geral quando omitidos.
- `src/lib/dashboardKpi.test.ts`: adicionados testes dos novos extratores, do comportamento neutro de `buildActionQueue` e da ordem relativa dos novos itens `medium`.
- `src/lib/operationalActionRoutes.ts` e `src/lib/operationalActionRoutes.test.ts`: criado mapa exaustivo categoria → rota para a fila operacional, com `os_pending_approval` direcionando para `/aprovacao-orcamentos`.
- `src/components/dashboard/OperationalPanel.tsx`: aba Operação passou a receber `actionItems` e renderizar `ActionQueue` abaixo de "Resolver agora" e acima de "Panorama operacional", sem alterar cards, filtros ou gráficos.
- `src/components/dashboard/OperationalPanel.test.tsx`: adicionados testes cobrindo render da fila, clique em item da fila e estado vazio, mantendo os testes existentes do painel.
- `src/pages/Dashboard.tsx`: criada a memo `operationalActionItems` com CNH/GR a vencer; adicionada navegação da fila operacional baseada em `OPERATIONAL_ACTION_ROUTES`; a Visão Geral foi mantida intacta, incluindo `os_pending_approval` → `/manutencao`.
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (`314` testes passando); `npm run test:smoke` ✅ (`6` testes passando).

## 🆕 Atualização de Sessão (15/06/2026) — Reordenação dos gráficos da aba Operação por prioridade operacional

Feature implementada: gráficos da aba "Operação" do Dashboard foram reordenados para priorizar leitura de gargalo operacional na primeira dobra.
Mudanças aplicadas:
- `src/components/dashboard/OperationalPanel.tsx`: ordem da grade de gráficos alterada para `Fila de Manutenção por Status` → `Frota por Unidade Operacional` → `Frota por Embarcador` → `Frota por Tipo de Veículo` → `Manutenções por Tipo`, sem alterar cálculos, props, filtros ou condições.
- `src/components/dashboard/OperationalPanel.test.tsx`: mocks dos gráficos enriquecidos com `data-title` e adicionado teste de regressão validando a ordem no DOM.
Validações executadas: `npm run lint` ✅; `npx vitest run src/components/dashboard/OperationalPanel.test.tsx` ✅; `npm run test:smoke` ✅.

## 🆕 Atualização de Sessão (14/06/2026) — Legibilidade dos cards de KPI do Dashboard

Feature implementada: títulos dos cards de KPI passam a renderizar em até 2 linhas no componente compartilhado, com ajuste de microcopy em dois cards da aba Operação.
Mudanças aplicadas:
- `src/components/dashboard/DashboardKpiCard.tsx`: `label` alterado de `truncate` para `line-clamp-2`; `subtitle` mantido com `truncate`.
- `src/components/dashboard/OperationalPanel.tsx`: textos ajustados para `Tempo médio de OS` e `Idade média de OS abertas`.
- `src/components/dashboard/OperationalPanel.test.tsx`: adicionados 3 testes cobrindo os novos títulos e um guardião da classe `line-clamp-2`.
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (299 testes, +3 novos); `npm run test:smoke` ✅ (6 testes).

# MEMORY - Estado Atual do Projeto

Este arquivo registra o progresso atual, pendências e a visão de curto prazo para o desenvolvimento.

## 🆕 Atualização de Sessão (14/06/2026) — Bugfix: subtítulo do card "Documentos a Vencer (30d)" não mencionava CRLV

Bug corrigido: subtítulo do card "Documentos a Vencer (30d)" (Dashboard › Visão Geral) não mencionava CRLV, embora o cálculo o inclua.
Causa raiz: prop subtitle hardcoded em OverviewPanel.tsx defasada em relação ao cálculo de expiringSoonDocsCount (Dashboard.tsx), que soma CNH + GR + CRLV.
Correção aplicada: subtítulo alterado para "CRLV + CNH + GR nos próximos 30 dias".
Arquivos modificados: src/components/dashboard/OverviewPanel.tsx
Testes adicionados: src/components/dashboard/OverviewPanel.test.tsx
Validações executadas: npm run lint ✅; npm run test:unit ✅ (291 testes, +1 novo).

---

## 🆕 Atualização de Sessão (14/06/2026) — Bugfix: card "CRLVs Vencidos" divergia sob filtro de tipo

Bug corrigido: card "CRLVs Vencidos" da aba Operação divergia da Visão Geral sob filtro por tipo de veículo
Causa raiz: OperationalPanel.tsx recalculava o ramo filtrado com regra só-ano (crlv_year < currentYear), ignorando crlv_expiration_date, em vez de usar o helper isCrlvExpired (fonte de verdade já usada pela Visão Geral)
Correção aplicada: ramo filtrado passou a usar isCrlvExpired(v, currentYear, today); today declarado antes do uso; import de isCrlvExpired adicionado
Arquivos modificados: src/components/dashboard/OperationalPanel.tsx
Testes adicionados: src/components/dashboard/OperationalPanel.test.tsx (regra CRLV vencido sob filtro de tipo)
Validações executadas: npm run lint ✅; npm run test:unit ✅ (290 testes, +4 novos).

---

## 🆕 Atualização de Sessão (14/06/2026) — Bugfix: modo "Todos os Clientes" do Admin Master inconsistente

Bug corrigido: modo "Todos os Clientes" do Admin Master inconsistente — telas de Checklists, Plano de Ação, Templates, Motoristas, Pneus e Agendamentos ficavam vazias/bloqueadas, e não havia impedimento para criar/configurar sem cliente.
Causa raiz: ausência de regra consistente para currentClient = null (Admin Master) — leitura cross-tenant não habilitada e escrita não bloqueada por página.
Correção aplicada: regra central em src/lib/clientScope.ts (requiresClientSelection / showsAggregatedData) + componente SelectClientNotice; aplicados em 8 páginas → leitura agrega todos os clientes com coluna "Cliente"; criação/edição bloqueadas em "Todos os Clientes" com aviso. Sem migration (RLS já permite Admin Master ler cross-tenant). Workshop fora de escopo.
Arquivos modificados: src/lib/clientScope.ts (novo), src/lib/clientScope.test.ts (novo), src/components/SelectClientNotice.tsx (novo), src/pages/ActionPlans.tsx, src/pages/Checklists.tsx, src/pages/ChecklistTemplates.tsx, src/pages/Drivers.tsx, src/pages/Tires.tsx, src/pages/Vehicles.tsx, src/pages/Maintenance.tsx, src/pages/WorkshopSchedules.tsx
Testes adicionados: clientScope.test.ts (regras requiresClientSelection / showsAggregatedData).
Validações executadas: npm run lint ✅; npm run test:unit ✅ (286 testes, +8 novos).

---

## 🟢 Estado Atual (Checklist de Progresso)

- [x] **Núcleo de Cadastros**: Veículos, Motoristas, Embarcadores e Unidades Operacionais estabilizados.
- [x] **Gestão de Manutenção**: Workflow de OS, cancelamento e orçamentos (OCR) funcional.
- [x] **Checklists**: Infraestrutura offline-first e versionamento de templates concluídos.
- [x] **Pneus**: Módulo completo com configuração de eixos e histórico de movimentação.
- [x] **Oficinas**: Novo modelo de parcerias multi-tenant e gestão de convites ativa.
- [x] **Performance**: Build otimizado (~8s) e cache de queries (React Query) configurado.
- [x] **Dashboard Executivo**: Fase 3 concluída com tendência histórica de custo (gráfico de linha) e projeção do próximo mês por média móvel de 3 meses.

## ✅ Protocolo Oficial de Smoke

- Comando oficial: `npm run test:smoke`
- Objetivo: validar o contrato minimo de aplicacao viva, autenticacao, protecao de rotas e navegacao critica de Cadastros antes de planejamento ou bugfix.
- Pre-condicoes locais: `.env.local` valido, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, credenciais admin de teste e dados demo minimos para `coordinator@demo.betafleet.local`.
- Cobertura do smoke: tela de login, redirect de rota protegida para anonimo, shell autenticado, navegacao de abas de Cadastros e regressao de Coordinator apos idle.
- Fora do escopo: CRUD completo, specs `e2e/pending/**`, importacoes, OCR, fluxos destrutivos e regressao E2E completa.
- Conduta em falha: parar, registrar o teste falho com a evidencia e corrigir o problema antes de continuar.
- Observacao: `npm run test:e2e` continua sendo a regressao completa. Ele nao substitui o smoke oficial.

---

## 🆕 Atualização de Sessão (14/06/2026) — Bugfix Dashboard do Admin Master em "Todos os Clientes"
Bug corrigido: Dashboard do Admin Master mostrava métricas incorretas (conformidade 100%, documentos vencidos sem CNH, sem checklist vencido) e erro 400 em /checklists ao selecionar "Todos os Clientes".
Causa raiz: queries de checklists, drivers e checklist_day_intervals em Dashboard.tsx ficavam desabilitadas e filtravam por client_id undefined quando currentClient era null (modo global do Admin Master); o cálculo de checklist vencido usava um único intervalo para todos os clientes.
Correção aplicada: queries passam a habilitar por !!user e filtrar por client_id apenas quando há cliente selecionado; intervalos passam a ser buscados por cliente e o vencimento de checklist é calculado por cliente (computeOverdueChecklistVehicleIds). Sem migration — RLS já permite Admin Master ler cross-tenant.
Arquivos modificados: src/pages/Dashboard.tsx, src/components/dashboard/OperationalPanel.tsx, src/lib/dashboardKpi.ts, src/lib/dashboardKpi.test.ts
Testes adicionados: dashboardKpi.test.ts — computeOverdueChecklistVehicleIds (paridade single-tenant + cross-tenant com intervalos distintos).

---

## 🆕 Atualização de Sessão (14/06/2026) — CRLV a vencer: campo + alerta preventivo no Dashboard
Feature implementada: campo `crlv_expiration_date` (data real de vencimento do CRLV) no cadastro de veículos, com alerta preventivo "CRLV a vencer (30d)" no Dashboard.
Mudanças aplicadas:
- Migration aditiva: `supabase/migrations/20260614000000_add_crlv_expiration_date_to_vehicles.sql` (nullable, sem backfill).
- Tipo `Vehicle`: adicionado `crlvExpirationDate?: string`.
- Mapper `vehicleMappers.ts`: adicionado `crlv_expiration_date` em `VehicleRow`, `vehicleFromRow` e `vehicleToRow`.
- Formulário `VehicleForm.tsx`: input `type="date"` para "Vencimento do CRLV" após "Exercício CRLV" (opcional fixo, sem `req()`).
- Funções puras em `dashboardKpi.ts`: `isCrlvExpired` (precedência data→ano), `getExpiringSoonCrlvPlates`; `getExpiredCrlvPlates` alterada para usar o predicado; `buildActionQueue` estendida com categoria `crlv_expiring` (severity `medium`).
- Dashboard.tsx: query inclui `crlv_expiration_date`; `expiredCrlvCount` usa `isCrlvExpired`; `expiringSoonDocsCount` soma CRLV; `actionItems` inclui `crlvExpiring`; rota `crlv_expiring` → `/cadastros/veiculos`.
- OperationalPanel.tsx: `VehicleRow` recebeu `crlv_expiration_date`.
Arquivos modificados: `supabase/migrations/20260614000000_add_crlv_expiration_date_to_vehicles.sql`, `src/types/vehicle.ts`, `src/lib/vehicleMappers.ts`, `src/lib/vehicleMappers.test.ts`, `src/components/VehicleForm.tsx`, `src/lib/dashboardKpi.ts`, `src/lib/dashboardKpi.test.ts`, `src/pages/Dashboard.tsx`, `src/components/dashboard/OperationalPanel.tsx`
Testes: `npm run lint` ✅; `npm run test:unit` ✅ (273 testes, +15 novos); `npm run test:smoke` ✅ (6 testes).
Decisões: campo opcional fixo (não entra em `vehicle_field_settings`); sem backfill (veículos existentes ficam NULL); precedência data→ano (quando a data existe, ela é a única fonte do status CRLV); nova categoria `crlv_expiring` na Fila de Ação com severity medium.
Rollback: `ALTER TABLE vehicles DROP COLUMN IF EXISTS crlv_expiration_date;`

---

## 🆕 Atualização de Sessão (13/06/2026) — Dashboard Executivo Fase 2
Feature implementada: evolução do Dashboard — Fase 2 (tendência operacional, comparativo de custos e refinamento da Fila de Ação).
Mudanças aplicadas:
- Aba "Operação": adicionados KPIs de tempo médio em manutenção, permanência média de OS abertas e gráfico "Fila de Manutenção por Status".
- Aba "Custos": adicionados custo do período anterior e variação percentual no KPI "Custo Total".
- Aba "Visão Geral": adicionado KPI "Documentos a Vencer (30d)" cobrindo CNH e GR, sem CRLV por ausência de data de vencimento no banco.
- Fila de Ação: passou a listar placas de veículos e nomes de motoristas por categoria, com limite visual de 5 detalhes e indicador "+N mais".
Arquivos modificados:
- src/pages/Dashboard.tsx
- src/types/maintenance.ts
- src/lib/dashboardKpi.ts
- src/lib/dashboardKpi.test.ts
- src/components/dashboard/OperationalPanel.tsx
- src/components/dashboard/CostPanel.tsx
- src/components/dashboard/OverviewPanel.tsx
- src/components/dashboard/ActionQueue.tsx
Testes: `npm run lint` ✅; `npm run test:unit` ✅ (241 testes); `npm run test:smoke` ✅ (6 testes); checagem DOM autenticada das abas Visão Geral, Operação e Custos ✅.
Segurança/LGPD: RISCO ACEITO — exibição de placa/nome na Fila de Ação aprovada pelo usuário em 13/06/2026, restrita ao tenant via RLS.
Sem migration e sem dependência nova.

---

## 🆕 Atualização de Sessão (13/06/2026) — Dashboard Executivo Fase 3
Feature implementada: evolução do Dashboard — Fase 3 (tendência histórica de custo + projeção financeira por média móvel).
Mudanças aplicadas:
- Aba "Custos": adicionado gráfico "Evolução do Custo de Manutenção" (LineChart Recharts) com granularidade automática (dia ≤ 62 dias de span; mês acima), reagindo ao filtro de período e ao filtro de tipo de veículo/manutenção.
- Aba "Custos": adicionado KPI "Projeção Próximo Mês" com valor calculado por média móvel dos 3 meses fechados anteriores (`calculateMovingAverageProjection`).
- Nova query `dashboard-cost-projection` buscando custo aprovado dos 3 meses anteriores ao mês corrente, sem filtro de período.
- Funções puras novas em `src/lib/dashboardKpi.ts`: `chooseTrendGranularity`, `buildCostTrendSeries` (+ helper `enumerateBucketKeys`), `getTrailingMonthKeys`, `sumApprovedCostByMonthKeys`, `calculateMovingAverageProjection`.
Arquivos criados: src/components/dashboard/CostTrendChart.tsx (presentational component, Recharts LineChart, empty state).
Arquivos modificados: src/pages/Dashboard.tsx, src/components/dashboard/CostPanel.tsx, src/lib/dashboardKpi.ts, src/lib/dashboardKpi.test.ts.
Testes: `npm run lint` ✅; `npm run test:unit` ✅ (258 testes, +17 da Fase 3); `npm run test:smoke` ✅ (6 testes).
Sem migration, sem alteração de RLS, sem dependência nova. Escopo reduzido conforme decisão de 13/06/2026 (itens cross-tenant e `crlv_expiration_date` ficam para planos próprios).
Decisões de design: granularidade determinística ≤62 dias → dia, >62 → mês; série de tendência usa `filteredOrders` (respeita filtros do painel); projeção usa query própria sem filtro de período; média móvel simples de 3 meses (explicável a gestores).
Observação: projeção sem histórico exibe "—"; buckets sem custo aparecem zerados (linha contínua).

---

## 🆕 Atualização de Sessão (12/06/2026) — Bugfix Inspeção de Pneus: comparação e câmera
Bug corrigido: Inspeção de Pneus — comparação em ordem errada + câmera no celular (rodada 2)
Causa raiz:
- Comparação ranqueava por started_at; inspeção retomada (concluída depois) ficava "antiga" e mostrava só 1 foto
- Câmera ao vivo (getUserMedia) exige contexto seguro; celular via http://IP não tem → fallback acionado com UX confusa
Correção aplicada:
- fetchTireInspectionComparison passa a ranquear/ordenar por completed_at ?? started_at (âncora na aberta)
- CameraCapture: detecta contexto inseguro proativamente + texto/rótulo claros ("Tirar foto" via câmera nativa)
Arquivos modificados:
- src/services/tireInspectionService.ts
- src/components/CameraCapture.tsx
- src/services/tireInspectionService.comparison.test.ts (caso de regressão)
Notas: câmera ao vivo no celular requer HTTPS (Vercel/túnel) — não é defeito de código.

---

## 🆕 Atualização de Sessão (12/06/2026) — Bugfix Inspeção de Pneus: datas reais
Bug corrigido: Inspeção de Pneus — datas exibidas não refletiam o dia real (rodada 3)
Causa raiz:
- Cards mostravam started_at em vez do photoTimestamp da foto
- started_at ficava na data de criação do rascunho (retomado por findOpenTireInspection), não no dia do preenchimento
Correção aplicada:
- Card passa a exibir photo.photoTimestamp
- confirmKmMutation grava started_at = momento da confirmação do KM (online + offline via SyncOperation)
Arquivos modificados:
- src/components/TireInspectionDetailModal.tsx
- src/pages/TireInspectionFill.tsx
- src/lib/offline/offlineDb.ts
- src/lib/offline/syncService.ts
Notas: registros já concluídos mantêm o started_at antigo (sem correção retroativa).

---

## 🟡 Tarefas em Andamento

1.  **Estabilização de Testes E2E (Inspeção de Pneus)**:
    - Fluxo Assistant+ de listagem/viewer validado em 12/06/2026 com a nova aba "Inspeções de Pneus" e comparação visual das 3 últimas inspeções por posição.
    - Ajustar falhas remanescentes de timing nos testes de movimentação de pneus.
    - Corrigir o seeding de dados para o motorista (Jorge) e Auditor (Carlos).
2.  **Migração para React Query**:
    - Finalizar a substituição de estados locais por queries em páginas menores (ex: Shippers).
3.  **Acessibilidade**:
    - Revisar `aria-labels` em modais e tabelas para conformidade WCAG.

## 🔴 Próximos Passos Definidos

1.  **Dashboard Executivo**:
    - Criar visão consolidada para o `Admin Master` com métricas cross-tenant (item A — sessão separada).
2.  **Integração de Notificações**:
    - Sistema de alertas para vencimento de CRLV e CNH via Edge Functions (Cron).
3.  **OCR da data do CRLV**:
    - `documentOcr.ts` já extrai o ano; extrair também a data de vencimento é evolução natural (registrado como evolução futura).
4.  **Backfill futuro**:
    - Importar datas reais de CRLV (planilha) para veículos legados, se o usuário desejar.

## 📌 Contexto de Sessão (Última Auditoria)
A última grande auditoria (11/04/2026) resultou na remoção de 15% de código morto e na unificação de 4 mappers redundantes. O sistema encontra-se saudável e com build estável.

## 🆕 Atualização de Sessão (11/05/2026)
- Implementado o campo opcional `phone` no cadastro de motoristas, com persistência completa banco ↔ frontend.
- Migration criada: `supabase/migrations/add_phone_to_drivers.sql` (execução manual no Supabase Dashboard pendente).
- `DriverForm` atualizado com campo "Telefone de Contato" após CPF, com filtro `filterPhone` (somente dígitos).
- `DriverDetailModal` atualizado para exibir telefone formatado em padrão brasileiro.
- `driverMappers.ts` e `driverMappers.test.ts` atualizados para incluir o campo `phone`.
- Validações locais concluídas: `npm run lint` sem erros e `npm run test:unit` com **111 testes passando**.

## 🆕 Atualização de Sessão (16/05/2026)
Bug corrigido: 32 usuários importados via bulk não apareciam na tela /admin/users
Causa raiz: scripts/bulk-import-drivers.ts não inseria registros em public.profiles (apenas em auth.users e drivers)
Correção aplicada: INSERT direto via SQL Editor no Supabase para os 32 perfis ausentes
Arquivos modificados: nenhum arquivo de código — correção via SQL no banco de dados
Testes adicionados: nenhum automatizado — validação manual documentada

## 🆕 Atualização de Sessão (18/05/2026)
Bug corrigido: Driver não via checklists publicados após associação de veículo
Causa raiz: `drivers.profile_id` NULL para motoristas criados via bulk import; a query em `Checklists.tsx` depende de `profile_id = auth.uid()`
Correção aplicada: UPDATE pontual no Supabase para ALESSANDRO (`drivers.id=f1cfbf99-5d79-4051-914f-c3f26ac3afac`) com `profile_id=e29cbf40-3084-4623-99cc-1e99d9fa9e40`; policy `drivers_select_own` confirmada ativa
Desdobramento aprovado: após validação do caso ALESSANDRO, aplicado UPDATE individual para os outros 32 drivers da Deluna com pareamento unívoco `drivers.name` ↔ `profiles.name` (`role='Driver'`, mesmo `client_id`); resultado final: `0` drivers com `profile_id` nulo no tenant
Prevenção aplicada: `scripts/bulk-import-drivers.ts` agora faz `upsert` em `public.profiles` e insere `drivers.profile_id` com o `auth.users.id` criado
Arquivos modificados: `scripts/bulk-import-drivers.ts`, `e2e/completed/driver-checklist-visibility.spec.ts`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/driver-checklist-visibility.spec.ts` cobrindo caso positivo (vínculo correto) e regressão negativa (sem `profile_id`)

## 🆕 Atualização de Sessão (25/05/2026)
- Criado `scripts/seed-betafleet-demo.mjs` para seed manual e idempotente do tenant `BetaFleet`, usando `SUPABASE_SERVICE_ROLE_KEY` e `dotenv` (`.env.local`).
- Implementadas as funções obrigatórias do plano, incluindo introspecção de colunas por tabela para tolerância a diferenças de migrations entre ambientes.
- Criado helper `scripts/seed-betafleet-demo.helpers.mjs` com dataset, gerador determinístico de credenciais e sanitização de relatório.
- Criados documentos `docs/demo/BETAFLEET_DEMO_DATA.md` e `docs/demo/BETAFLEET_DEMO_CREDENTIALS.example.md`.
- Adicionado `.demo-credentials/` ao `.gitignore` e script `seed:demo:betafleet` ao `package.json`.
- Criado teste unitário `tests/unit/seed-betafleet-demo.test.ts` para regras de dataset/credenciais/sanitização.
- Local privado de credenciais definido em `.demo-credentials/betafleet-demo-credentials.json`; relatório versionável sem senha definido em `import-report-betafleet-demo-YYYY-MM-DD.json`.
- Pendência: validação E2E visual continua dependente da normalização do ambiente/porta 3000 e execução manual pós-seed no Supabase.

## 🆕 Atualização de Sessão (01/06/2026)
Bug corrigido: Admin Master nao via ordens de manutencao ao selecionar "Todos os Clientes".
Causa raiz: `useQuery` em `src/pages/Maintenance.tsx` ficava desabilitado para usuarios nao-oficina quando `currentClient` era `null`; para Admin Master, `currentClient = null` representa a visao global.
Correcao aplicada: query de manutencao passa a ser habilitada quando o perfil e `Admin Master`, mesmo sem cliente selecionado, preservando o filtro por `client_id` quando um cliente especifico existe.
Arquivos modificados: `src/pages/Maintenance.tsx`, `src/pages/Maintenance.query-scope.test.ts`, `docs/MEMORY.md`
Testes adicionados: `src/pages/Maintenance.query-scope.test.ts`

## 🆕 Atualização de Sessão (01/06/2026) — Gestor de Operações
- Feature implementada: novo role persistido como `Operations Manager` e exibido como `Gestor de Operações`.
- Migration criada: `supabase/migrations/20260601000000_add_operations_manager_role_and_scope.sql`.
- Banco/RLS:
  - criadas as tabelas `profile_shipper_scopes` e `profile_operational_unit_scopes`;
  - adicionadas validações por trigger para garantir consistência entre perfil, embarcadores e bases;
  - habilitada leitura restrita por escopo em `shippers`, `operational_units`, `vehicles`, `workshop_schedules`, `maintenance_orders`, `maintenance_budget_items` e leitura de `workshops` somente quando referenciadas por registros visíveis.
- Frontend:
  - `Users.tsx` agora permite criar/editar `Gestor de Operações` para `Coordinator+`, com embarcadores e bases obrigatórios;
  - `AdminUsers.tsx` renderiza corretamente o role, mas continua sem expor criação/edição desse perfil;
  - `App.tsx`, `Layout.tsx`, `Sidebar.tsx`, `Topbar.tsx` e `AuthContext.tsx` passaram a tratar redirect, bloqueio de rota e navegação restrita para `/agendamentos` e `/manutencao`;
  - `WorkshopSchedules.tsx` e `Maintenance.tsx` foram ajustadas para leitura apenas, sem ações mutáveis para o novo role.
- Backend:
  - `supabase/functions/create-user/index.ts` agora valida `shipper_ids` e `operational_unit_ids`, força payload read-only e sincroniza escopo em modo replace-all;
  - `supabase/functions/delete-user/index.ts` bloqueia exclusão por `Operations Manager`.
- Helpers e testes adicionados:
  - `src/lib/operationsManagerScope.ts`
  - `src/lib/operationsManagerScope.test.ts`
  - `src/pages/Users.operations-manager.test.ts`
  - `src/pages/Maintenance.query-scope.test.ts`
  - `e2e/pending/operations-manager-readonly-scope.spec.ts`
- Correcao posterior:
  - criada `supabase/migrations/20260602000000_fix_operations_manager_schedule_rls.sql` para remover `Operations Manager` dos blocos tenant-wide por rank e evitar subquery RLS em `vehicles` dentro da policy de `workshop_schedules`;
  - criada `supabase/migrations/20260602000100_fix_workshop_schedules_driver_rls_recursion.sql` para remover também a subquery direta de `vehicles` no ramo `Driver` da mesma policy;
  - criada `supabase/migrations/20260602000200_fix_admin_master_rls_regression.sql` para corrigir regressao de RLS no Admin Master em Dashboard, Veiculos e Oficinas, movendo checks cruzados de Workshop/Gestor para funcoes `SECURITY DEFINER` e recompondo `vehicles_select`, `workshops_select` e `maintenance_select`;
  - a tela `Agendamentos` foi ajustada para buscar `workshop_schedules` sem joins aninhados e hidratar `vehicles`, `workshops` e `profiles` separadamente.
- Validações executadas nesta entrega:
  - `npm run lint` ✅
  - `npm run test:unit` ✅ (`128` testes passando)
- Limitações remanescentes:
  - a suíte E2E completa já falhava antes desta mudança no setup de `Jorge` (`e2e/setup/jorge.setup.ts`, permanência em `/login` em vez de redirect esperado);
  - por isso, o aceite automatizado final desta feature permanece dependente de validação manual guiada ou execução E2E em ambiente funcional do usuário;
  - smoke visual completo via sandbox continua não validado por indisponibilidade de acesso útil a `localhost:3000`.

## 🆕 Atualização de Sessão (03/06/2026)
Bug corrigido: tela em branco ao editar veiculo em /cadastros/veiculos.
Causa raiz: `vehicleFromRow` propagava `vehicles.axle_config` nao-array para `Vehicle.axleConfig`; `VehicleForm` passava esse valor para `AxleConfigEditor`, que chamava `entries.reduce` e quebrava a renderizacao.
Correcao aplicada: normalizacao defensiva de `axle_config` no mapper de veiculos, preservando arrays validos e descartando formatos invalidos como `undefined`.
Arquivos modificados: `src/lib/vehicleMappers.ts`, `src/lib/vehicleMappers.test.ts`, `docs/MEMORY.md`
Testes adicionados: casos unitarios em `src/lib/vehicleMappers.test.ts` para `axle_config` valido e invalido.

## 🆕 Atualização de Sessão (03/06/2026) — Auth/RLS E2E pós Gestor de Operações
Bug corrigido: regressão de autenticação/RLS após Gestor de Operações afetando a confiabilidade da suíte Playwright E2E.
Causa raiz: mistura de `.auth` antigos, specs desatualizados frente às regras atuais de roles, seed E2E incompatível com o schema atual de `vehicles` e fluxos completed dependentes de dados obrigatórios reais do formulário.
Correção aplicada: adicionada validação `e2e/completed/auth-storage-state.spec.ts`; seed de `driver-checklist-visibility` atualizado para respeitar constraints atuais e reutilizar template publicado compatível; `driver-user-integration` atualizado para refletir as regras atuais de roles e preencher o formulário completo exigido pelo tenant; `shippers-operational-units` alinhado ao contexto autenticado real de Manager; `Drivers.tsx` e `Shippers.tsx` agora falham explicitamente sem cliente ativo e aguardam a invalidação das queries antes de fechar o modal.
Arquivos modificados: `e2e/completed/auth-storage-state.spec.ts`, `e2e/completed/driver-checklist-visibility.spec.ts`, `e2e/completed/driver-user-integration.spec.ts`, `e2e/completed/shippers-operational-units.spec.ts`, `src/pages/Drivers.tsx`, `src/pages/Shippers.tsx`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/auth-storage-state.spec.ts`

## 🆕 Atualização de Sessão (03/06/2026) — Cadastros/Usuários
Bug corrigido: abas de Cadastros travavam após alguns segundos para usuário `Coordinator`, mantendo a tela de `Usuários` renderizada mesmo com a URL mudando para outra aba.
Causa raiz: `CreateUserModal` em `src/pages/Users.tsx` iniciava com role padrão `Operations Manager` para perfis `Coordinator`; como `useOperationsManagerOptions` devolvia arrays vazios novos a cada render, um `useEffect` dependente de `operationalUnits` disparava `setForm` em loop e gerava `Maximum update depth exceeded`, bloqueando a atualização do conteúdo da rota.
Correção aplicada: `useOperationsManagerOptions` passou a reutilizar arrays vazios estáveis e `availableRoles` em `Users.tsx` passou a ser memoizado, eliminando o loop de render na tela de `Usuários`; adicionado teste E2E cobrindo navegação entre abas para `Manager` e regressão específica do `Coordinator`.
Arquivos modificados: `src/pages/Users.tsx`, `e2e/completed/cadastros-tab-navigation.spec.ts`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/cadastros-tab-navigation.spec.ts`

## 🆕 Atualização de Sessão (03/06/2026) — Protocolo de Smoke
Melhoria aplicada: protocolo oficial de smoke definido e automatizado.
Causa raiz: `prompts/Evolucao.md` e `prompts/Fixbugs.md` exigiam "testes de fumaca do docs/MEMORY.md", mas o projeto nao tinha um comando unico nem uma spec dedicada, abrindo margem para execucao inconsistente.
Correcao aplicada: criado `npm run test:smoke` com spec dedicada em `e2e/smoke/app-smoke.spec.ts`; `agent/AGENT.md`, `docs/MEMORY.md`, `prompts/Evolucao.md` e `prompts/Fixbugs.md` passaram a apontar para o comando oficial e a bloquear improvisacao manual do smoke.
Arquivos modificados: `e2e/smoke/app-smoke.spec.ts`, `package.json`, `agent/AGENT.md`, `docs/MEMORY.md`, `prompts/Evolucao.md`, `prompts/Fixbugs.md`
Testes adicionados: `e2e/smoke/app-smoke.spec.ts`
Validacoes executadas: `npm run lint` ✅; `npm run test:unit` ✅ (`130` testes passando); `npx playwright test e2e/smoke/app-smoke.spec.ts --project=chromium` ✅ (`6` testes passando); `npm run build` ✅
Observacao operacional: no sandbox local, o `webServer` do Playwright nao conseguiu conectar em `localhost:3000` apesar da porta escutar; a validacao do smoke foi concluida fora do sandbox para confirmar o protocolo real.

## 🆕 Atualização de Sessão (03/06/2026) — Configurações de Veículos
Bug corrigido: configuracoes de campos obrigatorios de veiculos exibiam sucesso mas nao persistiam para usuarios Coordinator.
Causa raiz: RLS de escrita em `vehicle_field_settings` exigia Manager+, enquanto a UI permitia Coordinator; o UPDATE retornava zero linhas sem erro e `Settings.tsx` exibia sucesso falso.
Correcao aplicada: policy de escrita de `vehicle_field_settings` alinhada para Coordinator/Manager/Director/Admin Master; `Settings.tsx` passou a validar linha persistida e invalidar cache usado pelo formulario de veiculos.
Arquivos modificados: `src/pages/Settings.tsx`, `supabase/migrations/20260603000000_fix_coordinator_vehicle_field_settings_rls.sql`, `e2e/completed/settings-vehicle-field-persistence.spec.ts`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/settings-vehicle-field-persistence.spec.ts`

## 🆕 Atualização de Sessão (03/06/2026) — Baseline E2E
Bug corrigido: suite E2E misturava falhas reais, specs pending e instabilidade operacional, impedindo baseline confiavel.
Causa raiz: execucao padrao incluia `e2e/pending/**`, havia spec completed com credenciais antigas e havia diferenca de conectividade entre sandbox do agente e host local para `localhost:3000`.
Correcao aplicada: baseline E2E separado de pending, script explicito para pending/auth, spec completed de roles atualizada para credenciais oficiais e relatorio de triagem criado.
Arquivos modificados: `playwright.config.ts`, `package.json`, `e2e/completed/new-roles-audit.spec.ts`, `.claude/reports/e2e-baseline-triage-2026-06-03.md`, `docs/MEMORY.md`
Testes adicionados: nenhum teste funcional novo; adicionados gates operacionais via scripts E2E.

## 🆕 Atualização de Sessão (04/06/2026) — Pneus Manager E2E
Bug corrigido: `e2e/completed/tenant-users-manager-tires.spec.ts` falhava no teste 06 ao tentar selecionar uma posicao desabilitada no cadastro individual de pneu.
Causa raiz: spec desatualizada; o teste tratava `disabled=""` como opcao habilitada ao usar `if (!isDisabled)`, embora o produto exibisse corretamente posicoes ocupadas como desabilitadas e posicoes livres como selecionaveis.
Correcao aplicada: selecao de posicao passou a exigir ausencia do atributo `disabled`; o teste falha explicitamente se nao houver posicao livre. Tambem foi ajustado seletor ambíguo do teste 10 no mesmo spec (`De`/`Para`) para headers exatos.
Arquivos modificados: `e2e/completed/tenant-users-manager-tires.spec.ts`, `IMPLEMENTATION_FIXBUG.md`, `.claude/reports/tire-manager-test-06-triage-2026-06-04.md`, `docs/MEMORY.md`
Testes: `npm run test:smoke` ✅; `npm run test:e2e:auth` ✅ apos regenerar `setup-carlos` e `setup-jorge`; `npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager --grep "06"` ✅; `npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager` ✅ (`15` passaram).

## 🆕 Atualização de Sessão (04/06/2026) — Configurações de Motoristas
Bug corrigido: Coordinator recebia "Erro ao salvar configurações." (HTTP 403) ao tentar persistir os campos obrigatórios do motorista em /settings.
Causa raiz: RLS de escrita em driver_field_settings exigia Manager+, enquanto a UI permitia Coordinator; espelho do bug de vehicle_field_settings corrigido em 03/06/2026 que não havia sido aplicado a motoristas.
Correção aplicada: policies dfs_insert/dfs_update recriadas para aceitar Coordinator/Manager/Director/Admin Master; saveDriverMutation em Settings.tsx ganhou validação de linha persistida espelhando o guardrail de saveVehicleMutation; criado spec E2E de persistência.
Arquivos modificados: src/pages/Settings.tsx, supabase/migrations/20260604000000_fix_coordinator_driver_field_settings_rls.sql, e2e/completed/settings-driver-field-persistence.spec.ts, docs/MEMORY.md
Testes adicionados: e2e/completed/settings-driver-field-persistence.spec.ts

## 🆕 Atualização de Sessão (04/06/2026) — Alçada de Aprovação
Bug corrigido: Fleet Assistant conseguia aprovar orçamentos acima de sua alçada quando os itens do orçamento não estavam carregados ou inexistiam em maintenance_budget_items (orçamento só com PDF).
Causa raiz: canApprove em src/pages/BudgetApprovals.tsx avaliava budgetTotal=0 como "dentro do limite"; reviewMutation atualizava maintenance_orders sem revalidar alçada; não havia defesa em profundidade no servidor.
Correção aplicada: canApprove passou a exigir itens carregados, presentes e subtotal > 0 para roles não-always-approve; reviewMutation revalida itens reais e total contra budgetApprovalLimit antes do UPDATE; tooltip do botão explicita o motivo do bloqueio.
Arquivos modificados: src/pages/BudgetApprovals.tsx, src/pages/BudgetApprovals.canApprove.test.ts (novo), e2e/pending/budget-approval-alcada.spec.ts (novo), docs/MEMORY.md
Testes adicionados: src/pages/BudgetApprovals.canApprove.test.ts; e2e/pending/budget-approval-alcada.spec.ts
Observação aberta: defesa em profundidade no Supabase (RPC + RLS de UPDATE em maintenance_orders.budget_status) registrada como próxima evolução.

## 🆕 Atualização de Sessão (04/06/2026) — Cleanup RLS Duplicadas
- Migration criada: `supabase/migrations/20260604010000_cleanup_duplicate_rls_policies.sql`
- Policies removidas (DROP IF EXISTS):
  - `vehicle_field_settings`: `field_settings_select`, `field_settings_insert`, `field_settings_update`
  - `vehicles`: `vehicles_select_admin`, `vehicles_select_tenant`
  - `checklist_templates`: `templates_select`, `templates_insert`, `templates_update`, `templates_delete`
- Policies preservadas: `vfs_*`, `vehicles_select`, `vehicles_select_auditor`, `vehicles_select_own_driver`, `workshop_vehicle_select`, `checklist_templates_*`, `templates_select_driver`
- Prechecks na migration: aborta se as famílias atuais esperadas não existirem
- Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (140 testes); `npm run test:smoke` ✅ (6 testes); E2Es relevantes ✅ (settings-vehicle-field-persistence 2/2, driver-checklist-visibility 3/3, new-roles-audit 37/37)
- Execução da migration no Supabase Dashboard: concluída com sucesso (Success, no rows returned)
- Snapshot antes validado: todas as policies atuais presentes, todas as legadas presentes
- Snapshot depois validado: 9 policies legadas removidas, nenhuma policy atual perdida
- Validações pós-migração: `npm run lint` ✅; `npm run test:unit` ✅ (140 testes); `npm run test:smoke` ✅ (6 testes); E2Es relevantes ✅ (settings-vehicle-field-persistence 2/2, driver-checklist-visibility 3/3, new-roles-audit 37/37)

## 🆕 Atualização de Sessão (04/06/2026) — New Roles Audit E2E
Bug corrigido: `e2e/completed/new-roles-audit.spec.ts` ainda esperava nomes antigos (`Robson`/`Pereira`) para as credenciais oficiais de Coordinator e Supervisor.
Causa raiz: spec desatualizada frente aos usuarios oficiais atuais (`Beatriz Lima` e `Camila Torres`) e seletor de badge de role amplo demais, casando topbar e sidebar. A spec tambem esperava indevidamente que Supervisor nao pudesse criar `Fleet Analyst`, embora a regra atual permita criar roles com rank inferior.
Correcao aplicada: nomes atualizados para `Beatriz Lima` e `Camila Torres`; badge de role validado dentro do `banner`; expectativa de hierarquia do Supervisor alinhada a `ROLE_RANK[candidate] < myRank`.
Arquivos modificados: `e2e/completed/new-roles-audit.spec.ts`, `docs/MEMORY.md`
Testes: `npx playwright test e2e/completed/new-roles-audit.spec.ts --project=chromium` ✅ (`37` passaram); `npm run test:e2e` ✅ (`130` passaram, `9` skipped).

## 🆕 Atualização de Sessão (04/06/2026) — KPI "Em Manutenção" do Dashboard
Bug corrigido: KPI "Em Manutenção" do Dashboard exibia 0 quando OS ativas estavam fora do período filtrado
Causa raiz: query `dashboard-maintenance` filtrava ordens por `entry_date` dentro do range do filtro de período, e o mesmo array alimentava o KPI de estado atual
Correção aplicada: nova query `dashboard-active-maintenance` (sem filtro de período, filtra apenas por status != Concluído/Cancelado) alimentando exclusivamente o KPI "Em Manutenção"
Arquivos modificados: src/pages/Dashboard.tsx, src/components/dashboard/OperationalPanel.tsx

## 🆕 Atualização de Sessão (12/06/2026) — Aba Inspeções de Pneus em Checklists
- Implementada a aba interna "Inspeções de Pneus" na visão Assistant+ de `/checklists`, mantendo "Checklists" separada e sem linhas de inspeção de pneus misturadas.
- `TireInspectionDetailModal` agora exibe comparação por posição de pneu com até 3 fotos (inspeção atual + 2 anteriores), data/status e badge "Atual".
- Service layer recebeu `fetchTireInspectionComparison`, usando RLS existente e ordenação por `started_at` sem nova migration.
- Teste E2E `tire-inspection-assistant.spec.ts` atualizado para abrir a aba dedicada e validar o viewer comparativo.
- Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (`191` testes); `npx playwright test e2e/completed/tire-inspection-assistant.spec.ts --project=chromium` ✅ (`14` testes); `npm run test:smoke` ✅ (`6` testes).
Arquivos criados: src/lib/dashboardKpi.ts (função pura countActiveInMaintenance), src/lib/dashboardKpi.test.ts (5 cenários)
Testes adicionados: src/lib/dashboardKpi.test.ts
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (145 testes passando); `npm run test:smoke` ✅ (6 testes passando)

## 🆕 Atualização de Sessão (04/06/2026) — Dashboard Manutenções por Tipo
Bug corrigido: gráfico "Manutenções por Tipo" do Painel Operacional ficava vazio mesmo com veículos em manutenção.
Causa raiz: `OperationalPanel.tsx` montava o donut com `maintenanceOrders`, coleção filtrada por `entry_date` do período do Dashboard, enquanto o KPI "Em Manutenção" já usava `activeMaintenanceOrders` sem filtro de período.
Correção aplicada: agregação do donut operacional passa a usar ordens ativas por tipo, com teste unitário protegendo status ativo/inativo e filtro por tipo de veículo.
Arquivos modificados: `src/lib/dashboardKpi.ts`, `src/lib/dashboardKpi.test.ts`, `src/components/dashboard/OperationalPanel.tsx`, `docs/MEMORY.md`
Testes adicionados: casos unitários em `src/lib/dashboardKpi.test.ts` para `buildActiveMaintenanceTypeData`.

## 🆕 Atualização de Sessão (05/06/2026) — Convite de Oficinas
Bug corrigido: botão de copiar link no modal "Convidar Oficina Parceira" não funcionava em HTTP por IP local.
Causa raiz: `InviteWorkshopModal` dependia exclusivamente de `navigator.clipboard.writeText`, que pode ser bloqueado fora de secure context ou por permissão do navegador.
Correção aplicada: adicionado fallback local com `textarea` temporário e `document.execCommand('copy')`, preservando o uso da Clipboard API quando disponível.
Arquivos modificados: `src/components/InviteWorkshopModal.tsx`, `docs/MEMORY.md`
Testes adicionados: nenhum — testes pulados por solicitação do usuário.

## 🆕 Atualização de Sessão (05/06/2026) — Link Público de Convite de Oficinas
Bug corrigido: link de convite copiado em ambiente local usava `http://192.168...:3000`, e o WhatsApp não tratava esse endereço como link compartilhável/clicável.
Causa raiz: `InviteWorkshopModal` montava o convite com `window.location.origin`, herdando a origem local/IP usada pelo operador.
Correção aplicada: link de convite passa a usar `VITE_FRONTEND_URL` quando configurado e, em origens locais/IP privadas, cai para `https://app.betafleet.com.br`.
Arquivos modificados: `src/components/InviteWorkshopModal.tsx`, `.env.example`, `docs/MEMORY.md`
Testes adicionados: nenhum — validação manual pendente.

## 🆕 Atualização de Sessão (08/06/2026) — Cadastro de Pneus em Contexto Não-Seguro
Bug corrigido: pneu não era salvo ao clicar em "Cadastrar Pneu" quando o app é acessado por HTTP via IP local.
Causa raiz: `crypto.randomUUID()` é indefinido fora de secure context (HTTP por IP); o erro estourava em `handleSubmit` antes do save. 3 chamadas: TireForm.tsx (144, 156) e TireBatchForm.tsx (191).
Correção aplicada: criado helper `src/lib/uuid.ts` (`safeRandomUUID` com fallback `getRandomValues`/`Math.random`) espelhando o padrão de `hashUtils.ts`; substituídas as 3 chamadas diretas.
Arquivos modificados: `src/lib/uuid.ts` (novo), `src/components/TireForm.tsx`, `src/components/TireBatchForm.tsx`
Testes adicionados: `src/lib/uuid.test.ts` (secure context, contexto não-seguro, sem crypto, unicidade)
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (153 testes); `npx vitest run src/lib/uuid.test.ts` ✅ (4 testes); validação manual ✅

## 🆕 Atualização de Sessão (08/06/2026) — Smoke Test: Setup Resiliente a Vite Frio
Bug corrigido: smoke test falhava intermitentemente quando o Vite dev server estava frio (primeira execução após startup).
Causa raiz: os 6 arquivos de setup (admin, alexandre, carlos, jorge, mariana, pedro) faziam `page.goto('/login')` seguido diretamente de `page.fill('input[type="email"]')`. O Playwright aguardava o HTTP 200 do Vite antes de iniciar os testes, mas o Vite responde 200 antes de compilar o bundle JS. O React não renderizava o formulário a tempo, e `page.fill` estourava o timeout aguardando um seletor que não existia no DOM.
Correção aplicada: todos os 6 setups passaram a aguardar `waitForLoadState('networkidle')` + `expect(locator('input[type="email"]')).toBeVisible()` antes de preencher o formulário, garantindo que o React renderizou o login independentemente do estado do cache do Vite.
Arquivos modificados: `e2e/setup/admin.setup.ts`, `e2e/setup/alexandre.setup.ts`, `e2e/setup/carlos.setup.ts`, `e2e/setup/jorge.setup.ts`, `e2e/setup/mariana.setup.ts`, `e2e/setup/pedro.setup.ts`
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (153 testes); `npm run test:smoke` ✅ (6 testes)

## 🆕 Atualização de Sessão (08/06/2026) — Bug RLS: Motorista não consegue iniciar inspeção de pneus
Bug corrigido: Motorista (Driver) não conseguia iniciar inspeção de pneus — sistema acusava "É necessário cadastrar todos os pneus" mesmo com todos os pneus cadastrados.
Causa raiz: política RLS `tires_select` exigia `role_rank >= 3`; Driver (0) e Yard Auditor (1) não conseguiam LER a tabela `tires`, então a verificação de elegibilidade recebia 0 linhas e bloqueava a inspeção. Inconsistente com `tire_inspections_insert`, que já permite Driver inspecionar.
Correção aplicada: nova migration que recria `tires_select` adicionando SELECT para Driver e Yard Auditor restrito ao próprio `client_id` (INSERT/UPDATE/DELETE inalterados).
Arquivos modificados: `supabase/migrations/20260608000000_fix_tires_select_driver_rls.sql` (novo), `docs/MEMORY.md`
Testes adicionados: nenhum automatizado (sem harness de RLS); validação manual guiada como Driver.

## 🆕 Atualização de Sessão (08/06/2026) — Bug RLS: Inspeção de pneus barrada por RLS (403)
Bug corrigido: criação de inspeção de pneus barrada por RLS ("new row violates row-level security policy for table tire_inspections", HTTP 403) — desmascarado após liberar a leitura de tires para Driver.
Causa raiz: as 8 políticas de tire_inspections / tire_inspection_responses liam o cargo via auth.jwt() ->> 'role', mas o cargo é armazenado em profiles.role (não há claim de role no JWT nem hook). Role resolvia para NULL e todas as operações eram negadas.
Correção aplicada: nova migration recriando as 8 políticas com (SELECT role FROM public.profiles WHERE id = auth.uid()), padrão do restante do schema; corrigido também 'Auditor' -> 'Yard Auditor'.
Arquivos modificados: supabase/migrations/20260608205500_fix_tire_inspections_rls_role_source.sql (novo), docs/MEMORY.md
Testes adicionados: nenhum automatizado (sem harness de RLS); validação manual guiada (criar/preencher/concluir/visualizar inspeção como Driver).

## 🆕 Atualização de Sessão (08/06/2026) — Contador de Pneus na Inspeção de Pneus
Bug corrigido: Inspeção de Pneus (mobile) mostrava total de pneus errado na barra de progresso (ex.: "5 / 7" para veículo com 5 pneus).
Causa raiz: total calculado como `answeredCodes.size + axleConfigSnapshot.length` (respondidos + nº de eixos) em src/pages/TireInspectionFill.tsx:268, em vez do número real de posições.
Correção aplicada: total passou a ser derivado de generatePositionsFromConfig(axleConfigSnapshot, stepsCountSnapshot, '').length (mesma fonte usada pelo diagrama), via useMemo.
Arquivos modificados: src/pages/TireInspectionFill.tsx
Testes adicionados: src/lib/tireInspectionBlueprintLayout.test.ts (paridade total de progresso ↔ pneus desenhados; cenário 2 eixos simples + 1 estepe = 5)

## 🆕 Atualização de Sessão (09/06/2026) — Bugfix: botão "Iniciar" do checklist trava offline
Bug corrigido: botão "Iniciar" do checklist (e "Inspeção de Pneus") travava offline e não avançava para a tela de Km.
Causa raiz: criação do checklist via mutation online (React Query networkMode 'online' pausa a mutation offline; onSuccess/navigate nunca disparam). A infra offline cobre só o preenchimento, não a criação.
Correção aplicada (paliativa): guard offline no início — bloqueia com mensagem honesta em vez de spinner infinito; helper puro src/lib/checklistStartGuard.ts.
Arquivos modificados: src/lib/checklistStartGuard.ts (novo), src/pages/Checklists.tsx
Testes adicionados: src/lib/checklistStartGuard.test.ts
Observação: criação offline real (local-first) registrada como evolução futura.

## 🆕 Atualização de Sessão (09/06/2026) — Bugfix: preenchimento offline do checklist travava
Bug corrigido: preenchimento offline do checklist (e inspeção de pneus) travava — "Confirmar hodômetro" e "Finalizar" ficavam em loop offline.
Causa raiz: as mutations de preenchimento tinham o ramo offline (enqueueOperation) correto, mas sem networkMode; o padrão 'online' do React Query pausa a mutation offline e nunca executa a mutationFn, deixando isPending eterno e o ramo de enfileiramento inalcançável.
Correção aplicada: networkMode: 'offlineFirst' nas 4 mutations de ChecklistFill.tsx e nas 3 de TireInspectionFill.tsx.
Arquivos modificados: src/pages/ChecklistFill.tsx, src/pages/TireInspectionFill.tsx
Testes adicionados: e2e/pending/checklist-offline-fill.spec.ts
Observação: iniciar checklist offline (local-first) continua como evolução futura.

## 🆕 Atualização de Sessão (09/06/2026) — Bugfix: app não sobrevivia a recarregamento offline
Bug corrigido: app não sobrevivia a recarregamento offline (após a foto: tela branca "Esta página não está funcionando" ou volta para "Informe o hodômetro", perdendo o checklist).
Causa raiz: fundação offline-first incompleta — (1) sem service worker/PWA, (2) cache do React Query só em memória, (3) escritas offline (KM/respostas) só na fila Dexie, não refletidas no cache; ao recarregar, kmConfirmed voltava a false porque checklist.odometerKm seguia nulo.
Correção aplicada: PWA com vite-plugin-pwa (navigateFallback p/ reabrir offline); persistência do cache do React Query (PersistQueryClientProvider + localStorage, filtrada às chaves de preenchimento); atualização otimista do cache nas escritas offline; limpeza do cache no logout; redução do pico de memória da câmera.
Arquivos modificados: vite.config.ts, src/vite-env.d.ts, index.html, src/lib/react-query.ts, src/App.tsx, src/context/AuthContext.tsx, src/pages/ChecklistFill.tsx, src/pages/TireInspectionFill.tsx, src/components/CameraCapture.tsx; novos: src/lib/offlineCacheUpdates.ts, public/icons/icon-192.png, public/icons/icon-512.png
Testes adicionados: src/lib/offlineCacheUpdates.test.ts, e2e/pending/checklist-offline-reload.spec.ts
Observação: local-first reads / iniciar checklist offline seguem como evolução futura.

## 🆕 Atualização de Sessão (09/06/2026) — Bugfix: agendamentos do motorista só renderizavam após recarregar a página
Bug corrigido: Agendamentos do motorista só renderizavam após recarregar a página (erro 400 "invalid input syntax for type uuid: [object Object]").
Causa raiz: colisão de queryKey ['driverVehicle', userId, clientId] entre Checklists.tsx (retorna objeto {id,plate,category}) e WorkshopSchedules.tsx (espera string id); o cache do Checklists (1ª tela do motorista) poluía a query de Agendamentos na navegação SPA.
Correção aplicada: queryKey de WorkshopSchedules renomeada para ['driverScheduleVehicleId', ...]; guarda enabled endurecida para typeof string.
Arquivos modificados: src/pages/WorkshopSchedules.tsx; playwright.config.ts (testMatch do project driver).
Testes adicionados: e2e/driver-schedules-cache.spec.ts (regressão E2E navegação SPA Checklists→Agendamentos sem 400).
Observação: duplicação de lógica "resolver veículo do motorista" entre Checklists.tsx e WorkshopSchedules.tsx registrada como evolução futura (hook único useDriverVehicle).

## 🆕 Atualização de Sessão (11/06/2026) — Restrição de Sistemas de Orçamento em Manutenção
Feature implementada: campo Sistema da tabela de itens do orçamento em Manutenção deixou de aceitar texto livre e passou a usar lista suspensa oficial com 12 sistemas conhecidos + Outros.
Causa raiz: sistemas vindos de OCR/IA ou preenchimento manual não eram normalizados, permitindo valores livres inconsistentes; dados legados com system=null ou desconhecido não eram tratados.
Correção aplicada:
- `src/lib/budgetSystems.ts` (novo): fonte única de sistemas oficiais, inferência por palavras-chave e normalização defensiva (isKnownBudgetSystem, normalizeBudgetSystem, inferBudgetSystem).
- `src/lib/budgetOcr.ts`: regex KY e inferSystem removidos; importa inferBudgetSystem e normalizeBudgetSystem de budgetSystems; prompt do Gemini atualizado com lista oficial.
- `src/lib/maintenanceMappers.ts`: budgetItemFromRow aplica normalizeBudgetSystem em row.system.
- `src/services/maintenanceService.ts`: grava system normalizado para itens significativos.
- `src/components/BudgetItemsTable.tsx`: campo Sistema editável trocado de <input type=text> por <select> com BUDGET_SYSTEM_OPTIONS.
- `src/components/MaintenanceForm.tsx`: adicionada validação hasBudgetItemWithoutSystem antes do salvamento; bloqueia submit de itens com nome preenchido e sistema vazio/desconhecido.
Arquivos modificados: src/lib/budgetSystems.ts, src/lib/budgetOcr.ts, src/lib/maintenanceMappers.ts, src/services/maintenanceService.ts, src/components/BudgetItemsTable.tsx, src/components/MaintenanceForm.tsx?
Testes adicionados: src/lib/budgetSystems.test.ts (9), src/lib/maintenanceMappers.test.ts (5), src/components/BudgetItemsTable.test.tsx (3), src/components/MaintenanceForm.validation.test.ts (7)
Validações executadas: npm run lint ✅; npm run test:unit ✅ (188 testes); npm run test:smoke ✅ (6 testes); npm run build ✅ (~4.5s); E2E — falha pré-existente em tire-inspection-assistant.spec.ts mantida; nenhuma nova falha introduzida em Manutenção/Orçamentos.
Decisões: lista de sistemas é constante de frontend (sem tabela no banco); Outros cobre OCR/IA sem identificação, valores vazios e legados; IMPLEMENTATION.md é artefato transitório e não entra no commit por padrão.

## 🆕 Atualização de Sessão (12/06/2026) — Bugfix E2E: inspeção de pneus não abria modal no teste
Bug corrigido: E2E tire-inspection-assistant.spec.ts (bloco C) falhava ao abrir o TireInspectionDetailModal.
Causa raiz: o teste clicava no centro da linha (<tr> sem onClick); no app o modal só abre pelo botão "Visualizar". Não era regressão — a interação de clique-na-linha nunca existiu; a falha só apareceu quando dados reais de inspeção destravaram a guarda test.skip.
Correção aplicada: nos 6 pontos do bloco C, trocar o clique na linha por clique em button[title="Visualizar"] dentro da linha. Nenhuma mudança em produção.
Arquivos modificados: e2e/completed/tire-inspection-assistant.spec.ts
Testes adicionados: nenhum (os C.1–C.6 corrigidos passam a ser a cobertura de regressão real).
Validações executadas: npm run lint ✅; npm run test:unit ✅ (188 testes); npm run test:smoke ✅ (6 testes); npm run test:e2e ✅ (97 passando, 1 falha preexistente em C.2).

Observação preexistente (NÃO corrigida neste bugfix — registro conforme guardrail): C.2 falha por strict mode violation em `modal.getByText(/KM/i)`, que resolve 2 elementos (label "KM" e valor "65.000 km"). A correção é trocar por seletor mais preciso (ex.: `getByText(/^KM$/)`), mas isso está fora do escopo deste bugfix e deve ser tratado em sessão separada.

## 🆕 Atualização de Sessão (12/06/2026) — Correção de Vulnerabilidades npm
Bug corrigido: npm informava 5 high severity vulnerabilities ao auditar/iniciar o projeto
Causa raiz: arvore npm prendia versoes vulneraveis de esbuild via vite@6.4.2 e tsx@4.21.0, alem de plugins Vite em ranges afetados
Correcao aplicada: atualizacao controlada de vite, @vitejs/plugin-react, @tailwindcss/vite, tsx, vitest e @vitest/coverage-v8; lockfile regenerado; adicionado script test:audit
Arquivos modificados: package.json, package-lock.json, docs/MEMORY.md
Testes adicionados: script npm run test:audit

## 🆕 Atualização de Sessão (12/06/2026) — Bug RLS: Coordinator/Director não veem inspeções de pneus
Bug corrigido: inspeção de pneus concluída não aparecia na aba "Inspeções de Pneus" para Coordinator/Director
Causa raiz: política RLS de SELECT de tire_inspections e tire_inspection_responses omitia os cargos 'Coordinator' e 'Director', enquanto a tela (isAssistantPlus em Checklists.tsx) já liberava a aba para eles → RLS retornava 0 linhas silenciosamente
Correção aplicada: nova migration aditiva recriando apenas as duas políticas de SELECT com 'Coordinator' e 'Director' acrescentados à lista de cargos de visão do tenant
Arquivos modificados: supabase/migrations/20260612000000_fix_tire_inspections_select_coordinator_director.sql (novo)
Testes adicionados: e2e/pending/tire-inspections-visibility-by-role.spec.ts (visibilidade por cargo; pendente de usuários de teste)

## 🆕 Atualização de Sessão (12/06/2026) — Remoção do piso de 7 dias em inspeções de pneus
Feature implementada: campo "Pneus (Inspeção)" na tela de Configurações passa a aceitar qualquer valor inteiro a partir de 0 dias (antes: mínimo de 7). O valor padrão de exibição permanece 7 para tenants que nunca configuraram.
Motivação: permitir inspeções consecutivas do mesmo veículo/motorista sem bloqueio de intervalo — essencial para testes.
Correção aplicada:
- `src/components/ChecklistDayIntervalSettings.tsx`: clamp de persistência `Math.max(7, ...)` → `Math.max(0, ...)`; `min="7"` → `min="0"`; handler de digitação `>= 1` → `>= 0`; texto auxiliar e title atualizados.
- `src/services/tireInspectionService.test.ts`: adicionado teste "não bloqueia quando intervalo configurado é 0, mesmo com inspeção concluída hoje".
- `e2e/pending/tire-inspection-settings.spec.ts`: seletores `min="7"` → `min="0"`; teste C.1 reescrito para validar que 0 é permitido e persiste; asserções B.2 atualizadas para `>= 0`.
Função `validateInspectionInterval` NÃO foi alterada — já funciona corretamente para intervalo 0.
Arquivos modificados: src/components/ChecklistDayIntervalSettings.tsx, src/services/tireInspectionService.test.ts, e2e/pending/tire-inspection-settings.spec.ts
Testes adicionados: 1 teste unitário (intervalo 0 não bloqueia)
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (195 testes); `npm run test:smoke` ✅ (6 testes)

## 🆕 Atualização de Sessão (13/06/2026) — Dashboard Executivo Fase 1 (aba Visão Geral + Fila de Ação)
Feature implementada: evolução do Dashboard de painel de contagens para painel de decisão. Nova aba **"Visão Geral"** (agora a aba padrão), ao lado de "Operação" (antiga "Painel Operacional") e "Custos" (antiga "Painel de Custos de Manutenção").
Conteúdo da Visão Geral: 9 KPIs executivos (Total de Veículos, Veículos em Manutenção, Disponibilidade da Frota %, OS Abertas, OS em Atraso, OS Aguardando Aprovação, Custo Total do Período, Conformidade de Checklist %, Documentos Vencidos = CRLV+CNH) + **Fila de Ação** priorizada (itens críticos agrupados por categoria, ordenados por severidade high→medium, clicáveis com navegação por `useNavigate`).
Escopo: Fase 1 apenas (planejado em IMPLEMENTATION.md). Sem alteração de banco; sem dependência nova.
Decisões: (1) 3 abas, com Fila de Ação embutida na Visão Geral em vez de aba "Ativos Críticos" separada; (2) sem aba de Pneus para não duplicar o módulo existente; (3) KPI "Em Manutenção" do painel Operação preservado (conta ORDENS ativas), enquanto a Disponibilidade usa VEÍCULOS distintos via nova função `countVehiclesInMaintenance` — as duas métricas coexistem intencionalmente; (4) Fila de Ação agrupada por contagem (não item a item) — detalhamento com placas/nomes fica para Fase 2.
Único ajuste de dados: campo `expected_exit_date` adicionado ao `select` da query `dashboard-active-maintenance` e ao tipo `MaintenanceOrderDashboard` (habilita "OS em Atraso").
Funções puras novas em `src/lib/dashboardKpi.ts`: `calculateFleetAvailability`, `countVehiclesInMaintenance`, `calculateChecklistComplianceRate`, `countOverdueMaintenanceOrders`, `countPendingApprovalOrders`, `buildActionQueue` (+ tipo `ActionItem`).
Arquivos criados: src/components/dashboard/OverviewPanel.tsx, src/components/dashboard/ActionQueue.tsx
Arquivos modificados: src/pages/Dashboard.tsx, src/types/maintenance.ts, src/lib/dashboardKpi.ts, src/lib/dashboardKpi.test.ts
Testes adicionados: 15 casos unitários para as 6 funções novas (cenário feliz, divisão por zero, clamp, listas vazias, ordenação por severidade).
Commit: e015a31
Validações executadas: `npm run lint` ✅; `npm run test:unit` ✅ (218 testes, era 203); `npm run test:smoke` ✅ (6 testes).
Pendente (próximas fases): Fase 2 — tempos médios em manutenção/permanência, comparativo período atual×anterior, "documentos a vencer em breve" (incl. GR), fila por status como gráfico, detalhamento item a item da Fila de Ação. Fase 3 — tendência/sparklines, projeções, alertas cross-tenant Admin Master.

## 📜 Histórico de Sessões e Mudanças

### Junho 2026
- **Dashboard Executivo — filtro de período restrito à aba Custos (19/06/2026)**:
  - Motivação: remover a ambiguidade do filtro de período global, que afetava somente os custos e dois indicadores fora da aba `Custos`.
  - Mudança: novo componente apresentacional `PeriodRangeFilter`; o filtro de datas foi removido do topo do Dashboard e renderizado apenas na aba `Custos`.
  - Escopo temporal: `Visão Geral` e `Operação` passam a representar situação atual da frota. O card "Custo Total do Período" virou "Custo do Mês Atual" com subtítulo "mês corrente"; o KPI "Tempo médio de OS" usa ordens concluídas no mês corrente.
  - Dados: adicionada query `dashboard-maintenance-current-month` em `Dashboard.tsx`, reutilizando o mesmo select/mapeamento da query de manutenção por período, mas com janela fixa de mês corrente via `getDefaultDateRange()`. A query por `dateRange` permanece ativa e continua alimentando `CostPanel`.
  - Restrições preservadas: Fila de Ação intocada; cálculos da aba `Custos` intocados; nenhuma RPC, migration ou dependência nova.
  - Testes: `PeriodRangeFilter.test.tsx` criado; `OverviewPanel.test.tsx` e `OperationalPanel.test.tsx` atualizados; E2E `dashboard-period-scope.spec.ts` criado.
  - Validações: `npm run lint` ✅; `npm run test:unit` ✅ (418 testes); `npm run test:smoke` ✅ (6); `npx playwright test e2e/completed/dashboard-period-scope.spec.ts --project=chromium` ✅.

- **CRLV a vencer: campo + alerta preventivo no Dashboard (14/06/2026)**:
  - Motivação: eliminar a contradição em que um CRLV podia ser "vencido pelo ano" e "a vencer pela data" ao mesmo tempo; habilitar alerta preventivo "CRLV a vencer (30d)" no Dashboard.
  - Mudança: coluna `crlv_expiration_date DATE NULL` adicionada à tabela `vehicles` (migration aditiva, sem backfill); campo de data no formulário de veículo; predicado puro `isCrlvExpired` com precedência data→ano; `getExpiringSoonCrlvPlates` para a Fila de Ação; `buildActionQueue` estendida com categoria `crlv_expiring` (severity medium).
  - Decisões: campo opcional fixo (não entra em `vehicle_field_settings`); `crlv_year` permanece como fallback; sem backfill; `schema.sql` não é tocado (migrations são fonte de verdade); OCR da data fora do escopo (evolução futura).
  - Segurança: coluna herda RLS existente de `vehicles`; nenhuma policy nova; exibição na Fila de Ação segue o RISCO ACEITO de 13/06/2026.
  - Rollback: `ALTER TABLE vehicles DROP COLUMN IF EXISTS crlv_expiration_date;` (restaura 100% do comportamento anterior).
  - Testes: +15 unitários (273 total). Validações: `npm run lint` ✅, `npm run test:unit` ✅ (273), `npm run test:smoke` ✅ (6). Validação manual guiada ✅.

- **Dashboard Executivo — Fase 3: tendência histórica de custo + projeção financeira (13/06/2026)**:
  - Motivação: acrescentar ao painel de Custos capacidades analíticas de série temporal e projeção orçamentária, usando dados já existentes sem alterar banco/RLS.
  - Mudança: gráfico "Evolução do Custo de Manutenção" (Recharts LineChart) com granularidade automática dia/mês baseada no span do filtro de período; KPI "Projeção Próximo Mês" calculado por média móvel simples dos 3 meses fechados anteriores.
  - Funções puras: `chooseTrendGranularity` (span ≤62 → dia, >62 → mês), `buildCostTrendSeries` (buckets cronológicos com soma por chave, helper interno `enumerateBucketKeys`), `getTrailingMonthKeys` (meses fechados anteriores), `sumApprovedCostByMonthKeys` (totais por chave de mês), `calculateMovingAverageProjection` (média arredondada).
  - Dados: query `dashboard-cost-projection` busca custo aprovado dos 3 meses anteriores ao mês corrente, sem filtro de período; série de tendência reutiliza `maintenanceOrders` da query existente, aplicando `filteredOrders` (respeita filtros de tipo).
  - Decisões: granularidade determinística (limiar 62 dias); série casada com filtro de período; projeção por média móvel de 3 meses (explicável, robusta a outliers com pouco histórico); série usa `filteredOrders`, projeção usa query própria.
  - Escopo reduzido: itens cross-tenant Admin Master e campo `crlv_expiration_date` adiados para planos próprios (Tipo 4, com migration/RLS dedicados).
  - Componente novo: `CostTrendChart.tsx` (presentational, LineChart, empty state "Sem dados de custo no período.").
  - Testes: +17 unitários (258 total). Validações: `npm run lint` ✅, `npm run test:unit` ✅ (258), `npm run test:smoke` ✅ (6).

- **Dashboard Executivo — Fase 2: tendência, comparativos e refinamento (13/06/2026)**:
  - Motivação: evoluir a Fase 1 do Dashboard com indicadores acionáveis de tendência operacional, comparativo financeiro e detalhamento item a item da Fila de Ação.
  - Mudança: aba "Operação" recebeu tempo médio em manutenção, permanência média de OS abertas e gráfico "Fila de Manutenção por Status"; aba "Custos" recebeu custo do período anterior e variação percentual; aba "Visão Geral" recebeu KPI "Documentos a Vencer (30d)".
  - Fila de Ação: contrato de `buildActionQueue` evoluído de contagens para listas de detalhes (`details`), exibindo placas para veículos/OS e nomes para CNH, com renderização compacta e "+N mais" acima de 5 itens.
  - Dados: queries existentes estendidas com `license_plate`, `gr_expiration_date`, `entry_date` e `actual_exit_date`; nova query `dashboard-maintenance-previous` para período anterior. Sem migration. Sem dependência nova.
  - Decisões: "Documentos a Vencer (30d)" cobre somente CNH e GR; CRLV permanece apenas como vencido porque o banco possui `crlv_year`, não data de vencimento. Janela fixa de 30 dias nesta fase.
  - Segurança/LGPD: RISCO ACEITO — exibição de placa/nome na Fila de Ação aprovada pelo usuário em 13/06/2026, restrita ao tenant via RLS e aos perfis que já acessam o Dashboard.
  - Testes: funções puras novas adicionadas a `dashboardKpi.ts`; testes unitários de médias, status, período anterior, variação, documentos a vencer, mapeamento de placas e detalhes da Fila de Ação. Validações: `npm run lint` ✅, `npm run test:unit` ✅ (241), `npm run test:smoke` ✅ (6), checagem DOM autenticada das abas Visão Geral, Operação e Custos ✅.

- **Dashboard Executivo — Fase 1: aba Visão Geral + Fila de Ação (13/06/2026)**:
  - Motivação: evoluir o Dashboard de um painel de contagens para um painel executivo e operacional de decisão (visibilidade executiva e alertas de ação como prioridade #1).
  - Planejamento: gerado via protocolo `prompts/Evolucao.md` (IMPLEMENTATION.md, Tipo 3 — alteração de funcionalidade existente).
  - Mudança: nova aba "Visão Geral" (aba padrão) com 9 KPIs executivos + Fila de Ação priorizada; abas existentes renomeadas para "Operação" e "Custos".
  - Decisões de arquitetura: 3 abas (Fila de Ação embutida na Visão Geral, não aba separada); sem aba de Pneus (evita duplicar módulo existente); KPI "Em Manutenção" (conta ordens) preservado e coexistindo com Disponibilidade (conta veículos distintos via `countVehiclesInMaintenance`); Fila de Ação agrupada por contagem na Fase 1.
  - Dados: único ajuste foi adicionar `expected_exit_date` ao `select` de `dashboard-active-maintenance` e ao tipo `MaintenanceOrderDashboard`. Sem migration. Sem dependência nova.
  - Lógica: 6 funções puras novas em `dashboardKpi.ts` (`calculateFleetAvailability`, `countVehiclesInMaintenance`, `calculateChecklistComplianceRate`, `countOverdueMaintenanceOrders`, `countPendingApprovalOrders`, `buildActionQueue`) + tipo `ActionItem`. Componentes novos: `OverviewPanel.tsx`, `ActionQueue.tsx`.
  - Padrões aplicados: Pure functions + Presentational Components, Progressive Disclosure (UX), derived state via `useMemo`.
  - Testes: +15 unitários (218 total). Validações: `npm run lint` ✅, `npm run test:unit` ✅ (218), `npm run test:smoke` ✅ (6). Commit `e015a31`.
  - Próximas fases documentadas no IMPLEMENTATION.md: Fase 2 (tempos médios, comparativo período anterior, documentos a vencer, fila por status, detalhamento item a item) e Fase 3 (tendência/sparklines, projeções, alertas cross-tenant Admin Master).

- **Remoção do piso de 7 dias em inspeções de pneus (12/06/2026)**:
  - Motivação: permitir inspeções consecutivas do mesmo veículo/motorista sem bloqueio de intervalo — essencial para testes operacionais.
  - Mudança: campo "Pneus (Inspeção)" em Configurações passa a aceitar qualquer inteiro a partir de 0 dias; padrão de exibição mantido em 7.
  - Frontend: `ChecklistDayIntervalSettings.tsx` — clamp `Math.max(7,...)` → `Math.max(0,...)`; `min="7"` → `min="0"`; handler `>= 1` → `>= 0`; texto e title atualizados.
  - Teste unitário: adicionado caso "intervalo 0 não bloqueia" em `tireInspectionService.test.ts` (195 testes total).
  - E2E: `tire-inspection-settings.spec.ts` atualizado para novo piso 0, teste C.1 reescrito como "salvar 0 persiste".
  - Função `validateInspectionInterval` inalterada; sem migration; sem novo arquivo.
  - Validações: `npm run lint` ✅, `npm run test:unit` ✅ (195), `npm run test:smoke` ✅ (6).

- **Correção de Vulnerabilidades npm (12/06/2026)**:
  - Causa raiz: árvore npm prendia versões vulneráveis de esbuild via vite@6.4.2 e tsx@4.21.0, além de plugins Vite em ranges afetados. O npm audit apontava 5 high severity vulnerabilities.
  - Correção: atualização controlada para vite@8.0.16, @vitejs/plugin-react@6.0.2, @tailwindcss/vite@4.3.1, tsx@4.22.4, vitest@4.1.8, @vitest/coverage-v8@4.1.8; lockfile regenerado; adicionado script `npm run test:audit` como gate de regressão.
  - Arquivos modificados: `package.json`, `package-lock.json`, `docs/MEMORY.md`.
  - Validações: `npm run test:audit` ✅ (0 vulnerabilities), `npm run lint` ✅, `npm run test:unit` ✅ (191 testes), `npm run build` ✅ (~0.7s), `npm run test:smoke` ✅ (6 testes), `npm run test:e2e` ✅ (140 passed, 2 skipped).

- **Bug RLS: Coordinator/Director não veem inspeções de pneus (12/06/2026)**:
  - Causa raiz: políticas RLS `tire_inspections_select` e `tire_inspection_responses_select` omitiam os cargos Coordinator e Director na cláusula IN de SELECT, embora a tela (`isAssistantPlus`) já os incluísse. RLS filtrava silenciosamente as linhas.
  - Correção: migration aditiva `20260612000000_fix_tire_inspections_select_coordinator_director.sql` recriando as duas políticas de SELECT com Coordinator e Director adicionados à lista. Nenhuma outra política alterada.
  - E2E pendente: `e2e/pending/tire-inspections-visibility-by-role.spec.ts` (depende de recadastramento de usuários de teste Coordinator/Director).

- **Aba Inspeções de Pneus em Checklists (12/06/2026)**:
  - Criada navegação interna controlada na visão Assistant+ de `/checklists` com abas "Checklists" e "Inspeções de Pneus".
  - A tabela de Checklists voltou a listar apenas checklists; inspeções de pneus passaram para tabela dedicada com veículo, inspetor, início, conclusão, status e ação de visualização.
  - Adicionado `fetchTireInspectionComparison` em `tireInspectionService.ts`, buscando a inspeção atual e as 2 anteriores do mesmo veículo e agrupando respostas por posição gerada via `generatePositionsFromConfig`.
  - `TireInspectionDetailModal` evoluído para manter header/metadados/resumo e substituir a galeria plana por comparação visual de até 3 fotos por posição, com data, status e badge "Atual".
  - `tire-inspection-assistant.spec.ts` atualizado para o novo fluxo da aba dedicada e para validações do viewer comparativo.
  - Validações: `npm run lint`, `npm run test:unit` (191 testes), E2E específico de inspeção de pneus (14 testes) e `npm run test:smoke` (6 testes) passaram.

- **Alçada de Aprovação (04/06/2026)**:
  - Corrigido bug crítico: Fleet Assistant aprovação orçamentos acima de sua alçada quando itens não estavam carregados.
  - `canApprove` passou a considerar `itemsLoading` e `hasItems` antes de liberar aprovação.
  - `reviewMutation` revalida itens e total contra `budgetApprovalLimit` antes do UPDATE.
  - Tooltip do botão explicita motivo do bloqueio (loading, sem itens, acima do limite).
  - Adicionados testes unitários e spec E2E de regressão.

- **Configurações de Motoristas (04/06/2026)**:
  - Corrigido bug onde Coordinator recebia HTTP 403 ao salvar campos obrigatórios do motorista.
  - Policies `dfs_insert` e `dfs_update` recriadas para aceitar Coordinator+, espelhando a correção já aplicada em `vehicle_field_settings`.
  - `saveDriverMutation` em `Settings.tsx` recebeu validação de linha persistida (guardrail defensivo).
  - Criado spec E2E `settings-driver-field-persistence.spec.ts`.

- **Configurações de Veículos (03/06/2026)**:
  - Corrigido mesmo padrão de bug para `vehicle_field_settings`.
  - Policy de escrita alinhada para Coordinator/Manager/Director/Admin Master.
  - `saveVehicleMutation` recebeu validação de linha persistida.
  - Criado spec E2E `settings-vehicle-field-persistence.spec.ts`.

### Maio 2026
- **Telefone no Cadastro de Motoristas (11/05/2026)**:
  - Adicionada migration aditiva para coluna `phone` em `drivers` (`VARCHAR(20)`, nullable, `DEFAULT NULL`).
  - Estendido o tipo `Driver` com `phone?: string`.
  - Atualizados os mappers (`driverFromRow` e `driverToRow`) para sincronizar `phone` entre snake_case e camelCase.
  - Atualizado `DriverForm` com campo opcional "Telefone de Contato", usando `filterPhone`.
  - Atualizado `DriverDetailModal` para exibir telefone formatado (`(XX) XXXXX-XXXX` / `(XX) XXXX-XXXX`).
  - Incluídos 3 testes unitários novos no `driverMappers.test.ts`, totalizando 111 testes passando.

### Abril 2026
- **Redesign da Documentação**: Reorganização completa da estrutura de arquivos `.md` para o padrão `agent/` e `docs/`, visando melhor manutenção e clareza para assistentes de IA.
- **Otimização de Performance**: Limpeza de código morto, unificação de mappers e configuração de cache global via React Query. Build reduzido para ~8s.
- **Módulo de Pneus v2**: Implementação de configuração dinâmica de eixos (AxleConfigEditor) e histórico detalhado de movimentação.

### Março 2026
- **Infraestrutura Offline**: Introdução do Dexie (IndexedDB) para garantir o preenchimento de checklists sem conexão.
- **Gestão de Embarcadores**: Adição das tabelas `shippers` e `operational_units` com lógica de cascading e RLS restritivo.
- **Oficinas Parceiras**: Transição do modelo de oficina local para contas globais (`workshop_accounts`) e parcerias (`workshop_partnerships`).
- **OCR de Orçamentos**: Implementação de extração de dados via Gemini Vision para agilizar a aprovação de manutenção.

### Fevereiro 2026 e Anteriores
- **Bootstrap do Projeto**: Inicialização com React + Vite + Tailwind v4.
- **Fundação Supabase**: Configuração inicial de Auth, Profiles e RLS para Veículos e Motoristas.
- **Sistema de Checklists**: Criação de templates versionados (draft/published/deprecated).

---

## 🏛️ Decisões de Arquitetura (ADRs)

### 1. Supabase como Backend único
Decidimos não utilizar um backend Node.js separado para reduzir a complexidade e latência, utilizando Edge Functions para lógicas que exigem privilégios de `service_role`.

### 2. Tailwind CSS v4 vs Shadcn/UI
Optamos pelo Tailwind v4 puro para maior controle estético e performance, criando componentes customizados que seguem a identidade visual premium do projeto em vez de usar bibliotecas de UI genéricas.

### 3. Mapeamento Manual (Mappers)
Em vez de usar ORMs complexos no frontend, utilizamos funções de mapeamento puro (`src/lib/*Mappers.ts`). Isso garante tipos fortes e evita o vazamento de nomes de colunas do banco (snake_case) para o código da aplicação (camelCase).

---

### 11/06/2026 — Restrição de Sistemas de Orçamento em Manutenção
- **Causa raiz:** campo Sistema da tabela de itens do orçamento aceitava texto livre; OCR/IA gerava valores inconsistentes; dados legados com `system = null` ou desconhecidos não eram normalizados.
- **Correção:** fonte única `budgetSystems.ts` com 12 sistemas oficiais + Outros; OCR/IA e mappers aplicam normalização defensiva; UI usa `<select>` controlado; formulário bloqueia salvamento sem sistema válido; service grava somente valores normalizados.
- **Arquivos:** `budgetSystems.ts` (novo), `budgetOcr.ts`, `maintenanceMappers.ts`, `maintenanceService.ts`, `BudgetItemsTable.tsx`, `MaintenanceForm.tsx`.
- **Testes:** `budgetSystems.test.ts` (9), `maintenanceMappers.test.ts` (5), `BudgetItemsTable.test.tsx` (3), `MaintenanceForm.validation.test.ts` (7).
- **Decisões:** lista de sistemas é constante de frontend (sem migration); Outros é o fallback universal; IMPLEMENTATION.md não entra no commit.

### 09/06/2026 — Bugfix: agendamentos do motorista só renderizavam após recarregar a página
- **Causa raiz:** colisão de queryKey `['driverVehicle', userId, clientId]` entre `Checklists.tsx` (retorna objeto `{id,plate,category}`) e `WorkshopSchedules.tsx` (espera string `id`). Na navegação SPA, o cache populado pelo Checklists poluía a query de Agendamentos, que enviava `[object Object]` como `vehicle_id` ao PostgREST, gerando erro 400.
- **Correção:** renomeação da queryKey para `['driverScheduleVehicleId', userId, clientId]` e endurecimento da guarda `enabled` para `typeof driverVehicle === 'string' && driverVehicle.length > 0`.
- **Teste de regressão:** `e2e/driver-schedules-cache.spec.ts` (navegação SPA Checklists→Agendamentos sem erro 400).

> [!NOTE]
> Este arquivo substitui o antigo `CHANGELOG.md`, focando em decisões de alto nível e marcos históricos.

### 12/06/2026 — Bugfix E2E: inspeção de pneus não abria modal no teste
- **Contexto:** `tire-inspection-assistant.spec.ts` (bloco C) falhava com timeout aguardando `.fixed.inset-0` ficar visível.
- **Causa raiz:** teste clicava no centro da `<tr>` (sem `onClick`); o modal só abre pelo botão "Visualizar". Não era regressão — a interação nunca existiu; falhou quando dados reais de inspeção destravaram a guarda `test.skip`.
- **Correção:** nos 6 pontos do bloco C, trocar `tireRows.first().click()` / `completedRows.first().click()` por `.locator('button[title="Visualizar"]').click()`. Nenhuma mudança em produção.
- **Arquivo modificado:** `e2e/completed/tire-inspection-assistant.spec.ts`.
- **Testes:** C.1–C.6 corrigidos passam a ser cobertura de regressão real; nenhum teste novo necessário.
