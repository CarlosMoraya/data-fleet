# Arquitetura Backend (Supabase)

## Infraestrutura

- **Supabase** como BaaS (Auth, Database, Edge Functions)
- **Sem CLI instalado** — deploy de Edge Functions via Supabase Dashboard UI
- Client config: `src/lib/supabase.ts` usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

## Autenticação

- **Supabase Auth** com email/senha
- `AuthContext.tsx` expõe `useAuth()` hook → `{ user, currentClient, signIn, signOut }`
- Session persistida via Supabase (localStorage)
- Perfil do usuário armazenado na tabela `profiles` (id, name, email, role, client_id)

## Banco de Dados

### Tabelas existentes
- `profiles` — dados do usuário (vinculado a auth.users)
- `clients` — tenants/empresas
- `vehicles` — veículos da frota (CRUD completo com RLS)

### Tabelas planejadas (ainda não criadas)
- `checklist_templates` — templates de checklist por tipo de veículo
- `checklists` — checklists preenchidos

### Tabela `vehicles` — colunas principais
`id`, `client_id`, `type`, `energy_source`, `cooling_equipment`, `semi_reboque`, `placa_semi_reboque`, `fuel_type`, `tank_capacity`, `avg_consumption`, `cooling_brand`, `license_plate`, `renavam`, `chassi`, `detran_uf`, `brand_model`, `year`, `color`, `acquisition`, `fipe_price`, `tracker`, `antt`, `owner`, `status`, `autonomy`, `crlv_upload`, `created_at`, `updated_at`

RLS vehicles:
- SELECT: Fleet Assistant (rank 3)+ do próprio tenant + Admin Master (cross-tenant)
- INSERT/UPDATE/DELETE: Fleet Analyst (rank 4)+ do próprio tenant + Admin Master
- Unique index em `(client_id, license_plate)`

### Row Level Security (RLS)
- Todas as tabelas devem ter RLS habilitado
- Padrão: filtrar por `client_id` do usuário autenticado
- Admin Master: pode acessar dados de todos os clientes

## Edge Functions

### `create-user` (ativa, deployed)
- Cria novo usuário (auth + profile) ou deleta usuário existente
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
