# MEMORY-HISTORY - Registro Histórico e Decisões

Este documento preserva o histórico de evolução do projeto **βetaFleet** e as principais decisões de arquitetura tomadas ao longo do tempo.

## 📜 Histórico de Sessões e Mudanças

### Junho 2026
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
