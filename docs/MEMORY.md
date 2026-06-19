# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.

## Estado Atual

- **Cadastros**: Veículos, Motoristas, Embarcadores e Unidades Operacionais estabilizados.
- **Manutenção**: workflow de OS, cancelamento, aprovação de orçamento e OCR operacional.
- **Checklists**: infraestrutura offline-first ativa, com templates versionados e smoke oficial definido.
- **Pneus**: módulo funcional com inspeções, configuração de eixos e histórico.
- **Oficinas**: modelo de parceria multi-tenant ativo.
- **Dashboard Executivo**: 3 abas em produção (`Visão Geral`, `Operação`, `Custos`), com tendência histórica de custo, projeção financeira, métricas documentais incluindo CRLV e cards de KPI com título em até 2 linhas; na aba Operação, os cards usam os textos "Tempo médio de OS" e "Idade média de OS abertas", a grade de gráficos foi repriorizada para destacar primeiro o gargalo operacional (Fila de Manutenção por Status, Frota por Unidade Operacional, Frota por Embarcador), e a aba agora exibe uma Fila de Ação acionável com CNH/GR a vencer e destino de Aprovação de Orçamentos para `OS aguardando aprovação`. As agregações pesadas de custo anterior, projeção mensal, última checklist por veículo/contexto e KM rodado por veículo foram movidas para RPCs `SECURITY INVOKER` no Supabase, preservando as funções puras de KPI no cliente. Essas 4 RPCs (`dashboard_previous_period_cost`, `dashboard_cost_projection_monthly`, `dashboard_last_checklist_per_vehicle`, `dashboard_vehicle_km_in_period`) foram aplicadas no projeto Supabase em 2026-06-17, corrigindo os 404 que apareciam no Dashboard em dev e produção (ver MEMORY-HISTORY).
- **Persistência de cache React Query**: política central ativa em `src/lib/cachePolicy.ts`, com allowlist default-deny, TTL por tipo (`reference`, `operational`, `dashboard`, `offline`) e `buster: 'v2'` para descartar blobs antigos. PII, workflows voláteis e helpers sem escopo de cliente ficam fora da persistência. As queries de RPCs do Dashboard (`dashboard-last-checklists`, `dashboard-vehicle-km`) estão na allowlist com TTL de dashboard desde 2026-06-17. Settings de campos obrigatórios (`vehicleSettings`, `vehicleFieldSettings`, `driverSettings`, `driverFieldSettings`) ficam fora da persistência para evitar reidratação stale em reload após save.
- **Suíte E2E pós-otimização**: entregue cobertura de regressão para persistência sob reload, isolamento entre tenants Deluna/BetaFleet, limpeza de storage no logout, lazy loading de gráficos/PDF, route splitting/TTUC e Agendamentos. A bateria completa `npx playwright test` passou com 165/165 em 17/06/2026.
- **Protocolo de Performance**: disponível via `npm run perf`. Mede bundle (raw/gzip), cold start (shell + primeira tela útil), entrada por rota (6 rotas principais), contagem de requests e comportamento de voltar à página. Gera relatórios em `docs/reports/perf/` com diff contra baseline versionado e gate de regressão (tolerância 15%). Arquitetura: lógica pura em `src/lib/perfReport.ts`, scripts I/O em `scripts/`, spec Playwright isolada em `playwright.perf.config.ts`. O baseline vigente já reflete code splitting por rota, lazy loading de gráficos do Dashboard e carregamento sob demanda de `pdfjs-dist`.
- **Performance frontend**: o roteador central usa code splitting por rota. O antigo chunk único `index-*.js` de **~1,96 MB raw / ~520,7 KB gzip** foi quebrado em chunks sob demanda; depois, `pdfjs-dist` e os gráficos com `recharts` também passaram a carregar sob demanda. O maior chunk atual continua sendo `pdf.worker.min-*.mjs` com **~1,21 MB raw / ~358,7 KB gzip**; o Dashboard caiu de **421,6 KB raw / 118,8 KB gzip** para **~35 KB raw / ~9 KB gzip**. Resultado aceito: `totalJsGzip` agregado em **~923 KB**; regressões de perf em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs` foram aceitas pelo usuário em 17/06/2026 como oportunidades de melhoria futura, sem atualizar baseline.

## Tarefas em Andamento

1. **Performance pós-otimização**:
   - Investigar as regressões aceitas em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs`.
2. **Migração incremental para React Query**:
   - Restam páginas menores ainda usando estado local.
3. **Acessibilidade**:
   - Revisão pendente de `aria-labels` em modais e tabelas.

## Próximos Passos

1. Investigar regressões aceitas do `npm run perf`: entrada de Veículos, requests de Pneus e retorno para Veículos.
2. Avaliar notificações de vencimento (CRLV/CNH) via Edge Functions.
3. Considerar backfill futuro de `crlv_expiration_date` para veículos legados, se houver demanda.
4. Evoluir performance pós-lazy loading: avaliar `manualChunks` em `vite.config.ts`, cache/preload do `pdf.worker` e teste de render para `CostPanel`.

## Decisões Vigentes

- **Admin Master** com `currentClient = null` representa visão agregada cross-tenant onde o RLS já permite leitura.
- **CRLV** usa precedência **data real de vencimento → ano**; `crlv_year` é apenas fallback quando a data não existe.
- **Fila de Ação** pode exibir placas e nomes dentro do tenant. **Risco aceito** em 2026-06-13.
- **Cache operacional em repouso**: listas operacionais permitidas (`vehicles`, `shippers`, `operationalUnits`, `tires` e agregados de dashboard) podem residir no `localStorage` do usuário autenticado. Não incluem PII pesada e são limpas no logout, mas ficam em repouso sem criptografia. **Risco aceito** em 2026-06-16.
- **Settings fora do cache persistido**: configurações de campos obrigatórios de veículos e motoristas não entram no `betafleet-rq-cache`; reload da tela de Configurações deve buscar o banco para evitar corrida de persister com valor antigo.
- **Regressões de performance aceitas**: em 2026-06-17, o usuário aceitou seguir com regressões detectadas em `route.veiculos.entryMs`, `route.pneus.requestCount` e `returnBehavior.returnEntryMs` como oportunidades futuras. O baseline não foi atualizado nesta sessão.
- **Smoke oficial** do projeto é `npm run test:smoke`; em falha, a correção precede novas evoluções.
- **Convenção `bf:v1:ui`** para persistência de estado de UI implementada em `src/lib/uiStateStorage.ts` e `src/hooks/usePersistentUiState.ts`. Todos os módulos prioritários migrados. Dados sensíveis removidos do storage.
- **Busca textual persistida em Motoristas**: em 2026-06-19, o usuário decidiu manter `drivers:filter:search` em `sessionStorage` mesmo podendo conter nome/CPF. Justificativa: preservar a UX atual e limitar o escopo desta sessão aos filtros estruturados, que seguem apenas na URL. **Risco aceito**.

## Referência Histórica

- Todo o histórico anterior deste arquivo foi arquivado em `docs/MEMORY-HISTORY.md`, sob `## Arquivamento — 2026-06-14`.
