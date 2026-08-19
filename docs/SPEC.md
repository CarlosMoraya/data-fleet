# SPEC - Especificação Técnica (βetaFleet)

Este documento detalha a arquitetura técnica, o modelo de dados e os contratos de API do sistema.

## 🏗️ Arquitetura do Sistema

O **βetaFleet** segue uma arquitetura de Single Page Application (SPA) com Backend as a Service (BaaS).

### Fluxo de Dados
1.  **Client**: React 19 + Vite (Roteamento via React Router).
2.  **State**: React Query para cache de dados e sincronização remota.
3.  **Local Storage**: Dexie (IndexedDB) para fila de sincronização offline.
4.  **BaaS**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).

## Integração externa — clima local

- Open-Meteo é usada para a previsão do tempo local exibida na Topbar.
- A integração é client-side, sem API key e sem Edge Function.
- São consultadas coordenadas aproximadas do navegador ou, para Driver, o fallback por cidade/UF da unidade operacional do veículo titular.
- Os dados não são persistidos em banco, `localStorage` ou IndexedDB.
- O cache de queries de clima não entra no `PERSIST_ALLOWLIST`.
- A severidade é derivada da previsão e não representa um alerta meteorológico oficial.

---

## 📂 Modelo de Dados (Schema)

### Entidades Principais
- **Clients**: `id (PK)`, `name`, `logo_url`.
- **Profiles**: `id (PK)`, `role`, `client_id (FK)`, `workshop_account_id (FK)`.
- **Vehicles**: `id (PK)`, `license_plate`, `type`, `axle_config (JSONB)`, `shipper_id (FK)`.
- **Tires**: `id (PK)`, `tire_code`, `visual_classification`, `active`.

### Relacionamentos Críticos
- **Vehicle ↔ Driver**: 1:1 (via `vehicles.driver_id`).
- **Shipper ↔ OperationalUnit**: 1:N.
- **WorkshopAccount ↔ Client**: N:M (via `workshop_partnerships`).

---

## 📡 Contratos de API (Edge Functions)

| Função | Método | Endpoint | Payload (Resumo) |
| :--- | :--- | :--- | :--- |
| `create-user` | POST | `/functions/v1/create-user` | `{ email, password, role, name, clientId }` |
| `workshop-invitation` | POST | `/functions/v1/workshop-invitation` | `{ action: 'create', clientId }` |
| `validate-token` | RPC | `rpc/validate_workshop_token` | `{ p_token: string }` |

---

## 🛡️ Camada de Segurança (RLS)

As políticas de RLS são aplicadas no nível da linha, garantindo que usuários de um tenant não acessem dados de outro.

O `Operations Manager` executa e consulta checklists de contexto `Auditoria` somente nos veículos pertencentes aos escopos de embarcador e unidade operacional atribuídos ao perfil. Esse contrato é aplicado pelas 9 policies `*_operations_manager` da migration `20260818000000_allow_operations_manager_audit_checklist.sql`; os contextos `Entrega` e `Devolução` e a Inspeção de Pneus permanecem exclusivos do `Yard Auditor`.

**Exemplo de Política (Checklists):**
```sql
CREATE POLICY "Assistant see tenant checklists" 
ON checklists FOR SELECT 
USING (
  (client_id = auth.jwt()->>'client_id' AND public.role_rank((SELECT role FROM profiles WHERE id = auth.uid())) >= 3)
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
);
```

---

## ✅ Conformidade de checklist — regra oficial

### Fonte única

A data do último checklist concluído por veículo e por contexto vem exclusivamente da RPC `public.dashboard_last_checklist_per_vehicle(p_client_id UUID)`. Ela é `SECURITY INVOKER`, portanto herda o RLS de `checklists`, e devolve `RETURNS TABLE (vehicle_id UUID, context TEXT, completed_at TIMESTAMPTZ)`. Desde 2026-08-19 a cláusula `IN` da consulta cobre os contextos `Rotina`, `Segurança` e `Auditoria` (antes só os dois primeiros). `p_client_id NULL` é o caso Admin Master: não filtra por tenant e o RLS governa.

### Regra por contexto

Um veículo está **vencido em um contexto** quando as duas condições valem:

1. o intervalo daquele contexto está parametrizado em `checklist_day_intervals` (`rotina_day_interval`, `seguranca_day_interval`, `auditoria_day_interval`); e
2. não existe checklist concluído daquele contexto para o veículo **ou** o número de dias entre o último checklist e hoje é **maior** que o intervalo.

Contexto com intervalo `NULL` é ignorado: o veículo não entra no conjunto daquele contexto. Veículo cujo cliente não possui linha em `checklist_day_intervals` não entra em nenhum conjunto.

### Distinção crítica entre agregado e contextos individuais

- O card "Conformidade de Checklist" e o contador "Checklists Vencidos" do Dashboard, e o filtro de pendência `checklist_overdue` da listagem de Veículos, usam **exclusivamente** a união **Rotina ∪ Segurança**.
- **`Auditoria` nunca entra no agregado**, mesmo quando o intervalo está parametrizado. Isso é requisito de produto, não inconsistência a ser corrigida.
- A sub-aba "Aderência" da página Checklists (visão Fleet Assistant+) usa os três contextos **individualmente**, um card por contexto.

### Onde a regra vive

`src/lib/dashboardKpi.ts`:

- `computeOverdueChecklistVehicleIdsByContext(...)` → `OverdueChecklistSets` com os conjuntos `rotina`, `seguranca`, `auditoria` e `aggregated` (este último apenas Rotina ∪ Segurança).
- `computeOverdueChecklistVehicleIds(...)` é um wrapper fino que devolve `aggregated`, preservando o contrato consumido por Dashboard e Veículos.
- `buildLastChecklistByVehicleAndContext(...)` e `isContextOverdue(...)` são as auxiliares puras da regra.

A agregação por embarcador/unidade e as linhas da tabela da sub-aba ficam em `src/lib/checklistAdherence.ts`, sem duplicar a regra de vencimento.

---

## 🔎 Filtros de listagem em Cadastros

As listagens de Veículos e Motoristas usam filtros multisseleção em checkbox visual. Não há mudança de banco, RLS, autenticação, API ou formulários de cadastro.

### Contrato de URL

Parâmetros canônicos:

- `q` — busca textual, valor singular.
- `shipper` — IDs de embarcadores, repetível.
- `unit` — IDs de unidades operacionais, repetível.
- `issue` — Pendências de Veículos ou Situações de Motoristas, repetível.
- `lastRoute` — categorias (`none`, `older_7d`, `older_30d`) ou datas de Última rota, repetível e somente aplicável ao tenant Deluna.
- `availability` — `available` ou `unavailable`, repetível e somente em Veículos.

Semântica: **OR dentro da dimensão** (opções da mesma dimensão) e **AND entre dimensões** (incluindo a busca `q`). A URL guarda arrays por parâmetros repetidos (`append` na escrita, `getAll` na leitura) e aceita links antigos com valor singular. Aliases legados (`embarcador`, `unidade`, `pendencia`, `situacao`) valem quando o canônico da dimensão não existe.

### Tipos de filtro

`VehicleStructuredFilters`: `shipperIds[]`, `operationalUnitIds[]`, `pendencies[]`, `lastRoutes[]`, `availability[]`.
`DriverStructuredFilters`: `shipperIds[]`, `operationalUnitIds[]`, `pendencies[]`.

### Regra oficial de disponibilidade

Reutiliza `computeUnavailableVehicleIds` (`src/lib/overviewFleetFilters.ts`): um veículo é indisponível se tiver ordem de manutenção fora de estado final (`Concluído`, `Cancelado`, `Veículo retirado`). Durante o carregamento das ordens o controle fica desabilitado; em erro, o filtro de disponibilidade não é aplicado e a seleção/URL são preservadas para nova tentativa.

### Exceção Deluna Transportes

`lastRoute` é exclusivo do tenant configurado: exige `VITE_LAST_ROUTE_CLIENT_ID` presente e `currentClient.id` igual ao valor. Outros tenants não consultam, renderizam nem aplicam o filtro, e o parâmetro canônico é ignorado e removido da URL.

---

## 🚀 Plano de Fases (Roadmap Técnico)

1.  **Fase 1 (Concluída)**: Bootstrap, Auth e Cadastros Básicos.
2.  **Fase 2 (Concluída)**: Checklists, Gestão de OS e OCR.
3.  **Fase 3 (Concluída)**: Módulo de Pneus e Multi-Parcerias de Oficina.
4.  **Fase 4 (Atual)**: Estabilização de Testes e Refatoração de Performance.
5.  **Fase 5 (Futura)**: Telemetria em tempo real e Integração com Rastreadores.

---

## 🔧 Módulo Revisões de Garantia

Programação estruturada de revisões de veículos em garantia, com **resolvedor único de "próxima revisão"** (`src/lib/warrantyRevisionResolver.ts`) que dá precedênciaao plano de garantia ativo sobre a regra preventiva por `km_interval` (`vehicle_km_intervals`).

### Tabelas
- **`warranty_revision_plans`**: plano (por modelo) ou adhoc (criado por placa, `is_adhoc=true`). Critérios: marca, modelo, faixa de ano, categoria, unidade.
- **`warranty_revision_plan_items`**: etapas do plano (sequência, rótulo, `target_km`, janelas de tolerância KM/dias, `months_from_acquisition`).
- **`vehicle_warranty_revision_assignments`**: vínculo ativo de um plano a um veículo. No máximo 1 assignment `active` por veículo (índice único parcial). Estados `active|finished|cancelled` com `finished_reason/finished_by/finished_at`.
- **`vehicle_warranty_revision_events`**: agenda materializada (1 linha por etapa por veículo) — snapshot de `target_km` e `target_date` (aquisição + meses), ajustável por veículo. Estados `pending|presumed_completed|completed`, com `executed_km/executed_date/evidence_url/maintenance_order_id`.

### Resolvedor (Single Source of Truth)
`resolveNextRevision({ currentKm, today, warrantyActive, pendingEvents, lastRevisionKm, kmInterval })` decide a próxima revisão efetiva:
1. `warrantyActive` com evento `pending` → regime `warranty` (menor sequência).
2. `warrantyActive` sem evento `pending` → `aguardando_proxima` (não cai em preventiva).
3. Sem garantia ativa → regime `preventive` a partir de `lastRevisionKm + kmInterval` (quando `km_interval > 0`), ou `none`.

Os futuros cards/alertas preventivos do Dashboard devem consumir este resolvedor (ramo `preventive`) — não há cálculo paralelo.

### Vínculo de OS e trigger
`maintenance_orders.warranty_revision_event_id` vincula opcionalmente uma OS a um evento de revisão. A marcação do evento como `completed` é feita por **trigger** (`fn_complete_warranty_revision_on_os`, `SECURITY DEFINER`) na transição da OS para `Concluído` — atômico e independente do caminho de UI.

### RLS
As 4 tabelas com SELECT por `client_id` (+ Admin Master) e escrita restrita a `Coordinator/Manager/Director/Admin Master`, usando **subqueries inline em `profiles`** (portável entre dev e prod).

### KM efetivo
O KM atual é sempre `MAX(effective_km)` da view `vehicle_odometer_effective_readings` — nunca `checklists.odometer_km` direto.

### Espelho não-destrutivo
A 1ª etapa criada pela tela espelha `vehicles.first_revision_max_km` (só preenche/atualiza, nunca grava `null`).

---

## 💸 Módulo Financeiro

### Shell e abas
`Financeiro.tsx` renderiza quatro abas visíveis conforme permissão, nesta ordem: `Aprovação de Orçamentos` (`budget`), `Pagamentos` (`payments`), `Aprovações` (`approvals`) e `Pagamentos Extras` (`extras`). A aba `Aprovações` é uma inbox única com segmented control interno (`Pagamentos`/`Extras`) que monta apenas o segmento ativo; o segmento é persistido via `usePersistentTabState` (chave `approvalSegment`) e refletido em `?tab=approvals&segment=`. `BudgetApprovals` ganhou a prop `embedded` para rodar sem header/padding próprios dentro do shell. O estado legado de aba `extra-approvals` migra automaticamente para `approvals` + segmento `extras` (uma única vez). Deep link de orçamento: `/financeiro?tab=budget` (substituiu a rota inexistente `/aprovacao-orcamentos`).

Aprovações são **inbox pura**: mostram somente parcelas/pedidos pendentes. Histórico e auditoria (quem aprovou/pagou e quando) ficam nos ledgers (`PaymentsTab`, `ExtraPaymentsTab`) e nos modais de visualização — não existe mais bloco "Já processados".

### Histórico de orçamentos aprovados e reprovados
A aba `Aprovação de Orçamentos` (`budget`) passou a ter segmented control interno `Pendentes`/`Histórico`, implementado em `BudgetApprovalsTab.tsx` (mesmo padrão de `ApprovalsTab.tsx`): o segmento ativo é persistido via `usePersistentTabState` (chave `budgetSegment`) e refletido em `?tab=budget&segment=pending|history`. O segmento `Pendentes` é a fila existente (`BudgetApprovals` embedded, inbox pura, inalterada). O segmento `Histórico` é o ledger somente-leitura dos orçamentos já decididos: `listReviewedBudgets` (`src/services/budgetHistoryService.ts`) lê em `maintenance_orders` as linhas com `budget_status` em `('aprovado','reprovado')` do tenant ativo, ordenadas por `budget_reviewed_at` desc, com filtros puros de decisão/oficina/busca (`src/lib/budgetHistoryFilters.ts`) e exportação XLSX via provider (`src/services/budgetHistoryExport/xlsxBudgetHistoryProvider.ts`). Nenhum dado novo é gravado — todas as colunas exibidas já existiam em `maintenance_orders` (`budget_status`, `budget_reviewed_by`, `budget_reviewed_at`, `budget_rejection_reason`, `approved_cost`). A linha do histórico mostra apenas a **última decisão** de cada OS: como o gatilho de `20260625000200_enforce_workshop_maintenance_columns.sql` permite a oficina devolver `budget_status` para `pendente`, uma OS reorçada sobrescreve a decisão anterior e perde o registro da decisão precedente (não há trilha de rodadas). A afirmação de que Aprovações são inbox pura e de que não existe bloco "Já processados" permanece válida e não foi revogada.

### Aprovação agrupada de manutenção
`groupPendingMaintenancePayments` (`src/lib/paymentApprovalGroups.ts`) agrupa parcelas pendentes de `source_type='maintenance_order'` por `maintenance_order_id`. O segmento Pagamentos de Aprovações renderiza um card por OS (`MaintenancePaymentApprovalGroupCard`) com custo aprovado, quantidade e total pendente; `Aprovar todas` abre `FinancialApprovalConfirmModal` e envia o snapshot atual (`id`+`updated_at`) de todas as parcelas do grupo para a RPC `approve_maintenance_payment_group`, que aprova o lote inteiro numa única transação ou aborta tudo (Fail Closed/OCC). Aprovação/reprovação individual de parcela de manutenção continua disponível linha a linha. `BudgetDocumentPreviewModal` foi evoluído para consultar `getMaintenanceBudgetApprovalDetails` sob demanda e mostrar duas visões (`Itens`/`PDF`) sem sair da tela; não aprova nada — a ação de aprovação fica no card.

### Aprovação de Pagamentos Extras pelo cabeçalho
O segmento Extras de Aprovações renderiza um card por `extra_payment_request_id` com os dados do pedido e uma tabela somente leitura das parcelas (sem ações individuais). Pedido sem parcelas ou com soma divergente do `amount` do cabeçalho fica com `Aprovar pedido e parcelas` desabilitado. A aprovação chama `approve_extra_payment_request_group`, que valida o snapshot do cabeçalho (`updated_at`) e das parcelas e aprova apenas o cabeçalho — a propagação para as parcelas é feita por trigger `AFTER UPDATE` no banco.

### Tabela `extra_payment_requests`
Cabeçalho/contexto operacional do lançamento extra: `client_id`, `request_number` (formato `PE-YYMM-0001`, gerado pela RPC `next_extra_payment_request_number`), `category`, `service_date`, `supplier_name`/`supplier_document`, `vehicle_id`/`driver_id` (ambos opcionais, para autopreenchimento cruzado), `amount`, `status` (`pendente_aprovacao|aprovado|reprovado|pago|cancelado`), campos de auditoria (`approved_by/at`, `rejected_by/at/reason`, `paid_by/at`).

### Origem mista em `payment_installments`
As parcelas de Pagamentos Extras **não** têm tabela própria — `payment_installments` foi generalizada com `source_type` (`maintenance_order|extra_payment`) e `extra_payment_request_id`. `maintenance_order_id` deixou de ser `NOT NULL`. Constraint `payment_installments_source_check` garante exclusividade: origem manutenção exige `maintenance_order_id` e proíbe `extra_payment_request_id`; origem extra é o inverso. `Pagamentos` (`PaymentsTab`) é o ledger único das duas origens (filtros, seleção, criação, edição, CSV/XLSX); exportação de parcelas Extras existe somente ali — `Pagamentos Extras` (`ExtraPaymentsTab`) ficou focado no pedido (cards, filtros, criação, cancelamento, detalhe), sem exportação própria.

### State machine e sincronização (migration `20260804000000_secure_financial_approval_groups.sql`)
- `fn_validate_payment_installment_transition` (BEFORE UPDATE em `payment_installments`): edição de campos só quando `pendente_aprovacao`, e nunca sobre identidade/origem/auditoria; `pendente_aprovacao → aprovado|reprovado` exige allowlist exata (`Coordinator|Manager|Director|Admin Master`) para manutenção, e para extra só é permitida quando o status do cabeçalho correspondente já é igual ao destino (bloqueia aprovação isolada de parcela extra, permite a propagação do trigger do cabeçalho); `aprovado → pago` exige `Financeiro|Admin Master` para as duas origens.
- `fn_validate_payment_installment_source_integrity` (BEFORE INSERT/UPDATE de campos de identidade): garante que a OS/pedido de origem existe, pertence ao mesmo `client_id` e, no INSERT, que o pedido extra ainda está `pendente_aprovacao`.
- `fn_validate_extra_payment_request_transition` (BEFORE UPDATE em `extra_payment_requests`): aprova/reprova (`Coordinator+`/`Admin Master`; reprovação exige motivo; aprovação exige ao menos uma parcela, todas pendentes e soma igual a `amount`) e só valida/preenche auditoria — não toca nas parcelas nessa mesma transição.
- `fn_sync_extra_payment_request_installments` (AFTER UPDATE OF status em `extra_payment_requests`): propaga `pendente_aprovacao → aprovado|reprovado` para todas as parcelas pendentes do pedido.
- `fn_sync_extra_payment_request_paid_status` (AFTER UPDATE OF status em `payment_installments`): quando uma parcela extra vai a `pago`, marca o cabeçalho `aprovado → pago` **somente** se não restar nenhuma parcela diferente de `pago` — pagamento da primeira parcela não marca o pedido como pago; só a última marca.
- `fn_enforce_payment_installment_budget_cap` (teto de orçamento) segue só se aplicando quando `source_type = 'maintenance_order'`.

### RPCs de aprovação em lote
- `approve_maintenance_payment_group(p_maintenance_order_id, p_installment_ids, p_installment_updated_ats)`: aprova atomicamente todas as parcelas pendentes esperadas de uma OS. `SECURITY INVOKER` (preserva RLS), allowlist exata de papéis, trava linhas com `FOR UPDATE`, exige igualdade exata entre o conjunto pendente atual e o informado e compara `updated_at` (Optimistic Concurrency Control) de cada parcela; qualquer divergência de tenant/origem/OS/ID/status/versão aborta o lote inteiro.
- `approve_extra_payment_request_group(p_extra_payment_request_id, p_request_updated_at, p_installment_ids, p_installment_updated_ats)`: mesma postura Fail Closed/OCC, valida snapshot do cabeçalho e das parcelas e `SUM(value) = amount` em `NUMERIC`; aprova só o cabeçalho, deixando o trigger `AFTER` propagar.
- Ambas com `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`; tenant é sempre derivado do agregado no banco, nunca do `client_id` enviado pelo browser.

### RLS
`extra_payment_requests`: SELECT para Fleet Assistant+ do tenant e Admin Master (todos os status); Financeiro do tenant só vê `aprovado`/`pago`. INSERT restrito a Fleet Assistant+ exceto Workshop/Financeiro, sempre `pendente_aprovacao` e `created_by_id = auth.uid()`. UPDATE para Coordinator+/Admin Master (aprovar/reprovar/cancelar) e para o próprio criador cancelar (`pendente_aprovacao → cancelado`). Sem policy de DELETE.

### Outras RPCs
- `next_extra_payment_request_number(p_client_id)`: gera o próximo número sequencial por mês/cliente.
- `get_extra_payment_auditors(p_extra_payment_request_id)`: nomes de auditoria (criado/aprovado/reprovado/pago por), `SECURITY DEFINER` reimpondo visibilidade por tenant/status.
- `get_payment_installment_auditors(p_installment_id)`: nomes de auditoria de uma parcela de manutenção, `SECURITY DEFINER`.

### Frontend
`ExtraPaymentFormModal` (criação, Fleet Assistant+), `ExtraPaymentsTab` (fila operacional/ledger do pedido, sem exportação), `ApprovalsTab` (inbox única com segmentos Pagamentos/Extras), `PaymentApprovalsTab`/`MaintenancePaymentApprovalGroupCard` (segmento Pagamentos, agrupado por OS), `ExtraPaymentApprovalsTab` (segmento Extras, cards por pedido), `FinancialApprovalConfirmModal` (confirmação compartilhada de aprovação em lote), `ExtraPaymentViewModal` (detalhe + auditoria). `PaymentsTab`/`PaymentInstallmentViewModal`/CSV do Financeiro seguem exibindo e exportando origem mista sem duplicar componentes; ícones de documentos usam Lucide (`FileText`, `ReceiptText`, `KeyRound`) em vez de emojis.

---

## 🚨 Módulo Chamados/S.O.S.

Módulo operacional multi-tenant para S.O.S. de motoristas e chamados comuns da frota. S.O.S. nasce sempre crítico e é aberto somente por Driver; chamados comuns são abertos por Yard Auditor, Operations Manager ou Fleet Assistant+ sem criticidade e classificados posteriormente pela Frota.

### Tabelas e eventos

- `fleet_tickets`: snapshots do autor, papel, motorista e placa; origem `sos|report`; criticidade `critical|high|medium|low`; status `open|in_analysis|in_progress|resolved|closed|cancelled`; localização, anexos e estado da notificação Telegram.
- `fleet_ticket_events`: histórico append-only de `created`, `attachments_added`, `classified`, `assigned`, `status_changed`, `telegram_sent` e `telegram_failed`.
- `client_telegram_settings`: uma configuração por cliente, desativada por padrão, com `chat_id` e flags `notify_sos`, `notify_critical` e `notify_high`.

As três tabelas usam `CHECK` em vez de enums PostgreSQL. A constraint de forma garante que S.O.S. tenha `sos_type`, motorista e criticidade crítica, enquanto chamado comum não tenha `sos_type`.

### RLS e RPCs

`fleet_tickets` e `fleet_ticket_events` têm leitura por tenant: Admin Master vê tudo; Fleet Assistant+ e Yard Auditor veem o tenant; Operations Manager fica limitado ao escopo de veículos e aos próprios chamados; Driver vê apenas os próprios S.O.S. Não há escrita direta em tickets/eventos: as operações passam por `create_sos_ticket`, `create_fleet_ticket_report`, `append_fleet_ticket_attachments`, `classify_fleet_ticket`, `assign_fleet_ticket_to_self`, `update_fleet_ticket_status` e `record_fleet_ticket_telegram_result`, todos `SECURITY DEFINER`.

`client_telegram_settings` é legível e editável somente por Coordinator, Manager, Director e Admin Master, com validação de tenant. A classificação de S.O.S. não permite rebaixar a criticidade e a resolução exige notas.

### Storage

O bucket `fleet-ticket-attachments` é privado. Os paths seguem `<client_id>/fleet-tickets/<ticket_id>/...`, uploads usam `validateFile()` e a UI limita a três arquivos por criação. A leitura é feita por signed URL com validade de uma hora.

## Storage de documentos (V-01)

Os buckets `vehicle-documents` e `driver-documents` são **privados**. A leitura anônima foi fechada pela migration `20260811010000_make_document_buckets_private.sql`; as policies de `SELECT` exigem usuário autenticado e mantêm o isolamento por tenant, com as exceções já vigentes de `Admin Master` e, em `vehicle-documents`, de oficina com parceria ativa.

O banco persiste o **caminho** do objeto (`<client_id>/...`), nunca uma URL. A visualização gera uma **URL assinada com validade de 3600 segundos** no momento da leitura, por `getPrivateDocumentSignedUrl()` em `src/lib/storageHelpers.ts` ou pelo hook `src/hooks/useStorageFileUrl.ts`. A URL assinada é um bearer link temporário e não é persistida em banco, `localStorage` nem logs; ao reabrir a tela, outra é gerada.

Registros antigos que ainda guardam a URL pública continuam abrindo: `extractStoragePath()` converte URL pública ou assinada legada para caminho na leitura, sem backfill destrutivo, e rejeita valores que não pertençam ao bucket esperado.

`checklist-photos` permanece **público**, por ser o bucket de fotos operacionais usado pelo fluxo offline de checklists e inspeção de pneus. `financial-documents` e `fleet-ticket-attachments` já eram privados e não foram alterados.

## OCR de documentos (V-06)

O processamento de documentos pelo **Gemini (`gemini-2.5-flash`)** é autorizado. A Edge Function `gemini-ocr` aplica validação server-side antes de qualquer chamada externa — MIME permitido (PDF, JPG, PNG, WEBP), assinatura real do arquivo, Base64 válido, máximo de 10 MB por arquivo e teto técnico do prompt —, respondendo `400`, `413`, `415`, `429`, `502` ou `500` conforme o caso, sem expor stack trace, chave ou conteúdo do documento.

A cota por usuário é reservada atomicamente **antes** da chamada ao Gemini, pela RPC `public.consume_gemini_ocr_quota(p_file_bytes bigint)` (`SECURITY DEFINER`, `auth.uid()`, bloqueio de linha). Em uma janela fixa de uma hora em UTC são permitidas no máximo **20 chamadas** e **104857600 bytes (100 MB)** por usuário; ao estourar, a função devolve `429` com o motivo e os segundos para nova tentativa. A tabela `public.gemini_ocr_usage_windows` tem RLS habilitado sem policies: só a RPC acessa seus dados.

O limite é por usuário e não substitui o monitoramento de custo da conta Google nem uma proteção global contra muitos usuários simultâneos — limitação conhecida e aceita.

### Frontend

- `/sos`: formulário mobile-first para Driver, com GPS, localização manual quando necessário, descrição mínima de 5 caracteres e anexos opcionais.
- `/chamados`: cards de S.O.S., não classificados e criticidade, busca, filtro por status (seleção única, persistido na sessão), ordenação por urgência, tabela, modal com localização/mapa, anexos, histórico e ações condicionadas ao papel.
- Topbar: sininho com até cinco urgências ativas e polling de 60 segundos; sem realtime nesta versão.
- Configurações: aba Telegram para Coordinator+, com ativação, `chat_id`, flags, instruções e mensagem de teste.

### Telegram

A Edge Function `notify-fleet-ticket-telegram` aceita `{ action: 'ticket', ticketId, reason }` e `{ action: 'test', clientId }`, valida a sessão/profile, aplica o tenant e as flags, envia somente texto ao bot global e registra sucesso/falha no evento do ticket. A mensagem contém dados operacionais mínimos e deep link para `/chamados?ticket={id}`; anexos nunca são enviados.

Em 2026-07-29, a migration foi aplicada e validada no DEV `vvbnbzzhpiksacqudmfu`; não foi aplicada em PROD. A Edge Function foi criada no repositório, mas o deploy, secrets, configuração de tenant/chat e validação de mensagem real permanecem pendentes por dependerem de ação manual autorizada.
