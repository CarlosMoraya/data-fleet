# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.
Histórico detalhado de sessões anteriores: `docs/MEMORY-HISTORY.md`.

## Estado Atual

- **Chip global de previsão do tempo na Topbar — implementado em 2026-07-31**: usa Open-Meteo sem API key; dados e coordenadas não são persistidos; o consentimento ocorre pelo prompt nativo do navegador; Driver tem fallback por cidade/UF da unidade operacional do veículo titular; a severidade é derivada da previsão e não representa alerta meteorológico oficial.
- **Chamados/S.O.S. — ajustes de criticidade, Km, foto e numeração** (2026-07-30/31) — migration `20260730000000_fleet_tickets_evolution.sql` **aplicada e validada em DEV e PROD** (`vvbnbzzhpiksacqudmfu` e `oajfjdadcicgoxrfrnny`, autorização expressa do usuário); Edge Function `notify-fleet-ticket-telegram` **deployada em DEV e PROD** e testada com mensagem real trazendo número/Km/snapshots. `npx tsc`/`lint`/`test:unit` (1327/1327)/`test:smoke` (6/6) passando; validação manual guiada dos 10 passos confirmada pelo usuário; teste `curl` de permissão confirmado (Operations Manager bloqueado, Fleet Assistant permitido, alteração real revertível se necessário no chamado `CH-2607-2978`). **Correções pós-implementação**: (1) chamados encerrados ficam somente-leitura também no bloco "Assumir atendimento"/"Alterar status"; (2) histórico mostra para qual status o chamado foi alterado; (3) notas de resolução aparecem no modal quando o chamado é concluído. Detalhes: docs/MEMORY-HISTORY.md § Arquivamento 2026-07-30 e § Sessão 2026-07-30.
- Módulos estabilizados em produção: Cadastros (Veículos, Motoristas, Embarcadores, Unidades Operacionais), Manutenção (OS, cancelamento, aprovação de orçamento, OCR, filtros, cards-toggle), Checklists (offline-first, templates versionados, Atualização de Hodômetro, correção auditável de KM), Pneus, Revisões de Garantia, Oficinas (multi-parceria), Controle de Carretas (Engate/Desengate + Km da Carreta), Dashboard Executivo (5 abas), Self-service de senha, Financeiro (orçamento → pagamento, parcelas, aprovação, NF/Fatura, auditoria de nomes).
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

0c. **Recadastrar Yard Auditor e Driver de teste** para viabilizar `e2e/pending/handover-checklist.spec.ts` (contextos Entrega/Devolução, 2026-07-19) e `e2e/pending/driver-vehicle-choice.spec.ts` (divergência de vínculo, 2026-07-20) — atualizar `.env.local` e mover os specs para `e2e/completed/` após rodar.
0b. **Aplicar `20260714000000_add_budget_rejection_reason_to_maintenance_orders.sql` no Supabase DEV** (filtro de orçamento + motivo de reprovação + export XLSX, 2026-07-14) — validar por SQL (coluna existe em `maintenance_orders`) e só então promover a PROD com autorização expressa. Validar manualmente: filtro "Status do Orçamento" na Manutenção; reprovar orçamento exige motivo; "Baixar XLSX" em Pagamentos e Pagamentos Extras; Centro de Custo em Pagamento Extra aparece no export.
0a. **Executar `npm run test:smoke` (6/6 esperado)** para validar a rosca de disponibilidade da Visão Geral (2026-07-13) antes de considerar a feature concluída — requer app no ar + `.env.local` válido, não executado durante a implementação.
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
12. Endurecer `escapeCsv` (`spreadsheetPaymentProvider.ts`) contra CSV formula injection (prefixo `'` para células iniciadas em `= + - @`) — débito pré-existente, não introduzido pela sessão de 2026-07-14, afeta todos os exports CSV.

## Decisões Vigentes

- **Admin Master** com `currentClient = null` representa visão agregada cross-tenant onde o RLS já permite leitura.
- **CRLV** usa precedência **data real de vencimento → ano**; `crlv_year` é apenas fallback quando a data não existe.
- **Escopo temporal do Dashboard**: `Visão Geral`, `Operação` e `Conformidade` são situação atual; somente `Custos` obedece ao filtro de período.
- **KM por veículo (Custo por KM)**: `MAX(effective_km) − MIN(effective_km)` no período, sobre a view auditável `vehicle_odometer_effective_readings`. Regra de enforcement: `HAVING COUNT >= 2 AND (MAX−MIN) > 0`.
- **Conformidade documental**: `Itens Críticos = Documentos Vencidos + Documentos Ausentes`; taxa usa `(veículos + motoristas regulares) / (veículos + motoristas totais)`, retorno `100` quando não há entidades.
- **Cache**: política central em `src/lib/cachePolicy.ts` (allowlist default-deny, TTL por tipo, `buster: 'v4'`). Settings de campos obrigatórios ficam fora da persistência. Queries que retornam `Set`/estruturas não serializáveis nunca entram na allowlist.
- **Riscos aceitos**: dados de busca textual na URL (2026-06-19); cache operacional em `localStorage` sem criptografia (2026-06-16); bucket `vehicle-documents` com leitura pública para fotos de peças/documentos (2026-06-25); envio de NF/Fatura ao Gemini para OCR best-effort (2026-07-10); Fila de Ação exibe placas/nomes dentro do tenant (2026-06-13); arquivos órfãos no bucket `financial-documents` ao trocar/remover boleto único ou documentos (2026-07-19); Driver pode iniciar checklist/inspeção de pneus em veículo que não é o seu quando `enforce_driver_vehicle_link = false` (padrão) — comportamento pedido pelo usuário, mitigado por registro inviolável no banco + visibilidade ao Fleet Assistant+ + interruptor de bloqueio por tenant (2026-07-20).
- **Risco aceito — contrato PJ (2026-07-20)**: o contrato usa o bucket público `driver-documents` e pode ser acessado por quem possuir a URL, conforme decisão expressa do usuário; não foi usado o bucket privado `financial-documents` nem URL assinada.
- **Risco aceito — self-service de cadastro de oficina (2026-07-27)**: sem rate limiting no update de `workshop_accounts` pela própria oficina; mitigado por RLS restrita a `profile_id = auth.uid()` e auditoria append-only de troca de nome.
- **Risco aceito — foto ao vivo em Chamados/S.O.S. (2026-07-30)**: obrigatoriedade de `requireLiveCapture` é imposta só na UI; usuário tecnicamente avançado pode contornar enviando arquivo da galeria — mesmo risco já aceito em 2026-07-19 para Entrega/Devolução.
- **Risco aceito — dados do veículo no Telegram de Chamados (2026-07-30)**: a mensagem passa a incluir modelo, proprietário, embarcador, base e Km do veículo; autorizado expressamente pelo usuário.
- **Smoke oficial** do projeto é `npm run test:smoke`; em falha, a correção precede novas evoluções.
- **Convenção `bf:v1:ui`** para persistência de estado de UI (`src/lib/uiStateStorage.ts`, `src/hooks/usePersistentUiState.ts`).
- **`supabase_migrations.schema_migrations` está vazia nos dois bancos** porque as migrations são aplicadas via SQL Editor, não via `supabase db push`. Nunca inferir estado de banco a partir dessa tabela — usar os diagnósticos de `supabase/diagnostics/`.
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
- Arquivamentos anteriores: `## Arquivamento — 2026-06-14`, `## Arquivamento — 2026-06-19`, `## Arquivamento — 2026-07-12 (pré Pagamentos Extras)`, `## Arquivamento — 2026-07-30`.
