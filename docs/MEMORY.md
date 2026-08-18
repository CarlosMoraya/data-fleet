# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.
Histórico detalhado de sessões anteriores: `docs/MEMORY-HISTORY.md`.

## Estado Atual

- **Segurança V-01/V-06 — validado em DEV, PROD pendente (2026-08-12)**: buckets `vehicle-documents` e `driver-documents` privados com URL assinada (`getPrivateDocumentSignedUrl`, `extractStoragePath` para compatibilidade) e Edge Function `gemini-ocr` com cota atômica e validação server-side. Migrations criadas e aplicadas em DEV; **PROD segue intocado**. Pré-checagem de perfis sem tenant concluída (só `Workshop` e `Admin Master`) — promover a PROD com autorização expressa.
- **Plano de Ação a partir de Chamado (2026-08-07)**: implementado; migration `20260807020000_action_plan_from_fleet_ticket.sql` **criada e NÃO aplicada** (ver Pendências).
- **Filtros multisseleção em Cadastros (2026-08-17)**: ver seção dedicada.
- Módulos estabilizados em produção: Cadastros, Manutenção, Checklists (offline-first), Pneus, Revisões de Garantia, Oficinas, Controle de Carretas, Dashboard Executivo, Self-service de senha, Financeiro.
- Fonte única de KM efetivo: funções `SECURITY DEFINER` (`get_vehicle_odometer_readings*`, `get_vehicle_odometer_summary`) com fallback para `vehicles.initial_km`. Não usar `checklists.odometer_km` para cálculos agregados.
- Papéis ativos: Admin Master (cross-tenant, `client_id = NULL`), Director, Manager, Coordinator, Supervisor, Fleet Analyst, Fleet Assistant, Driver, Yard Auditor, Operations Manager, Coupling Agent, Workshop, Financeiro.
- Bancos Supabase **separados** por ambiente: Dev `vvbnbzzhpiksacqudmfu`, Prod `oajfjdadcicgoxrfrnny`. Migrations validadas em Dev antes de Prod, só com autorização expressa.
- Performance: code splitting ativo; `npm run perf` mede regressão (tolerância 15%). Regressões aceitas (`route.veiculos.entryMs`, `route.pneus.requestCount`, `returnBehavior.returnEntryMs`) seguem como oportunidade futura.

## Filtros multisseleção em Cadastros (2026-08-17)

Todos os filtros suspensos de listagem de Veículos e Motoristas viraram multisseleção em checkbox (`MultiSelectDropdown`, compatível com o consumo `string[]` de Manutenção). Semântica: **OR dentro da dimensão e AND entre dimensões** (incluindo busca `q`). Persistência por parâmetros canônicos repetidos na URL (`shipper`, `unit`, `issue`, `lastRoute`, `availability`), com retrocompat para links singulares e aliases legados. Veículos: Embarcador, Unidade Operacional, Pendência, Disponibilidade e Última rota (só Deluna). Motoristas: Embarcador, Base/Unidade Operacional e Situação. Disponibilidade reutiliza `computeUnavailableVehicleIds` (indisponível = ordem de manutenção fora de estado final; em erro o filtro não é aplicado). Contratos em `docs/SPEC.md` e `agent/AGENT-FRONTEND.md`. Resultado: 1.776 testes unitários, smoke 7/7, E2E dirigidos 20/20, E2E de navegação cruzada 8/8.

## Pendências

- **Aplicar V-01/V-06 em PROD** (autorização expressa).
- **Migration `20260807020000_action_plan_from_fleet_ticket.sql` NÃO aplicada** em nenhum banco; aplicar em DEV primeiro (rollback em `supabase/migrations/rollback/`). Validação manual de 14 passos bloqueada até lá.
- **Financeiro → PROD (autorização expressa)**: `20260803000000_add_budget_discounts.sql` (confirmar 2 TRIGGERs de exclusividade), `20260710000000_add_invoice_number_to_payment_installments.sql`, `20260723000000_add_nota_fiscal_url_2.sql` + `20260723000100_...`. Validação manual guiada do fluxo completo pendente.
- **Aplicar `20260714000000_add_budget_rejection_reason_to_maintenance_orders.sql`** em DEV (filtro de orçamento + motivo de reprovação + XLSX), validar por SQL e promover.
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
- **Permissão de UI espelhando RLS por allowlist literal**, não rank (ler o SQL da policy em `supabase/migrations/`).
- **Auth por ambiente**: Site URL/Redirect de PROD → `https://app.betafleet.com.br`; DEV → `http://localhost:3000`.
- **Convenção `bf:v1:ui`** para persistência de estado de UI.
- **`supabase_migrations.schema_migrations` vazia** — migrations aplicadas via SQL Editor; usar `supabase/diagnostics/`.
- **TESTES_HUMANOS.md** não é versionável.
- **Riscos aceitos** (detalhados em `docs/MEMORY-HISTORY.md`): busca textual na URL; cache em `localStorage`; envio de NF/Fatura ao Gemini; arquivos órfãos em `financial-documents`; arquivos de negócio em `public/downloads` (V-05); self-service de oficina sem rate limit; foto ao vivo de chamados só na UI; dados do veículo no Telegram; sem auditoria de desconto; trava pós-aprovação do desconto só na UI; LGPD do nome do aprovador no histórico/XLSX.

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
