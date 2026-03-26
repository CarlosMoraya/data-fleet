# Arquitetura Backend (Supabase)

## Infraestrutura

- **Supabase** como BaaS (Auth, Database, Edge Functions)
- **Sem CLI instalado** — deploy de Edge Functions via Supabase Dashboard UI
- Client config: `src/lib/supabase.ts` usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## Autenticação

- **Supabase Auth** com email/senha
- `AuthContext.tsx` expõe `useAuth()` hook → `{ user, currentClient, signIn, signOut }`
- Session persistida via Supabase (localStorage)
- Perfil do usuário armazenado na tabela `profiles` (id, name, email, role, client_id, can_delete_vehicles, can_delete_drivers, can_delete_workshops)

## Banco de Dados

### Tabelas existentes
- `profiles` — dados do usuário (vinculado a auth.users, can_delete_vehicles, can_delete_drivers, can_delete_workshops flags)
- `clients` — tenants/empresas (id, name, logo_url)
- `vehicles` — veículos da frota (CRUD completo com RLS); coluna `driver_id UUID NULL FK → drivers(id) ON DELETE SET NULL` + índice único parcial `WHERE driver_id IS NOT NULL` garante associação 1:1 motorista×veículo; **NOVO**: `shipper_id UUID NULL FK → shippers(id) ON DELETE SET NULL` + `operational_unit_id UUID NULL FK → operational_units(id) ON DELETE SET NULL` + `initial_km INTEGER NULL` — hodômetro inicial do veículo (baseline para validação de checklists)
- `vehicle_field_settings` — configurações dinâmicas de campos obrigatórios de veículo por cliente; **NOVO**: `initial_km_optional BOOLEAN DEFAULT false` — permite configurar se Km Inicial é obrigatório ou opcional
- `shippers` — embarcadores (CRUD com RLS, CNPJ único por cliente, 6 campos opcionais); FK RESTRICT (não permite deletar se houver unidades vinculadas)
- `operational_units` — unidades operacionais (CRUD com RLS, code único por cliente); FK obrigatória para shipper (RESTRICT on delete)
- `drivers` — motoristas (CRUD com RLS, CPF único por cliente, 5 uploads de documento)
- `driver_field_settings` — configurações dinâmicas de campos obrigatórios de motorista por cliente
- `workshops` — oficinas parceiras (CRUD com RLS, CNPJ único por cliente, sem uploads); **NOVO**: `profile_id UUID NULL FK → profiles(id) ON DELETE SET NULL` — quando preenchido, a oficina tem login próprio com role 'Workshop'; índice `idx_workshops_profile_id`
- `vehicle_km_intervals` — km máximo entre revisões por veículo (UNIQUE vehicle_id); colunas: `id, client_id, vehicle_id, km_interval INTEGER NULL, updated_at, updated_by`; RLS: SELECT/INSERT/UPDATE Fleet Assistant(3)+ do próprio tenant ou Admin Master; DELETE Manager(5)+; migration: `create_vehicle_km_intervals.sql`
- `checklist_day_intervals` — intervalo em dias entre checklists consecutivos de Rotina e Segurança por cliente (UNIQUE client_id); colunas: `id, client_id, rotina_day_interval INTEGER NULL, seguranca_day_interval INTEGER NULL, updated_at, updated_by`; RLS: SELECT/INSERT/UPDATE Fleet Assistant(3)+ do próprio tenant ou Admin Master; DELETE Manager(5)+; migration: `create_checklist_day_intervals.sql` ⚠️ EXECUTAR NO SUPABASE DASHBOARD

### Tabelas de Checklists (criadas em `create_checklist_tables.sql` + migrations adicionais)
- `checklist_item_suggestions` — banco global de sugestões por categoria de veículo (Leve/Médio/Pesado/Elétrico). Sem `client_id`. Seed com ~45 itens pré-populados. SELECT para qualquer autenticado.
- `checklist_templates` — templates por cliente com ciclo `draft → published → deprecated`. Colunas: `context` TEXT NOT NULL DEFAULT 'Rotina' CHECK IN ('Rotina','Auditoria','Reboque','Entrada em Oficina','Saída de Oficina','Segurança'), `vehicle_category` NOT NULL, `current_version`, `allow_driver_actions`, `allow_auditor_actions`. EXCLUDE constraint `unique_published_category_context` via btree garante 1 published por (client, category, context). INSERT/UPDATE: Manager+. Nome do template gerado automaticamente como `"Checklist [Categoria] [Contexto]"`.
- `checklist_template_versions` — snapshots imutáveis ao publicar. UNIQUE (template_id, version_number).
- `checklist_items` — itens por (template_id, version_number). Coluna `can_block_vehicle BOOLEAN NOT NULL DEFAULT false` — ativado em templates de Segurança. Durante draft, itens editáveis livremente. Publicado: snapshot congelado. **RLS SELECT inclui Driver e Yard Auditor** (obrigatório para ChecklistFill.tsx funcionar). Ao atualizar esta policy, SEMPRE incluir todos os roles: `'Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'` + Admin Master. Fix: `fix_checklist_items_driver_rls.sql`.
- `checklists` — instâncias preenchidas. `vehicle_id` obrigatório. `workshop_id UUID NULL FK → workshops(id) ON DELETE SET NULL` — preenchido nos contextos Entrada/Saída de Oficina. `status` IN ('in_progress','completed'). `odometer_km INTEGER NULL` — hodômetro do veículo no momento do preenchimento (obrigatório, não pode ser menor que o último checklist concluído). DELETE: APENAS Admin Master.
- `checklist_responses` — respostas por item (ok/issue/skipped/not_applicable). CASCADE delete do checklist pai. UNIQUE (checklist_id, item_id).
- `action_plans` — ações geradas automaticamente para itens 'issue'. Campos v1: `suggested_action`, `observed_issue`, `photo_url`, `status` (pending/in_progress/awaiting_conclusion/completed/cancelled), `work_order_number`. Campos v2 (`add_action_plan_v2.sql`): `name`, `responsible_id`, `due_date`, `assigned_by`, `claimed_by`, `claimed_at`, `conclusion_evidence_url`. INSERT: Fleet Analyst+ do tenant ou Admin Master. DELETE: APENAS Admin Master.

### Storage Buckets
- `vehicle-documents` — CRLV, inspeção sanitária, GR para veículos + evidências de planos de ação (`{client_id}/action-plans/{plan_id}/evidence.{ext}`)
- `driver-documents` — CNH, GR, certificados para motoristas
- `checklist-photos` — fotos capturadas via câmera durante checklists. Path: `{client_id}/{checklist_id}/{item_id}/{timestamp}.jpg`. Políticas via `create_checklist_photos_bucket.sql`: SELECT público; INSERT/UPDATE para qualquer autenticado do tenant (Driver, Auditor, etc.); DELETE apenas Fleet Analyst+

### Tabela `shippers` RLS:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master
- INSERT/UPDATE: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master
- DELETE: Manager (rank 5)+ OU Fleet Analyst (rank 4) com `can_delete_shippers = true` (se aplicável)
- Unique constraint: `(client_id, cnpj)` com CNPJ nullable

### Tabela `operational_units` RLS:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master
- INSERT/UPDATE: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master
- DELETE: Manager (rank 5)+ OU Fleet Analyst (rank 4) com `can_delete_operational_units = true` (se aplicável)
- FK constraint: `shipper_id` com `ON DELETE RESTRICT` — não permite deletar embarcador com unidades vinculadas
- Unique partial index: `(client_id, code)` WHERE code IS NOT NULL

### Tabela `maintenance_orders` (nova — migration `20260319000000_add_budget_to_maintenance.sql`):
- Colunas adicionadas: `current_km NUMERIC(10,0) NULL`, `budget_pdf_url TEXT NULL`, `budget_status VARCHAR(20) NOT NULL DEFAULT 'sem_orcamento' CHECK IN ('sem_orcamento','pendente','aprovado','reprovado')`, `budget_reviewed_by UUID NULL FK → profiles(id)`, `budget_reviewed_at TIMESTAMPTZ NULL`
- `status` CHECK atualizado: `IN ('Aguardando orçamento','Aguardando aprovação','Orçamento aprovado','Serviço em execução','Concluído','Cancelado')` (migration: `add_cancelled_status_maintenance.sql`)
- Colunas de auditoria de cancelamento: `cancelled_at TIMESTAMPTZ NULL`, `cancelled_by_id UUID NULL FK → profiles(id)` (adicionadas na mesma migration)
- RLS: (role_rank >= 3 AND client_id = ...) OR role = 'Admin Master' — **SEMPRE incluir Admin Master bypass**
- Index: `idx_maintenance_budget_status ON (client_id, budget_status) WHERE budget_status = 'pendente'`

### Tabela `maintenance_budget_items`:
- Colunas: `id UUID PK`, `maintenance_order_id UUID FK → maintenance_orders CASCADE`, `client_id UUID FK → clients CASCADE`, `item_name TEXT NOT NULL`, `system TEXT NULL`, `quantity NUMERIC(10,2) DEFAULT 1`, `value NUMERIC(12,2) DEFAULT 0 (valor unitário R$)`, `sort_order INT DEFAULT 0`, `created_at TIMESTAMPTZ`
- RLS: (role_rank >= 3 AND client_id = ...) OR role = 'Admin Master'
- Padrão de save: DELETE todos WHERE maintenance_order_id = orderId → INSERT novos (delete-then-insert)

### Storage — Orçamentos de Manutenção:
- Bucket: `vehicle-documents` (reutilizado)
- Path: `{clientId}/maintenance/{orderId}/budget.{ext}` (pdf ou jpg)
- Função: `uploadMaintenanceBudget(clientId, orderId, file)` em `storageHelpers.ts`

### Migrations Ativas
- `create_drivers_tables.sql` — tabelas `drivers` e `driver_field_settings`
- `add_driver_profile_link.sql` — adiciona coluna `profile_id UUID UNIQUE FK → profiles(id)` + INDEX `idx_drivers_profile_id` na tabela `drivers` para ligar cada motorista a seu perfil de usuário do sistema (2026-03-14)
- `create_shippers_and_operational_units.sql` — tabelas `shippers` e `operational_units` com RLS policies, FK columns em `vehicles` (2026-03-17)
- `20260319000000_add_budget_to_maintenance.sql` — novas colunas em `maintenance_orders` (current_km, budget_pdf_url, budget_status, budget_reviewed_by/at), tabela `maintenance_budget_items` com RLS ⚠️ **Executar no Supabase Dashboard**
- `add_cancelled_status_maintenance.sql` — adiciona `'Cancelado'` ao CHECK de `status`, colunas `cancelled_at TIMESTAMPTZ` e `cancelled_by_id UUID FK → profiles(id)` em `maintenance_orders` ⚠️ **Executar no Supabase Dashboard**
- `add_initial_km_vehicles.sql` — adiciona `initial_km INTEGER NULL` em `vehicles` e `initial_km_optional BOOLEAN DEFAULT false` em `vehicle_field_settings` (2026-03-19) ⚠️ **Executar no Supabase Dashboard**
- `add_odometer_km_checklists.sql` — adiciona `odometer_km INTEGER NULL` em `checklists` (2026-03-19) ⚠️ **Executar no Supabase Dashboard**
- `20260319100000_add_workshop_login.sql` — role 'Workshop' no CHECK de profiles.role, atualiza `role_rank()` para Workshop=1, adiciona `profile_id` em workshops, recria RLS de `maintenance_orders` e `maintenance_budget_items` para incluir Workshop, policy `workshop_self_select` em workshops (2026-03-19) ⚠️ **Executar no Supabase Dashboard**
- `fix_workshop_vehicles_rls.sql` — adiciona policy SELECT em vehicles para Workshop (acesso apenas a veículos em suas próprias OS, via join com workshops.profile_id); resolve bug onde join vehicles retornava null para Workshop causando "N/A" na coluna Placa (2026-03-19) ⚠️ **Executar no Supabase Dashboard**
- `fix_vehicles_admin_master_rls.sql` — corrige SELECT policy em `vehicles` para incluir `OR role = 'Admin Master'` (Admin Master tem client_id = NULL, precisava de exceção especial como em maintenance_orders e action_plans); resolve bug no Dashboard onde Total de Veículos exibia 0 para Admin Master (2026-03-19) ⚠️ **Executar no Supabase Dashboard**
- `20260326000000_fix_supervisor_coordinator_rls.sql` — Atualiza hierarquia de roles: Supervisor(5), Coordinator(6), Manager(7), Director(8), Admin Master(9); corrige role_rank() função; adiciona Supervisor/Coordinator aos RLS policies de 5 tabelas: drivers (SELECT/INSERT/UPDATE/DELETE), driver_field_settings (SELECT), shippers (SELECT/INSERT/UPDATE/DELETE), operational_units (SELECT/INSERT/UPDATE/DELETE), workshops (SELECT/INSERT/UPDATE/DELETE). Resolve bug onde Supervisor+ não conseguiam visualizar motoristas, embarcadores, unidades operacionais e oficinas apesar de terem permissões pelas regras do sistema (2026-03-26) ✅ **Executada no Supabase Dashboard**

### RLS — Padrões de Checklists
- `checklists` SELECT: Driver/Auditor vê os próprios; Fleet Assistant+ vê todo o tenant; Admin Master vê tudo
- `checklists` DELETE: APENAS Admin Master (exclusão hard-delete para trilha de auditoria)
- `action_plans` SELECT/UPDATE: Fleet Assistant+ do tenant **OU Admin Master** (via migration `fix_action_plans_admin_master_rls.sql`)
- `action_plans` INSERT: Fleet Analyst+ do tenant **OU Admin Master** (via migration `fix_action_plans_admin_master_rls.sql`)
- `action_plans` DELETE: APENAS Admin Master
- **⚠️ BUG CORRIGIDO (2026-03-18)**: Migration anterior usava `client_id IN (SELECT client_id...)` que bloqueava Admin Master (client_id = NULL). Corrigido com `EXISTS` + check `role = 'Admin Master'`.

### Tabela `vehicles` — colunas principais
`id`, `client_id`, `type` (Passeio a Cavalo), `energy_source`, `cooling_equipment`, `semi_reboque`, `placa_semi_reboque`, `fuel_type`, `tank_capacity`, `avg_consumption`, `cooling_brand`, `license_plate`, `renavam`, `chassi`, `detran_uf`, `brand`, `model`, `year`, `color`, `acquisition`, `acquisition_date`, `fipe_price`, `tracker`, `antt`, `owner`, `status`, `autonomy`, `tag`, `crlv_upload`, `sanitary_inspection_upload`, `gr_upload`, `gr_expiration_date`, `spare_key`, `vehicle_manual`, `category`, `created_at`, `updated_at`

RLS vehicles:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master (cross-tenant) + Driver (somente veículo atribuído via `driver_id`) + Yard Auditor (todos do próprio tenant — policy `vehicles_select_auditor` via `fix_vehicles_auditor_rls.sql`)
- INSERT/UPDATE: Fleet Analyst (rank 4)+ do próprio tenant + Admin Master
- DELETE: Manager(5)+ OU Fleet Analyst(4) com `can_delete_vehicles = true`
- Unique index em `(client_id, license_plate)`

### Tabela `drivers` RLS (2026-03-14):
- **profile_id**: Novo campo FK → profiles(id) para ligar cada driver a seu usuário do sistema. Criado via Edge Function `create-user` quando novo driver é registrado via DriverForm. Permite que Driver role encontre seu veículo via: `drivers.profile_id = auth.uid()` → `vehicles.driver_id = drivers.id`
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant
- INSERT/UPDATE: Fleet Analyst (rank 4)+ do próprio tenant + Edge Function `create-user` (insere profile_id)
- DELETE: Manager(5)+ OU Fleet Analyst(4) com `can_delete_drivers = true`

### Tabela `workshops` RLS:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master
- INSERT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master
- UPDATE: Fleet Analyst (rank 4)+ do próprio tenant + Admin Master
- DELETE: Manager(5)+ OU Fleet Analyst(4) com `can_delete_workshops = true`
- Unique constraint: `(client_id, cnpj)`
- Especialidades: array `TEXT[]` com 10 valores predefinidos (Mecânica Geral, Elétrica, Funilaria/Pintura, Pneus, Ar Condicionado, Suspensão, Freios, Injeção Eletrônica, Câmbio/Transmissão, Refrigeração Baú)

### Row Level Security (RLS)
- Todas as tabelas devem ter RLS habilitado
- Padrão: filtrar por `client_id` do usuário autenticado
- Admin Master: pode acessar dados de todos os clientes

## Storage

### Bucket `vehicle-documents` (Público)
- **Uso**: Armazena CRLV, Inspeção Sanitária e GR dos veículos.
- **Estrutura**: `{client_id}/{vehicle_id}/{docType}.{ext}`
- **Tipos**: `crlv`, `sanitary-inspection`, `gr`.
- **Otimização**: Imagens comprimidas client-side antes do upload (max 1920px, 82% JPEG). PDFs enviados originais.
- **Policies**:
  - SELECT: Público.
  - INSERT/UPDATE/DELETE: Usuários autenticados (verificável via client_id no path).

### Bucket `driver-documents` (Público)
- **Uso**: Armazena CNH, GR do motorista e até 3 certificados.
- **Estrutura**: `{client_id}/{driver_id}/{docType}.{ext}`
- **Tipos**: `cnh`, `gr`, `certificate-1`, `certificate-2`, `certificate-3`.
- **Otimização**: Mesma lógica do bucket vehicle-documents (compressão de imagens, PDFs originais).
- **Formatos aceitos**: PDF, JPG, PNG, WEBP. Máximo 10MB por arquivo.
- **Policies**: Idênticas ao bucket vehicle-documents.

## Edge Functions

### `create-user` (ativa, deployed)
- Cria/deleta usuário (auth + profile)
- Mantém 3 flags de permissão no perfil: `can_delete_vehicles`, `can_delete_drivers`, `can_delete_workshops`
- Validação de hierarquia de roles (não pode criar role >= próprio)
- Endpoint: `POST /functions/v1/create-user`
- Requer `Authorization: Bearer <session_token>`
- Código fonte: `supabase/functions/create-user/index.ts`

### `create-user-tenant` (ABANDONADA)
- Teve problemas persistentes de 401
- Arquivo existe em `supabase/functions/create-user-tenant/index.ts` mas NÃO está deployed

## Variáveis de Ambiente

```bash
# .env.local (não commitado)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=...              # Exposto via vite.config.ts define

# Credenciais de teste E2E
TEST_ADMIN_EMAIL=...
TEST_ADMIN_PASSWORD=...
TEST_ANALYST_EMAIL=...
TEST_ANALYST_PASSWORD=...
TEST_ASSISTANT_EMAIL=...
TEST_ASSISTANT_PASSWORD=...
TEST_MANAGER_EMAIL=...
TEST_MANAGER_PASSWORD=...
```

## Schema SQL

- Arquivo: `supabase/schema.sql`
- Contém DDL para tabelas e políticas RLS
- Executar manualmente no Supabase SQL Editor

## Módulo de Gestão de Pneus

**Migration:** `supabase/migrations/20260324000000_create_tire_management.sql`
⚠️ EXECUTAR NO SUPABASE DASHBOARD

**Migration (configuração de eixos):** `supabase/migrations/20260325081826_add_axle_config_vehicles.sql`
⚠️ EXECUTAR NO SUPABASE DASHBOARD
- `ALTER TABLE vehicles ADD COLUMN axle_config JSONB DEFAULT NULL`
- `ALTER TABLE vehicles ADD COLUMN steps_count INTEGER DEFAULT NULL`
- Atualiza CHECK de `position_type` em `tires` para incluir `triple_external`, `triple_middle`, `triple_internal`

### Tabelas

**`tires`**
- Colunas: id, client_id, vehicle_id, tire_code, specification, dot, fire_marking, manufacturer, brand, rotation_interval_km, useful_life_km, retread_interval_km, visual_classification (CHECK: Novo/Meia vida/Troca), current_position, last_position, position_type (CHECK: single/dual_external/dual_internal/spare), active, created_by, updated_by, created_at, updated_at
- UNIQUE(client_id, tire_code)
- Partial UNIQUE index: `(vehicle_id, current_position) WHERE active = true`

**`tire_position_history`** (append-only)
- Colunas: id, client_id, tire_id, vehicle_id, previous_position (NULL no cadastro), new_position, moved_at, moved_by, reason, odometer_km

**`vehicle_tire_configs`**
- Seed: Moto(1,0,[]), Passeio/Utilitário/Van/Vuc(2,1,[]), Toco(2,1,[2]), Truck(3,1,[2,3]), Cavalo(3,2,[2,3])
- Admin Master-only para INSERT/UPDATE/DELETE

### RLS
- **tires SELECT:** role_rank >= 3 (Fleet Assistant+) + mesmo tenant OU Admin Master
- **tires INSERT/UPDATE:** Manager/Coordinator/Director/Admin Master
- **tires DELETE:** Director/Admin Master (policy `tires_delete` com bypass de client_id para Admin Master); frontend restringe a Admin Master apenas
- **tire_position_history:** SELECT (Fleet Assistant+); INSERT (Manager+); sem UPDATE/DELETE para não-Admin; ON DELETE CASCADE ao deletar tire
- **vehicle_tire_configs:** SELECT (qualquer authenticated); CUD (Admin Master apenas)
