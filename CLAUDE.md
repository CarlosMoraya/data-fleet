# CLAUDE.md — Context Router

> **Instrução de Entrada**: Sempre leia este índice antes de qualquer ação. Identifique a categoria da tarefa e carregue o módulo de contexto correspondente ANTES de codificar.

---

## Atalhos Rápidos

```bash
npm run dev              # Dev server (porta 3000)
npm run lint             # Type-check (tsc --noEmit)
npm run build            # Build produção
npm run preview          # Preview do build
npm run test:e2e         # Rodar todos os testes E2E (Playwright)
npm run test:e2e:ui      # Abrir Playwright UI para debugging
npm run test:e2e:report  # Visualizar relatório HTML de últimas execuções
npm run test:shippers    # Rodar apenas testes de embarcadores
npm run migrate:shippers # Executar migration de dados de embarcadores
```

---

## Configuração de Ambiente

**Requisitos:**
- Node.js 18+
- Conta Supabase com projeto criado

**Passos Iniciais:**

1. Clone o repositório e instale dependências:
   ```bash
   npm install
   ```

2. Crie arquivo `.env.local` na raiz do projeto:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   GEMINI_API_KEY=sua-chave-gemini  # Para funcionalidade OCR
   ```

3. Verifique variáveis no `vite.config.ts` — apenas `VITE_*` são expostas ao navegador.

**Nota sobre Migrations:** Migrations SQL criadas em `supabase/migrations/` são executadas manualmente no **Supabase Dashboard** (SQL Editor). Veja seção "Fluxo de Migrations" abaixo.

---

## Mapa de Roteamento de Contexto

**Antes de codificar**, carregue o módulo relevante com `cat`:

| Categoria | Quando usar | Comando |
|-----------|-------------|---------|
| **Frontend** | Componentes React, páginas, routing, layout, Tailwind | `cat .claude/arch-frontend.md` |
| **Backend** | Supabase, auth, Edge Functions, RLS, banco de dados | `cat .claude/arch-backend.md` |
| **Testes** | Escrever/rodar E2E, Playwright, fixtures, debugging | `cat .claude/testing.md` |
| **Estilo** | Convenções de código, nomenclatura, padrões React/TS | `cat .claude/style-guide.md` |
| **Modelo de Dados** | Types, interfaces, roles, multi-tenancy, schema | `cat .claude/data-model.md` |
| **Troubleshooting** | Gotchas comuns, erros conhecidos, debugging | `cat .claude/troubleshooting.md` |

**Regra**: Para tarefas que cruzam múltiplas categorias, carregue todos os módulos relevantes. Ex: criar nova página com CRUD Supabase → carregue Frontend + Backend + Modelo de Dados.

---

## Protocolo de Auto-Sincronização

> **DIRETRIZ RÍGIDA**: Se você alterar ferramentas, bibliotecas, padrões arquiteturais, interfaces, tabelas do banco, configuração de testes ou convenções de código, sua **última ação obrigatória ANTES do commit** deve ser atualizar o módulo correspondente na pasta `.claude/`.

Checklist de sincronização:
- [ ] Adicionou/removeu dependência → atualizar `arch-frontend.md` ou `arch-backend.md`
- [ ] Criou/alterou interface/type → atualizar `data-model.md`
- [ ] Criou/alterou tabela Supabase ou RLS → atualizar `arch-backend.md` + `data-model.md`
- [ ] Adicionou/alterou página ou componente → atualizar `arch-frontend.md`
- [ ] Adicionou/alterou teste E2E → atualizar `testing.md`
- [ ] Mudou convenção ou padrão → atualizar `style-guide.md`

---

## Fluxo de Migrations do Supabase

**Padrão Atual:** Migrations SQL são criadas em `supabase/migrations/` mas **executadas manualmente** via Supabase Dashboard.

**Por que manual?** Projeto usa Supabase sem CLI de deployment automático. Isso garante controle total sobre quando schema é alterado e permite rollback manual se necessário.

**Checklist ao Criar Nova Migration:**

1. Crie arquivo em `supabase/migrations/` com naming: `YYYYMMDDHHMMSS_descricao.sql`
2. Escreva SQL com suporte a múltiplos tenants (use `client_id` em WHERE clauses e RLS policies)
3. Teste localmente contra Supabase dev/sandbox
4. Commit do arquivo
5. **ANTES de mergear:** adicione flag `⚠️ EXECUTAR NO SUPABASE DASHBOARD` ao CHANGELOG.md
6. Após merge, executor (usuário com acesso Supabase) copia SQL do arquivo e executa no **Supabase Dashboard → SQL Editor**
7. Confirme execução com sucesso (sem erros)
8. Remova flag `⚠️` do CHANGELOG.md

**Tipos Comuns de Migrations:**
- `ALTER TABLE ... ADD COLUMN` — adiciona campo, declare tipo e constraint
- `CREATE TABLE ... WITH (RLS ENABLED)` — nova tabela sempre com RLS policies
- `CREATE POLICY ... ON table_name` — políticas de segurança por role
- `ALTER TYPE status ADD VALUE 'NewStatus'` — expande enum (APPEND ONLY, sem remover)

**Verificação de RLS:** Após executar, valide que políticas foram criadas corretamente — Admin Master (`client_id = NULL`) frequentemente precisa de `OR role = 'Admin Master'` em WHEREs.

---

## Identificação do Projeto

**βetaFleet** — SaaS multi-tenant de gestão de frotas.
Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase.
Para detalhes completos, consulte os módulos em `.claude/`.

---

## Referência Rápida de Papéis (Roles)

Sistema é multi-tenant com 6 papéis por rank (descendente de permissão). **`client_id`** diferencia tenants; **Admin Master** tem `client_id = NULL`.

| Role | Rank | Acesso | Notas |
|------|------|--------|-------|
| **Admin Master** | 0 | Sistema inteiro, todos os clientes | Sem `client_id`; precisa de `OR role = 'Admin Master'` em RLS |
| **Manager** | 2 | Todas as abas do cliente; usuários, oficinas, configurações | Acesso total dentro do tenant |
| **Fleet Assistant** | 3 | Veículos, checklists, manutenção | Sem acesso a Usuários nem Configurações; pode criar/editar workshops |
| **Supervisor** | 4 | Checklists, manutenção, planos de ação (coordenação) | Apenas leitura de usuários/oficinas |
| **Driver** | 5 | Preenchimento de checklists, dados pessoais | Acesso a veículos atribuídos apenas |
| **Workshop** | 1 | Visão de manutenção, atualiza OS com orçamento/status | Login próprio; acesso a veículos em suas OS |

**Guardrails Comuns:**
- `ROLES_CAN_ACCESS_SETTINGS`: Coordinator, Manager, Director, Admin Master (excluir Fleet Assistant, Fleet Analyst, Supervisor)
- `ROLES_CAN_EDIT_MAINTENANCE`: Manager+, Fleet Assistant, Workshop (update parcial)
- `ROLES_CAN_CREATE_WORKSHOP`: Manager+, Fleet Assistant
- `isWorkshopUser`: Deteta Workshop via `workshopId` em AuthContext — adapta UI (Manutenção apenas, UPDATE parcial)

**Admin Master Gotcha:** Sempre use `OR role = 'Admin Master'` em RLS checks de coluna `client_id`, pois Admin Master tem `client_id = NULL`.

---

## Mapa de Localização de Código — Áreas Principais

| Área | Localização | Módulo Contexto |
|------|-------------|-----------------|
| **Autenticação & Contexto** | `src/context/AuthContext.tsx`, `src/pages/Login.tsx` | Backend + Frontend |
| **Estrutura de Páginas** | `src/pages/` (Dashboard, Vehicles, Drivers, Checklists, Maintenance, etc.) | Frontend |
| **Componentes Reutilizáveis** | `src/components/` (Forms, Modals, Sidebar, Dashboard) | Frontend |
| **Mapeadores de Dados** | `src/lib/*Mappers.ts` (vehicleMappers, checklistMappers, etc.) | Frontend |
| **Queries React-Query** | Inline em páginas; `queryKey` pattern: `['resource', filter1, filter2]` | Frontend |
| **Edge Functions** | `supabase/functions/create-user/`, `supabase/functions/...` | Backend |
| **Migrations & RLS** | `supabase/migrations/`, `supabase/policies/` | Backend |
| **Testes E2E** | `e2e/` (Playwright fixtures, specs, utilities) | Testing |
| **Tipos & Interfaces** | `src/types.ts` (type-safe, sincronizar com DB schema) | Data Model |
| **Estilos Tailwind** | Inline com `className=` + `tailwind.config.ts` | Frontend |

---

## Histórico de Mudanças

Consulte [CHANGELOG.md](CHANGELOG.md) para o histórico detalhado de todas as sessões e novos recursos implementados.
