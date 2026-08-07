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

### Frontend

- `/sos`: formulário mobile-first para Driver, com GPS, localização manual quando necessário, descrição mínima de 5 caracteres e anexos opcionais.
- `/chamados`: cards de S.O.S., não classificados e criticidade, busca, filtro por status (seleção única, persistido na sessão), ordenação por urgência, tabela, modal com localização/mapa, anexos, histórico e ações condicionadas ao papel.
- Topbar: sininho com até cinco urgências ativas e polling de 60 segundos; sem realtime nesta versão.
- Configurações: aba Telegram para Coordinator+, com ativação, `chat_id`, flags, instruções e mensagem de teste.

### Telegram

A Edge Function `notify-fleet-ticket-telegram` aceita `{ action: 'ticket', ticketId, reason }` e `{ action: 'test', clientId }`, valida a sessão/profile, aplica o tenant e as flags, envia somente texto ao bot global e registra sucesso/falha no evento do ticket. A mensagem contém dados operacionais mínimos e deep link para `/chamados?ticket={id}`; anexos nunca são enviados.

Em 2026-07-29, a migration foi aplicada e validada no DEV `vvbnbzzhpiksacqudmfu`; não foi aplicada em PROD. A Edge Function foi criada no repositório, mas o deploy, secrets, configuração de tenant/chat e validação de mensagem real permanecem pendentes por dependerem de ação manual autorizada.
