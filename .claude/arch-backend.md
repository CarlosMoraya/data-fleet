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

### Tabelas planejadas (ainda não criadas)
- `checklist_templates` — templates de checklist por tipo de veículo
- `checklists` — checklists preenchidos

### Tabela `vehicles` — colunas principais
`id`, `client_id`, `type` (Passeio a Cavalo), `energy_source`, `cooling_equipment`, `semi_reboque`, `placa_semi_reboque`, `fuel_type`, `tank_capacity`, `avg_consumption`, `cooling_brand`, `license_plate`, `renavam`, `chassi`, `detran_uf`, `brand`, `model`, `year`, `color`, `acquisition`, `acquisition_date`, `fipe_price`, `tracker`, `antt`, `owner`, `status`, `autonomy`, `tag`, `crlv_upload`, `sanitary_inspection_upload`, `gr_upload`, `gr_expiration_date`, `spare_key`, `vehicle_manual`, `category`, `created_at`, `updated_at`

RLS vehicles:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master (cross-tenant)
- INSERT/UPDATE: Fleet Analyst (rank 4)+ do próprio tenant + Admin Master
- DELETE: Manager(5)+ OU Fleet Analyst(4) com `can_delete_vehicles = true`
- Unique index em `(client_id, license_plate)`

### Tabela `drivers` RLS:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant
- INSERT/UPDATE: Fleet Analyst (rank 4)+ do próprio tenant
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
