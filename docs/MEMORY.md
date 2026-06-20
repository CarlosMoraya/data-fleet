# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.

## Estado Atual

- **Cadastros**: Veículos, Motoristas, Embarcadores e Unidades Operacionais estabilizados.
- **Manutenção**: workflow de OS, cancelamento, aprovação de orçamento e OCR operacional.
- **Checklists**: infraestrutura offline-first ativa, com templates versionados e smoke oficial definido.
- **Pneus**: módulo funcional com inspeções, configuração de eixos e histórico.
  - **Filtros de Veículos/Motoristas**: padronizados como deep links (`issue`/`shipper`/`unit`/`q`) com retrocompat para nomes/valores legados em português. Busca textual (`q`) saiu do `sessionStorage` e vive apenas na URL. Nenhum filtro destas telas é persistido em `bf:v1:ui`.
- **Oficinas**: modelo de parceria multi-tenant ativo.
- **Dashboard Executivo (atualização 2026-06-20)**: 5 abas em produção (`Visão Geral`, `Operação`, `Conformidade`, `Custos`, `Evolução`). `Conformidade` agora é a tela própria de regularidade documental de veículos e motoristas, com 7 cards fixos (`Conformidade Documental`, `Documentos Vencidos`, `Documentos a Vencer em 30 dias`, `Documentos Ausentes`, `Veículos Irregulares`, `Motoristas Irregulares`, `Itens Críticos`) e a `Fila de Ação Documental` com 14 categorias acionáveis por deep link. `Documentos vencidos`, `a vencer` e `ausentes` pertencem exclusivamente a esta aba. `Custos` continua sendo a única aba que obedece ao filtro de período persistido; `Visão Geral`, `Operação` e `Conformidade` representam situação atual. **Aba Custos — filtros aprovados e Custo por KM validados em 2026-06-20**: filtros de Categoria, Modelo (combobox), Embarcador e Unidade Operacional implementados em `CostFilters.tsx`; 6 cards entregues (`Custo no Período`, `Custo por KM`, `Custo do Mês Atual`, `Projeção Próximo Mês`, `Ticket Médio por OS`, `Custos com Reboque`); cálculo de Custo por KM via RPC `dashboard_vehicle_km_in_period` (`MAX−MIN` de odometer_km) + `calculateCostPerKm` (retorna null quando KM ≤ 0); filtros persistidos em `usePersistentFilterState` (escopo session, não em deep links); suite E2E de 4 testes em `e2e/completed/dashboard-costs-filters.spec.ts` passando 4/4 sem skips (massa no Dev: veículos DEV4D56 Médio + DEV5E67 Pesado para primaryClient; segundo checklist com odômetro crescente para exercitar KM).
- **Dashboard Executivo**: 4 abas em produção (`Visão Geral`, `Operação`, `Custos`, `Evolução`). A aba `Evolução` (adicionada em 2026-06-19) é dedicada a indicadores mensais e tendência histórica, com seletor de horizonte (3/6/12 meses ou ano atual) persistido via `useUiPreference` (default `6m`). Entrega: custo mensal de manutenção, OS abertas/concluídas por mês, tempo médio de conclusão por mês e distribuição mensal por tipo de manutenção. Custo por KM mensal foi adiado para v2. O filtro de período fica restrito à aba `Custos`; `Visão Geral` e `Operação` representam situação atual da frota. A aba `Visão Geral` segue como raio-x executivo da frota, com exatamente 8 cards fixos (`Total de Veículos`, `Veículos Disponíveis`, `Veículos Indisponíveis`, `Disponibilidade da Frota`, `Custo do Mês Atual`, `Conformidade de Checklist`, `Cobertura de Rastreador`, `Cobertura de Seguro`) e o bloco `Mapa da Frota` com 6 gráficos (`Frota por Categoria`, `Frota por Tipo`, `Top Modelos da Frota`, `Próprios x Alugados x Agregados`, `Frota por Unidade Operacional`, `Frota por Embarcador`). A aba `Operação` foi reescrita em 2026-06-20 para conter exatamente 8 cards fixos (`Veículos Indisponíveis`, `Veículos sem Motorista`, `OS Abertas`, `OS com Prazo Vencido`, `Saída Prevista até Fim da Semana`, `OS Aguardando Aprovação`, `Checklists Vencidos`, `Planos de Ação Abertos`) e a `Fila de Ação Operacional`, sem gráficos e sem cards/filas de documentos. A fila operacional agora usa `buildOperationalActionQueue`, navegação via `OPERATIONAL_QUEUE_ROUTES`, preserva os deep links existentes (`issue=no_driver`, `issue=checklist_overdue`) e inclui `OS vencendo nos próximos 7 dias`. O card `Planos de Ação Abertos` é alimentado pela query aditiva `dashboard-action-plans-open` (SELECT direto em `action_plans`); o rótulo `OS em Atraso` deixou de existir na Operação e foi substituído por `OS com Prazo Vencido`, mantendo a mesma regra (`expected_exit_date < hoje`). A aba `Custos` mantém tendência histórica, projeção financeira e todos os cálculos controlados pelo período selecionado. As agregações pesadas de custo anterior, projeção mensal, última checklist por veículo/contexto e KM rodado por veículo continuam via RPCs dedicadas.
- **Bancos de dados**: o ambiente local passou a apontar para o Supabase Dev (`vvbnbzzhpiksacqudmfu`) com massa oficial de teste e Edge Functions publicadas para os fluxos de usuários. Production (`oajfjdadcicgoxrfrnny`) continua separado. Em 2026-06-19, o Dev recebeu a migration `20260619000000_align_vehicle_columns.sql` para alinhar `vehicles` com o schema atual usado pelo frontend e pelos testes.
- **Persistência de cache React Query**: política central ativa em `src/lib/cachePolicy.ts`, com allowlist default-deny, TTL por tipo (`reference`, `operational`, `dashboard`, `offline`) e `buster: 'v2'` para descartar blobs antigos. PII, workflows voláteis e helpers sem escopo de cliente ficam fora da persistência. As queries de RPCs do Dashboard (`dashboard-last-checklists`, `dashboard-vehicle-km`) estão na allowlist com TTL de dashboard desde 2026-06-17. Settings de campos obrigatórios (`vehicleSettings`, `vehicleFieldSettings`, `driverSettings`, `driverFieldSettings`) ficam fora da persistência para evitar reidratação stale em reload após save.
- **Suíte E2E pós-otimização**: entregue cobertura de regressão para persistência sob reload, isolamento entre tenants Deluna/BetaFleet, limpeza de storage no logout, lazy loading de gráficos/PDF, route splitting/TTUC e Agendamentos. A bateria completa `npx playwright test` passou com 170/170 em 19/06/2026 usando a massa oficial do Dev.
- **Protocolo de Performance**: disponível via `npm run perf`. Mede bundle (raw/gzip), cold start (shell + primeira tela útil), entrada por rota (6 rotas principais), contagem de requests e comportamento de voltar à página. Gera relatórios em `docs/reports/perf/` com diff contra baseline versionado e gate de regressão (tolerância 15%). Arquitetura: lógica pura em `src/lib/perfReport.ts`, scripts I/O em `scripts/`, spec Playwright isolada em `playwright.perf.config.ts`. O baseline vigente já reflete code splitting por rota, lazy loading de gráficos do Dashboard e carregamento sob demanda de `pdfjs-dist`.
- **Performance frontend**: o roteador central usa code splitting por rota. O antigo chunk único `index-*.js` de **~1,96 MB raw / ~520,7 KB gzip** foi quebrado em chunks sob demanda; depois, `pdfjs-dist` e os gráficos com `recharts` também passaram a carregar sob demanda. O maior chunk atual continua sendo `pdf.worker.min-*.mjs` com **~1,21 MB raw / ~358,7 KB gzip**; o Dashboard caiu de **421,6 KB raw / 118,8 KB gzip** para **~35 KB raw / ~9 KB gzip**. Resultado aceito: `totalJsGzip` agregado em **~923 KB**; regressões de perf em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs` foram aceitas pelo usuário em 17/06/2026 como oportunidades de melhoria futura, sem atualizar baseline.

## Tarefas em Andamento

1. **Performance pós-otimização**:
   - Investigar as regressões aceitas em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs`.
2. **Migração incremental para React Query**:
   - Restam páginas menores ainda usando estado local.
3. **Acessibilidade**:
   - Revisão pendente de `aria-labels` em modais e tabelas.
4. **Unificação de estilo de RLS policies**:
   - DEV usa funções helper (`is_admin_master()`, `get_my_client_id()`, `get_my_role()`); PROD usa subqueries inline. Comportamento idêntico, mas manutenção mais difícil. Avaliar padronizar um dos lados.

## Próximos Passos

1. Investigar regressões aceitas do `npm run perf`: entrada de Veículos, requests de Pneus e retorno para Veículos.
2. Avaliar notificações de vencimento (CRLV/CNH) via Edge Functions.
3. Considerar backfill futuro de `crlv_expiration_date` para veículos legados, se houver demanda.
4. Evoluir performance pós-lazy loading: avaliar `manualChunks` em `vite.config.ts`, cache/preload do `pdf.worker` e teste de render para `CostPanel`.
5. Unificar estilo de RLS policies entre DEV e PROD (DEV usa funções helper `is_admin_master()`/`get_my_client_id()`/`get_my_role()`; PROD usa subqueries inline — comportamento idêntico, mas manutenção mais difícil).

## Decisões Vigentes

- **Admin Master** com `currentClient = null` representa visão agregada cross-tenant onde o RLS já permite leitura.
- **CRLV** usa precedência **data real de vencimento → ano**; `crlv_year` é apenas fallback quando a data não existe.
- **Fila de Ação** pode exibir placas e nomes dentro do tenant. **Risco aceito** em 2026-06-13.
- **Cache operacional em repouso**: listas operacionais permitidas (`vehicles`, `shippers`, `operationalUnits`, `tires` e agregados de dashboard) podem residir no `localStorage` do usuário autenticado. Não incluem PII pesada e são limpas no logout, mas ficam em repouso sem criptografia. **Risco aceito** em 2026-06-16.
- **Settings fora do cache persistido**: configurações de campos obrigatórios de veículos e motoristas não entram no `betafleet-rq-cache`; reload da tela de Configurações deve buscar o banco para evitar corrida de persister com valor antigo.
- **Regressões de performance aceitas**: em 2026-06-17, o usuário aceitou seguir com regressões detectadas em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs` como oportunidades futuras. O baseline não foi atualizado nesta sessão.
- **Smoke oficial** do projeto é `npm run test:smoke`; em falha, a correção precede novas evoluções.
- **Convenção `bf:v1:ui`** para persistência de estado de UI implementada em `src/lib/uiStateStorage.ts` e `src/hooks/usePersistentUiState.ts`. Todos os módulos prioritários migrados. Dados sensíveis removidos do storage.
- **Risco aceito — dados na URL**: busca textual (incl. nome/CPF de motoristas) agora trafega na URL, no histórico do navegador e em links compartilhados. **Aceito em 2026-06-19** por ser sistema enterprise interno, autenticado e multi-tenant com RLS; sem acesso público em massa.
- **Bancos Dev e Prod**: a auditoria estrutural de 2026-06-19 segue registrada em `docs/MEMORY-HISTORY.md`, mas o Dev recebeu em seguida a migration de compatibilidade `20260619000000_align_vehicle_columns.sql` para acompanhar o schema atual do frontend e da suíte E2E.
- **Dashboard RPCs restauradas**: as 4 funções de agregação (`dashboard_previous_period_cost`, `dashboard_last_checklist_per_vehicle`, `dashboard_cost_projection_monthly`, `dashboard_vehicle_km_in_period`) são a abordagem vigente. Em 2026-06-19, um rollback removeu as 4 RPCs de ambos os bancos (`20260619000003`); a reversão recriou apenas `dashboard_last_checklist_per_vehicle` (`20260619000005`), deixando as outras 3 faltantes no Dev — corrigido com `CREATE OR REPLACE` manual + `GRANT` + `NOTIFY pgrst` no SQL Editor do Dev. Nenhum arquivo de `src/` alterado.
- **Escopo temporal do Dashboard**: `Visão Geral` e `Operação` são situação atual; somente `Custos` obedece ao filtro de período. O intervalo persistido via `useUiPreference` continua existindo, mas é exibido apenas na aba `Custos`.
- **KM por veículo no Dashboard (Custo por KM)**: `MAX(odometer_km) − MIN(odometer_km)` no período é a fórmula aprovada (2026-06-20). Idêntico a "último checklist − primeiro checklist" quando o odômetro é monotônico, e mais robusto contra leituras fora de ordem. Não trocar pela versão literal por data. Regra enforcement: `HAVING COUNT >= 2 AND (MAX−MIN) > 0` na RPC `dashboard_vehicle_km_in_period`. Cálculo do lado TypeScript em `calculateCostPerKm` (`src/lib/dashboardKpi.ts`): retorna `{ value: null, totalKm: 0 }` quando KM total válido é ≤ 0.
- **Conformidade documental**: `Itens Críticos = Documentos Vencidos + Documentos Ausentes`; itens `a vencer em 30 dias` não entram como críticos.
- **Base da Conformidade Documental**: a taxa usa `(veículos + motoristas regulares) / (veículos + motoristas totais)` com retorno `100` quando não há entidades.
- **Definições vigentes de ausência documental**: `Sem GR/CRLV/CNH` usa upload nulo, indefinido, vazio ou em branco; `Veículo sem Apólice de Seguro` usa `has_insurance !== true`; `Veículo sem Contrato de Manutenção` usa `has_maintenance_contract !== true`; `Motoristas sem GR` contam apenas motoristas vinculados a pelo menos 1 veículo.

Bug corrigido: 404 (PGRST202) nas RPCs dashboard_previous_period_cost, dashboard_cost_projection_monthly e dashboard_vehicle_km_in_period ao abrir o Dashboard.
Causa raiz: Tipo D — as 3 funções foram removidas no rollback de 2026-06-19 e nunca reexecutadas no SQL Editor do Dev (vvbnbzzhpiksacqudmfu) após a reversão para o modelo de RPCs; só dashboard_last_checklist_per_vehicle havia sido recriada. Código (Dashboard.tsx) estava correto.
Correção aplicada: CREATE OR REPLACE das 3 funções SECURITY INVOKER + GRANT EXECUTE TO authenticated + NOTIFY pgrst no SQL Editor do Dev (e Prod, se autorizado). Nenhum arquivo de src/ alterado.
Arquivos modificados: nenhum em src/. Novo teste: e2e/smoke/dashboard-rpcs-health.spec.ts.
Testes adicionados: e2e/smoke/dashboard-rpcs-health.spec.ts (saúde das 4 RPCs do Dashboard).

Bug corrigido: Fila de Ação do Dashboard não aplicava o filtro ao navegar para Cadastros > Motoristas (CNH vencida, CNH a vencer, GR do motorista a vencer).
Causa raiz: Tipo A — src/lib/actionQueueRoutes.ts mapeava as 3 categorias de motorista para a rota crua /cadastros/motoristas, sem o query param ?situacao=. A tela de Motoristas lê 'situacao' corretamente; faltou estender o mapa de rotas (análogo ao ?pendencia= dos veículos).
Correção aplicada: adicionado ?situacao=cnh_vencida / cnh_a_vencer / gr_a_vencer às chaves cnh / cnh_expiring / gr_driver_expiring em GENERAL_ACTION_ROUTES e OPERATIONAL_ACTION_ROUTES.
Arquivos modificados: src/lib/actionQueueRoutes.ts, src/lib/actionQueueRoutes.test.ts.
Testes adicionados: actionQueueRoutes.test.ts — "uses only valid driver situation values in driver routes" (regressão) + atualização das asserções de rota de motorista.

## Protocolo oficial de smoke

**Comando oficial:** `npm run test:smoke`

**Objetivo:** Responder se a aplicação sobe, autentica, protege rotas e mantém a navegação crítica funcionando.

**Pré-condições ambientais:**
- Dependências instaladas.
- `.env.local` válido com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
- Dados demo mínimos existentes para `admin@demo.betafleet.local` e `coordinator@demo.betafleet.local`.

**Escopo incluído:**
- Tela pública de login renderiza.
- Rota protegida redireciona usuário anônimo para login.
- Sessão autenticada (admin) chega ao Dashboard.
- Shell de Cadastros renderiza e abas mudam rota/conteúdo (admin).
- Coordinator mantém navegação responsiva nas abas de Cadastros após idle (regressão específica).

**Escopo excluído:**
- CRUD completo, OCR, upload/importação, fluxos destrutivos.
- Todos os papéis do sistema.
- Todos os módulos do menu.
- Specs em `e2e/pending/**`.
- Matriz completa de permissões.

**Conduta em falha:** Parar, registrar o teste falho com erro e evidência, corrigir antes de prosseguir com qualquer outra tarefa.

**Observação:** `npm run test:e2e` é regressão completa e não substitui o smoke; smoke não substitui regressão completa.

**Spec dedicada:** `e2e/smoke/app-smoke.spec.ts`

## Referência Histórica

- Todo o histórico anterior deste arquivo foi arquivado em `docs/MEMORY-HISTORY.md`, sob `## Arquivamento — 2026-06-14`.
- Sessão de 2026-06-19: auditoria e sincronização de bancos Dev/Prod registrada em `docs/MEMORY-HISTORY.md` sob `## Arquivamento — 2026-06-19`.
