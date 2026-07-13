# SPEC - Especificação Técnica (βetaFleet)

Este documento detalha a arquitetura técnica, o modelo de dados e os contratos de API do sistema.

## 🏗️ Arquitetura do Sistema

O **βetaFleet** segue uma arquitetura de Single Page Application (SPA) com Backend as a Service (BaaS).

### Fluxo de Dados
1.  **Client**: React 19 + Vite (Roteamento via React Router).
2.  **State**: React Query para cache de dados e sincronização remota.
3.  **Local Storage**: Dexie (IndexedDB) para fila de sincronização offline.
4.  **BaaS**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).

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

## 💸 Módulo Financeiro — Pagamentos Extras

Domínio para despesas operacionais fora da manutenção (guincho, chaveiro, borracheiro, Uber/táxi, frete de apoio), sem vínculo obrigatório com OS.

### Tabela `extra_payment_requests`
Cabeçalho/contexto operacional do lançamento extra: `client_id`, `request_number` (formato `PE-YYMM-0001`, gerado pela RPC `next_extra_payment_request_number`), `category`, `service_date`, `supplier_name`/`supplier_document`, `vehicle_id`/`driver_id` (ambos opcionais, para autopreenchimento cruzado), `amount`, `status` (`pendente_aprovacao|aprovado|reprovado|pago|cancelado`), campos de auditoria (`approved_by/at`, `rejected_by/at/reason`, `paid_by/at`).

### Origem mista em `payment_installments`
As parcelas de Pagamentos Extras **não** têm tabela própria — `payment_installments` foi generalizada com `source_type` (`maintenance_order|extra_payment`) e `extra_payment_request_id`. `maintenance_order_id` deixou de ser `NOT NULL`. Constraint `payment_installments_source_check` garante exclusividade: origem manutenção exige `maintenance_order_id` e proíbe `extra_payment_request_id`; origem extra é o inverso.

### State machine e sincronização
`fn_validate_extra_payment_request_transition` (trigger em `extra_payment_requests`) valida `pendente_aprovacao → aprovado|reprovado|cancelado` (Coordinator+/Admin Master; reprovação exige motivo) e propaga o status para as parcelas vinculadas. `fn_validate_payment_installment_transition` foi estendida para exigir Financeiro/Admin Master ao marcar parcela extra como paga, e atualiza `extra_payment_requests.status = 'pago'` no mesmo trigger. `fn_enforce_payment_installment_budget_cap` (teto de orçamento) só se aplica quando `source_type = 'maintenance_order'`.

### RLS
`extra_payment_requests`: SELECT para Fleet Assistant+ do tenant e Admin Master (todos os status); Financeiro do tenant só vê `aprovado`/`pago`. INSERT restrito a Fleet Assistant+ exceto Workshop/Financeiro, sempre `pendente_aprovacao` e `created_by_id = auth.uid()`. UPDATE para Coordinator+/Admin Master (aprovar/reprovar/cancelar) e para o próprio criador cancelar (`pendente_aprovacao → cancelado`). Sem policy de DELETE.

### RPCs
- `next_extra_payment_request_number(p_client_id)`: gera o próximo número sequencial por mês/cliente.
- `get_extra_payment_auditors(p_extra_payment_request_id)`: nomes de auditoria (criado/aprovado/reprovado/pago por), `SECURITY DEFINER` reimpondo visibilidade por tenant/status.

### Frontend
`ExtraPaymentFormModal` (criação, Fleet Assistant+), `ExtraPaymentsTab` (fila operacional), `ExtraPaymentApprovalsTab` (fila de aprovação, Coordinator+), `ExtraPaymentViewModal` (detalhe + auditoria). `PaymentsTab`/`PaymentInstallmentViewModal`/CSV do Financeiro foram estendidos para exibir e exportar origem mista sem duplicar componentes.
