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
