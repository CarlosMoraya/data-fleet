# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.
Histórico detalhado de sessões anteriores: `docs/MEMORY-HISTORY.md`.

## Estado Atual

- Módulos estabilizados em produção: Cadastros (Veículos, Motoristas, Embarcadores, Unidades Operacionais), Manutenção (OS, cancelamento, aprovação de orçamento, OCR, filtros, cards-toggle), Checklists (offline-first, templates versionados, Atualização de Hodômetro, correção auditável de KM), Pneus, Revisões de Garantia, Oficinas (multi-parceria), Controle de Carretas (Engate/Desengate + Km da Carreta), Dashboard Executivo (5 abas), Self-service de senha, Financeiro (orçamento → pagamento, parcelas, aprovação, NF/Fatura, auditoria de nomes).
- **Dashboard → Visão Geral — rosca de disponibilidade + reorganização do "Mapa da Frota" (implementado em 2026-07-13, ajustado em 2026-07-13)**: gráfico `FleetAvailabilityDonutChart` (Disponíveis × Indisponíveis) participa do mesmo sistema de filtros client-side da aba, como dimensão fora de `OVERVIEW_DIMENSIONS` (composição separada via helpers em `overviewFleetFilters.ts`: `computeUnavailableVehicleIds`, `applyAvailabilityFilter`, `toggleAvailabilityValue`, `buildAvailabilityChartData`). `OverviewPanel.tsx` deriva os 8 cards KPI de `finalVehicles` (após o passo extra de disponibilidade). **Ajuste desta sessão**: (1) `unavailableIds` passou a ser calculado uma única vez sobre TODOS os veículos (`vehicles`), não mais sobre o subconjunto já filtrado por atributo — evita recomputar por dimensão e mantém a condição "está indisponível" estável independente do filtro ativo; (2) `chartDataByDimension` (que alimenta TODOS os `VehicleTypeBarChart`) agora também passa pelo `applyAvailabilityFilter` além do `filtersExcept` por dimensão — antes, clicar na rosca só refiltrava os cards KPI, deixando os gráficos de barra (Categoria, Tipo, Modelo, Aquisição, Embarcador, Unidade Operacional) alheios à seleção de disponibilidade; agora todo o painel reage de forma consistente. Layout do "Mapa da Frota": linha 1 = rosca + Frota por Embarcador; linha 2 = Frota por Unidade Operacional em largura total; linha 3 = Categoria/Tipo/Modelo/Aquisição. 100% client-side, sem alteração de query/RLS/migration. `npm run test:unit` **953/953** (930 base + 23 novos); `npm run lint` **0 erros / 153 warnings**. `npm run test:smoke` **não executado nesta sessão** — pendente validação do usuário antes de dar a feature como concluída.
- **Financeiro — Pagamentos Extras / Serviços Avulsos (implementado em 2026-07-12, migration NÃO aplicada em nenhum banco ainda)**: novo domínio para despesas operacionais sem vínculo obrigatório com OS (guincho, chaveiro, borracheiro, Uber/táxi, frete de apoio). Nova tabela `extra_payment_requests` (cabeçalho) + generalização de `payment_installments` por `source_type` (`maintenance_order`|`extra_payment`), sem criar segunda tabela de parcelas. `Fleet Assistant+` lança (parcela única ou lote, Pix/boleto); `Coordinator+` aprova/reprova em aba própria (`Aprovação de Extras`); `Financeiro` só vê extras aprovados/pagos, baixa CSV e marca como pago, com auditoria completa via RPC `get_extra_payment_auditors`. Novos arquivos: migration `20260712000000_create_extra_payment_requests.sql`, `src/types/serviceExpense.ts`, `src/lib/serviceExpenseMappers.ts`, `src/lib/serviceExpenseFilters.ts`, `src/services/serviceExpenseService.ts`, `src/components/financeiro/ExtraPaymentFormModal.tsx`, `ExtraPaymentsTab.tsx`, `ExtraPaymentViewModal.tsx`, `ExtraPaymentApprovalsTab.tsx`. Estendidos: `payment.ts`, `paymentMappers.ts`, `paymentInstallmentService.ts`, `rolePermissions.ts`, `PaymentsTab.tsx` (filtro/coluna de origem), `PaymentInstallmentViewModal.tsx` (bloco Origem), `spreadsheetPaymentProvider.ts` (CSV usa fornecedor/documento/categoria do extra), `paymentPendingDocs.ts`, `Financeiro.tsx` (2 abas novas). Validação local: `npm run test:unit` **930/930** (883 base + 47 novos); `npx tsc --noEmit` 0 erros; `npm run lint` **0 erros / 147 warnings** (baseline 137 + 10 novos — 3 são o padrão já tolerado de `no-unsafe-assignment`/`no-unsafe-member-access` ao desestruturar retorno de RPC em `serviceExpenseService.ts`, mesmo padrão usado em `paymentInstallmentService.ts`; os demais são pré-existentes de arquivos não tocados por esta sessão); `npm run test:smoke` **6/6**. E2E novo `e2e/pending/extra-payments-flow.spec.ts` (8 cenários, listagem `--list` sem erro de sintaxe). **Pendências obrigatórias antes de considerar a feature pronta para uso**: (1) aplicar a migration `20260712000000_create_extra_payment_requests.sql` no Supabase **DEV** — não foi aplicada nesta sessão porque o CLI do Supabase local estava vinculado ao projeto de **PROD** (`oajfjdadcicgoxrfrnny`/data-fleet) no momento da implementação, e rodar qualquer comando de banco nesse estado seria arriscado sem confirmação explícita do usuário; (2) validar por SQL em DEV (tabela existe, RLS ativo, colunas de origem em `payment_installments`); (3) só então promover a PROD com autorização expressa; (4) executar a validação manual guiada do fluxo completo (Etapa 11 do `IMPLEMENTATION.md` desta sessão).
- Fonte única de KM efetivo: funções `SECURITY DEFINER` (`get_vehicle_odometer_readings*`, `get_vehicle_odometer_summary`) com fallback para `vehicles.initial_km` quando não há checklist. Não usar `checklists.odometer_km` diretamente para cálculos agregados.
- Papéis ativos: Admin Master (cross-tenant, `client_id = NULL`), Director, Manager, Coordinator, Supervisor, Fleet Analyst, Fleet Assistant, Driver, Yard Auditor, Operations Manager, Coupling Agent, Workshop, Financeiro.
- Bancos Supabase **separados** por ambiente: Dev `vvbnbzzhpiksacqudmfu`, Prod `oajfjdadcicgoxrfrnny` (ver `feedback_...` / `project_shared_supabase_dev_prod` na memória do agente). Migrations sempre validadas em Dev antes de promover a Prod, só com autorização expressa.
- Performance: code splitting por rota ativo; bundle único de ~1,96 MB raw foi eliminado; `npm run perf` mede regressão vs baseline (tolerância 15%). Regressões aceitas em 2026-06-17 (`route.veiculos.entryMs`, `route.pneus.requestCount`, `returnBehavior.returnEntryMs`) permanecem como oportunidade futura, sem correção agendada.

## Pendências do Módulo Financeiro (migrations aplicadas em DEV, aguardando validação/promoção a PROD)

Aplicar em PROD somente com autorização expressa do usuário, sempre após validar por SQL/manualmente em DEV:

1. `20260710000000_add_invoice_number_to_payment_installments.sql` — aplicada em DEV; falta testar OCR real de NF/Fatura e promover a PROD.
2. `20260723000000_add_nota_fiscal_url_2.sql` e `20260723000100_payment_installments_budget_cap_and_edit_lock.sql` — aplicadas em DEV; falta validar teto de orçamento/edição bloqueada por SQL e promover a PROD.
3. `20260725000000_backfill_approved_cost_from_budget_items.sql` — já aplicada em DEV e PROD.
4. Validação manual guiada do fluxo completo de Financeiro (orçamento → parcela → aprovação → pagamento → NF) ainda pendente de aprovação final do usuário.

## Tarefas em Andamento / Próximos Passos

0a. **Executar `npm run test:smoke` (6/6 esperado)** para validar a rosca de disponibilidade da Visão Geral (2026-07-13) antes de considerar a feature concluída — requer app no ar + `.env.local` válido, não executado durante a implementação.
0. **Aplicar `20260712000000_create_extra_payment_requests.sql` no Supabase DEV** (Pagamentos Extras, 2026-07-12) — validar por SQL (tabela, RLS, colunas de origem em `payment_installments`) e só então promover a PROD com autorização expressa. Depois, rodar a validação manual guiada do fluxo completo.
1. Promover migrations do Financeiro listadas acima a PROD (gated, autorização expressa por migration).
2. Investigar regressões de performance aceitas (`route.veiculos.entryMs`, `route.pneus.requestCount`, `returnBehavior.returnEntryMs`).
3. Migração incremental de páginas menores para React Query (estado local remanescente).
4. Acessibilidade: violações reais de `color-contrast` (serious) e `select-name` (critical) detectadas por `a11y-core-screens.spec.ts` em Login/Dashboard/Checklists/Cadastros — não corrigidas, aguardando sessão dedicada de UI. Relatório em `.claude/reports/a11y-core-screens-report.md`.
5. Unificar estilo de RLS entre DEV (funções helper `is_admin_master()`/`get_my_client_id()`/`get_my_role()`) e PROD (subqueries inline) — comportamento idêntico, manutenção mais difícil.
6. SMTP customizado + templates de Auth em PT-BR (backlog, não iniciado).
7. Corrigir `scripts/apply-migration.mjs` para lidar com comentários contendo `;` e corpos de função `$$...$$` sem quebrar o split por statement.
8. Investigar 4 specs E2E de Revisão de Garantia falhando pré-existentemente (`by-plate`, `by-model`, `first-km-mirror`, `os-link`) — não relacionados a mudanças recentes.
9. Corrigir bug pré-existente de `selectOption({ label: RegExp })` em `e2e/pending/financeiro-payment-flow.spec.ts` (incompatível com versão atual do Playwright).
10. RPC fantasma `get_vehicle_last_odometer_reading_at` (chamada em `ChecklistFill.tsx:158`) sem migration correspondente — está em allowlist de exceção de `src/lib/rpcContract.test.ts`; criar a migration e remover a exceção.
11. [Oportunidades Futuras (Fase 4)](docs/OPORTUNIDADES_FUTURAS.md) — composições (bitrem/rodotrem), PBTC combinado + alerta CMT×PBT, CRLV vencido do terceiro, QR sem conta. Sem implementação.

## Decisões Vigentes

- **Admin Master** com `currentClient = null` representa visão agregada cross-tenant onde o RLS já permite leitura.
- **CRLV** usa precedência **data real de vencimento → ano**; `crlv_year` é apenas fallback quando a data não existe.
- **Escopo temporal do Dashboard**: `Visão Geral`, `Operação` e `Conformidade` são situação atual; somente `Custos` obedece ao filtro de período.
- **KM por veículo (Custo por KM)**: `MAX(effective_km) − MIN(effective_km)` no período, sobre a view auditável `vehicle_odometer_effective_readings`. Regra de enforcement: `HAVING COUNT >= 2 AND (MAX−MIN) > 0`.
- **Conformidade documental**: `Itens Críticos = Documentos Vencidos + Documentos Ausentes`; taxa usa `(veículos + motoristas regulares) / (veículos + motoristas totais)`, retorno `100` quando não há entidades.
- **Cache**: política central em `src/lib/cachePolicy.ts` (allowlist default-deny, TTL por tipo, `buster: 'v3'`). Settings de campos obrigatórios ficam fora da persistência. Queries que retornam `Set`/estruturas não serializáveis nunca entram na allowlist.
- **Riscos aceitos**: dados de busca textual na URL (2026-06-19); cache operacional em `localStorage` sem criptografia (2026-06-16); bucket `vehicle-documents` com leitura pública para fotos de peças/documentos (2026-06-25); envio de NF/Fatura ao Gemini para OCR best-effort (2026-07-10); Fila de Ação exibe placas/nomes dentro do tenant (2026-06-13).
- **Smoke oficial** do projeto é `npm run test:smoke`; em falha, a correção precede novas evoluções.
- **Convenção `bf:v1:ui`** para persistência de estado de UI (`src/lib/uiStateStorage.ts`, `src/hooks/usePersistentUiState.ts`).
- **TESTES_HUMANOS.md**: checklist manual do usuário; não é artefato versionável e não deve ser commitado.

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

- Histórico completo de sessões, bugs corrigidos e decisões arquivadas: `docs/MEMORY-HISTORY.md`.
- Arquivamentos anteriores: `## Arquivamento — 2026-06-14`, `## Arquivamento — 2026-06-19`, `## Arquivamento — 2026-07-12 (pré Pagamentos Extras)`.
