# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.
Histórico detalhado de sessões anteriores: `docs/MEMORY-HISTORY.md`.

## Estado Atual

- **Checklists — percentual por grupo, identificação operacional e XLSX implementados; validação manual pendente (2026-08-20)**: o gráfico de Aderência mostra o percentual por embarcador e unidade sem alterar o Dashboard; a listagem mostra embarcador/unidade dentro da coluna Veículo; e `Baixar XLSX` respeita os filtros visíveis e gera as abas `Checklists` e `Inconformidades`. A suíte final passou com 1.898 testes unitários e smoke 7/7.
- **Sub-aba "Aderência" em Checklists — implementada, validação manual pendente (2026-08-19)**: visão Fleet Assistant+ com três cards de conformidade por contexto (Rotina, Segurança, Auditoria), gráfico com drill-down embarcador → unidade operacional e tabela dos veículos vencidos como fila de ação. `computeOverdueChecklistVehicleIds` virou wrapper de `computeOverdueChecklistVehicleIdsByContext`; **`Auditoria` nunca entra no agregado do Dashboard nem no filtro `checklist_overdue` de Veículos** (requisito, não inconsistência). Regra oficial documentada em `docs/SPEC.md`. `checklist_day_intervals.auditoria_day_interval` existe em DEV e PROD, e `dashboard_last_checklist_per_vehicle` devolve o contexto `Auditoria` nos dois ambientes; a validação manual de 12 passos está desbloqueada.
- **Checklists de Auditoria para Gestor de Operações — validado em DEV e PROD (2026-08-18)**: o papel escolhe livremente qualquer veículo dos escopos atribuídos, inicia apenas contexto `Auditoria` e consulta auditorias de terceiros nesses veículos. A migration `20260818000000_allow_operations_manager_audit_checklist.sql` foi aplicada em DEV e PROD pelo usuário; o diagnóstico em DEV confirmou 9 policies, 7/36 veículos alcançáveis em cada perfil avaliado, igualdade com os escopos e 0 contextos fora de Auditoria, e o usuário aprovou os testes em PROD.
- **Segurança V-01/V-06 — validado em DEV, PROD pendente (2026-08-12)**: buckets `vehicle-documents` e `driver-documents` privados com URL assinada (`getPrivateDocumentSignedUrl`, `extractStoragePath` para compatibilidade) e Edge Function `gemini-ocr` com cota atômica e validação server-side. Migrations criadas e aplicadas em DEV; **PROD segue intocado**. Pré-checagem de perfis sem tenant concluída (só `Workshop` e `Admin Master`) — promover a PROD com autorização expressa.
- **Plano de Ação a partir de Chamado (2026-08-07)**: implementado; migration `20260807020000_action_plan_from_fleet_ticket.sql` **criada e NÃO aplicada** (ver Pendências).
- **Carimbo de plano de ação e tratamento por chamado em Checklists (2026-08-19)**: implementação criada com estado derivado dos planos, sinalização em `checklist_ticket_treatments`, exclusão mútua por trigger nos dois sentidos e filtro persistente por situação. Em 2026-08-20, o usuário confirmou a migration `20260819100000_create_checklist_ticket_treatments.sql` e as alterações em PROD; o diagnóstico estrutural retornou 11/11 objetos com status `OK` (tabela, RLS, índices, policies, funções e triggers). A validação funcional manual permanece pendente.
- **Filtros multisseleção em Cadastros (2026-08-17)**: entregue e estável; detalhe completo arquivado em `docs/MEMORY-HISTORY.md` (`## Arquivamento — 2026-08-19`).
- Módulos estabilizados em produção: Cadastros, Manutenção, Checklists (offline-first), Pneus, Revisões de Garantia, Oficinas, Controle de Carretas, Dashboard Executivo, Self-service de senha, Financeiro.
- Fonte única de KM efetivo: funções `SECURITY DEFINER` (`get_vehicle_odometer_readings*`, `get_vehicle_odometer_summary`) com fallback para `vehicles.initial_km`. Não usar `checklists.odometer_km` para cálculos agregados.
- Papéis ativos: Admin Master (cross-tenant, `client_id = NULL`), Director, Manager, Coordinator, Supervisor, Fleet Analyst, Fleet Assistant, Driver, Yard Auditor, Operations Manager, Coupling Agent, Workshop, Financeiro.
- Bancos Supabase **separados** por ambiente: Dev `vvbnbzzhpiksacqudmfu`, Prod `oajfjdadcicgoxrfrnny`. Migrations validadas em Dev antes de Prod, só com autorização expressa.
- Performance: code splitting ativo; `npm run perf` mede regressão (tolerância 15%). Regressões aceitas (`route.veiculos.entryMs`, `route.pneus.requestCount`, `returnBehavior.returnEntryMs`) seguem como oportunidade futura.

## Pendências

- **Validação manual da entrega de Checklists de 2026-08-20**: conferir percentuais nos dois níveis do drill-down, Dashboard sem sub-rótulos, embarcador/unidade na coluna Veículo e as duas abas do XLSX, inclusive filtro "Com inconformidades" e ausência de links de CNH, assinatura e hodômetro.
- **Fechar o bucket `checklist-photos` — prioridade alta, sessão dedicada**: o bucket público contém fotos operacionais, CNH e assinaturas. A exportação nova consulta somente fotos de respostas com inconformidade, mas o fechamento do bucket, a migração dos links e a adoção de URLs assinadas permanecem fora desta sessão.
- **Validação manual da sub-aba Aderência**: executar os 12 passos já desbloqueados; `auditoria_day_interval` e o contexto `Auditoria` da RPC foram confirmados em DEV e PROD.
- **E2E de placas do Gestor de Operações**: a comparação explícita permanece bloqueada até configurar `TEST_GESTOROP_EXPECTED_VEHICLE_PLATES`; os outros três cenários do fluxo novo foram validados em DEV e os testes em PROD foram aprovados pelo usuário.
- **Aplicar V-01/V-06 em PROD** (autorização expressa).
- **Migration `20260807020000_action_plan_from_fleet_ticket.sql` NÃO aplicada** em nenhum banco; aplicar em DEV primeiro (rollback em `supabase/migrations/rollback/`). Validação manual de 14 passos bloqueada até lá.
- **Financeiro → PROD (autorização expressa)**: `20260803000000_add_budget_discounts.sql` (confirmar 2 TRIGGERs de exclusividade), `20260710000000_add_invoice_number_to_payment_installments.sql`, `20260723000000_add_nota_fiscal_url_2.sql` + `20260723000100_...`. Validação manual guiada do fluxo completo pendente.
- **Aplicar `20260714000000_add_budget_rejection_reason_to_maintenance_orders.sql`** em DEV (filtro de orçamento + motivo de reprovação + XLSX), validar por SQL e promover.
- **Validação manual do carimbo e tratamento por chamado**: executar os 12 passos funcionais; a migration e seus 11 objetos estruturais já foram confirmados em PROD.
- **Recadastrar Yard Auditor e Driver de teste** para `e2e/pending/handover-checklist.spec.ts` e `driver-vehicle-choice.spec.ts`; atualizar `.env.local` e mover specs para `completed/`.

## Próximos Passos

- Investigar regressões de performance aceitas.
- Migração incremental de páginas menores para React Query.
- Acessibilidade: violações de `color-contrast`/`select-name` (relatório em `.claude/reports/a11y-core-screens-report.md`).
- Unificar estilo de RLS entre DEV e PROD (helpers vs subqueries inline).
- SMTP customizado + templates de Auth PT-BR.
- Corrigir `scripts/apply-migration.mjs` (split por `;` e `$$...$$`).
- Investigar 4 specs E2E de Revisão de Garantia falhando pré-existentemente.
- RPC fantasma `get_vehicle_last_odometer_reading_at` — criar migration e remover exceção.
- Endurecer `escapeCsv` contra CSV formula injection.
- [Oportunidades Futuras](docs/OPORTUNIDADES_FUTURAS.md).

## Decisões Vigentes

- **Admin Master** com `currentClient = null` = visão cross-tenant; RLS já permite leitura.
- **CRLV**: precedência data real de vencimento → ano (`crlv_year` é fallback).
- **Escopo temporal do Dashboard**: `Visão Geral`/`Operação`/`Conformidade` são situação atual; só `Custos` obedece ao período.
- **KM por veículo**: `MAX(effective_km) − MIN(effective_km)` sobre `vehicle_odometer_effective_readings`, com `HAVING COUNT >= 2 AND (MAX−MIN) > 0`.
- **Conformidade documental**: Itens Críticos = Documentos Vencidos + Ausentes.
- **Cache**: política central em `src/lib/cachePolicy.ts` (allowlist default-deny, TTL, `buster: 'v4'`).
- **Storage de documentos (V-01)**: buckets privados; banco guarda caminho, leitura gera URL assinada de 3600s. `checklist-photos` permanece público (fora do escopo).
- **OCR Gemini (V-06)**: autorizado com limites server-side (10 MB, MIME+assinatura, 20 chamadas/h, 100 MB/h).
- **Conformidade de checklist**: fonte única é a RPC `dashboard_last_checklist_per_vehicle` (`SECURITY INVOKER`), que desde 2026-08-19 devolve `Rotina`, `Segurança` e `Auditoria`. O agregado do Dashboard e o filtro de Veículos usam **apenas** Rotina ∪ Segurança; a sub-aba Aderência usa os contextos individualmente. Regra em `computeOverdueChecklistVehicleIdsByContext` (`src/lib/dashboardKpi.ts`).
- **Exportação de checklists**: um XLSX com as abas `Checklists` e `Inconformidades`, derivado da mesma lista filtrada da tela. Somente fotos de resposta com `status = 'issue'` entram; `cnh_photo_url`, `signature_url` e `odometer_photo_url` são proibidos.
- **Carimbo de plano de ação no checklist**: estado derivado, nunca persistido. Prioridade: tratado por chamado > em andamento > concluído > sem carimbo. Todos os planos `cancelled` equivalem a sem plano. Regra em `src/lib/checklistActionPlanStamp.ts`.
- **Sinalização "tratado por chamado"** vive em `checklist_ticket_treatments`, nunca em `checklists` — a policy `checklists_update` restringe a edição ao preenchedor com status `in_progress`, e abrir isso permitiria alterar checklist concluído.
- **Permissão de UI espelhando RLS por allowlist literal**, não rank (ler o SQL da policy em `supabase/migrations/`).
- **Auth por ambiente**: Site URL/Redirect de PROD → `https://app.betafleet.com.br`; DEV → `http://localhost:3000`.
- **Convenção `bf:v1:ui`** para persistência de estado de UI.
- **`supabase_migrations.schema_migrations` vazia** — migrations aplicadas via SQL Editor; usar `supabase/diagnostics/`.
- **TESTES_HUMANOS.md** não é versionável.
- **Riscos aceitos** (detalhados em `docs/MEMORY-HISTORY.md`): busca textual na URL; cache em `localStorage`; envio de NF/Fatura ao Gemini; arquivos órfãos em `financial-documents`; arquivos de negócio em `public/downloads` (V-05); self-service de oficina sem rate limit; foto ao vivo de chamados só na UI; dados do veículo no Telegram; sem auditoria de desconto; trava pós-aprovação do desconto só na UI; LGPD do nome do aprovador no histórico/XLSX; nome do motorista na tabela da sub-aba Aderência (2026-08-19 — dado operacional já exposto às mesmas funções em Veículos e no Dashboard, sem ampliar a superfície); histórico de desmarcação de tratamento por chamado (2026-08-19 — o `DELETE` apaga a autoria anterior; volume esperado baixo, marcação sem alteração de dado operacional e tabela histórica desproporcional ao ganho); link público da foto de inconformidade no XLSX (2026-08-20 — amplia a distribuição da evidência já pública, aceito em troca de apoiar a fila de tratativas; CNH, assinatura e hodômetro permanecem barrados).

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

## Observações

- **Sem testes de renderização de componente React** em todo o projeto (Testing Library não está instalada; os testes de componente existentes usam `react-dom/client` direto). `ChecklistAdherencePanel` depende inteiramente da validação manual. Avaliar `@testing-library/react` numa sessão dedicada.
- **`showsAggregatedData` retorna `true` para Admin Master sem cliente selecionado** (`src/lib/clientScope.ts`). O `IMPLEMENTATION.md` desta sessão afirmava que o `enabled` das queries da sub-aba impediria o disparo nesse caso — não impede. O `SelectClientNotice` já cobre a UX e o RLS cobre o dado; registrado como observação, não corrigido (fora do escopo autorizado da sessão).

## Referência Histórica

- Histórico completo de sessões, bugs corrigidos e decisões arquivadas: `docs/MEMORY-HISTORY.md`.
- Arquivamentos anteriores: `## Arquivamento — 2026-08-19`, `## Arquivamento — 2026-06-14`, `## Arquivamento — 2026-06-19`, `## Arquivamento — 2026-07-12 (pré Pagamentos Extras)`, `## Arquivamento — 2026-07-30`.
