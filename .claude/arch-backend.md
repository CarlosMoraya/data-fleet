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
- `vehicles` — veículos da frota (CRUD completo com RLS); coluna `driver_id UUID NULL FK → drivers(id) ON DELETE SET NULL` + índice único parcial `WHERE driver_id IS NOT NULL` garante associação 1:1 motorista×veículo
- `vehicle_field_settings` — configurações dinâmicas de campos obrigatórios de veículo por cliente
- `drivers` — motoristas (CRUD com RLS, CPF único por cliente, 5 uploads de documento)
- `driver_field_settings` — configurações dinâmicas de campos obrigatórios de motorista por cliente
- `workshops` — oficinas parceiras (CRUD com RLS, CNPJ único por cliente, sem uploads)

### Tabelas de Checklists (criadas em `create_checklist_tables.sql` + migrations adicionais)
- `checklist_item_suggestions` — banco global de sugestões por categoria de veículo (Leve/Médio/Pesado/Elétrico). Sem `client_id`. Seed com ~45 itens pré-populados. SELECT para qualquer autenticado.
- `checklist_templates` — templates por cliente com ciclo `draft → published → deprecated`. Colunas: `context` TEXT NOT NULL DEFAULT 'Rotina' CHECK IN ('Rotina','Auditoria','Reboque','Entrada em Oficina','Saída de Oficina','Segurança'), `vehicle_category` NOT NULL, `current_version`, `allow_driver_actions`, `allow_auditor_actions`. EXCLUDE constraint `unique_published_category_context` via btree garante 1 published por (client, category, context). INSERT/UPDATE: Manager+. Nome do template gerado automaticamente como `"Checklist [Categoria] [Contexto]"`.
- `checklist_template_versions` — snapshots imutáveis ao publicar. UNIQUE (template_id, version_number).
- `checklist_items` — itens por (template_id, version_number). Coluna `can_block_vehicle BOOLEAN NOT NULL DEFAULT false` — ativado em templates de Segurança. Durante draft, itens editáveis livremente. Publicado: snapshot congelado.
- `checklists` — instâncias preenchidas. `vehicle_id` obrigatório. `workshop_id UUID NULL FK → workshops(id) ON DELETE SET NULL` — preenchido nos contextos Entrada/Saída de Oficina. `status` IN ('in_progress','completed'). DELETE: APENAS Admin Master.
- `checklist_responses` — respostas por item (ok/issue/skipped/not_applicable). CASCADE delete do checklist pai. UNIQUE (checklist_id, item_id).
- `action_plans` — ações geradas automaticamente para itens 'issue'. Campos v1: `suggested_action`, `observed_issue`, `photo_url`, `status` (pending/in_progress/awaiting_conclusion/completed/cancelled), `work_order_number`. Campos v2 (`add_action_plan_v2.sql`): `name`, `responsible_id`, `due_date`, `assigned_by`, `claimed_by`, `claimed_at`, `conclusion_evidence_url`. INSERT: Fleet Analyst+ do tenant ou Admin Master. DELETE: APENAS Admin Master.

### Storage Buckets
- `vehicle-documents` — CRLV, inspeção sanitária, GR para veículos + evidências de planos de ação (`{client_id}/action-plans/{plan_id}/evidence.{ext}`)
- `driver-documents` — CNH, GR, certificados para motoristas
- `checklist-photos` — fotos capturadas via câmera durante checklists. Path: `{client_id}/{checklist_id}/{item_id}/{timestamp}.jpg`. Políticas via `create_checklist_photos_bucket.sql`: SELECT público; INSERT/UPDATE para qualquer autenticado do tenant (Driver, Auditor, etc.); DELETE apenas Fleet Analyst+

### Migrations Ativas
- `create_drivers_tables.sql` — tabelas `drivers` e `driver_field_settings`
- `add_driver_profile_link.sql` — adiciona coluna `profile_id UUID UNIQUE FK → profiles(id)` + INDEX `idx_drivers_profile_id` na tabela `drivers` para ligar cada motorista a seu perfil de usuário do sistema (2026-03-14)

### RLS — Padrões de Checklists
- `checklists` SELECT: Driver/Auditor vê os próprios; Fleet Assistant+ vê todo o tenant; Admin Master vê tudo
- `checklists` DELETE: APENAS Admin Master (exclusão hard-delete para trilha de auditoria)
- `action_plans` SELECT/UPDATE: Fleet Assistant+ do tenant
- `action_plans` DELETE: APENAS Admin Master

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
