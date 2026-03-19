# CLAUDE.md — Context Router

> **Instrução de Entrada**: Sempre leia este índice antes de qualquer ação. Identifique a categoria da tarefa e carregue o módulo de contexto correspondente ANTES de codificar.

---

## Atalhos Rápidos

```bash
npm run dev       # Dev server (porta 3000)
npm run lint      # Type-check (tsc --noEmit)
npm run build     # Build produção
npm run preview   # Preview do build
npx playwright test  # Rodar testes E2E
```

---

## Mapa de Roteamento de Contexto

Antes de codificar, carregue o módulo relevante com `cat`:

| Categoria | Quando usar | Comando |
|-----------|-------------|---------|
| **Frontend** | Componentes React, páginas, routing, layout, Tailwind | `cat .claude/arch-frontend.md` |
| **Backend** | Supabase, auth, Edge Functions, RLS, banco de dados | `cat .claude/arch-backend.md` |
| **Testes** | Escrever/rodar E2E, Playwright, fixtures, debugging | `cat .claude/testing.md` |
| **Estilo** | Convenções de código, nomenclatura, padrões React/TS | `cat .claude/style-guide.md` |
| **Modelo de Dados** | Types, interfaces, roles, multi-tenancy, schema | `cat .claude/data-model.md` |

**Regra**: Para tarefas que cruzam múltiplas categorias, carregue todos os módulos relevantes. Ex: criar uma nova página com CRUD Supabase → carregue Frontend + Backend + Modelo de Dados.

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

## Gestão de Memória (Gatilho /compact)

Após concluir tarefas que envolveram leitura de **2 ou mais módulos de contexto** da pasta `.claude/`, você **DEVE**:

1. Sugerir ao usuário: _"Tarefa concluída. Recomendo executar `/compact` para limpar a janela de contexto e economizar tokens."_
2. Ou executar `/compact` automaticamente se a janela de contexto estiver acima de 70% de utilização.

Isso garante que sessões longas não degradem a qualidade das respostas por saturação de contexto.

---

## Identificação do Projeto

**Data Fleet** — SaaS multi-tenant de gestão de frotas.
Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase.
Para detalhes completos, consulte os módulos em `.claude/`.

---

## Correções Recentes (2026-03-18)

**Correções de Bugs de Multi-Tenancy e RLS:**

1. **Maintenance.tsx** — Query não filtrava por `client_id` quando cliente era selecionado no dropdown. Admin Master via sempre os mesmos dados (Grupo LLE) independente do cliente selecionado.
   - Alteração: Adicionado `.eq('client_id', currentClient.id)` na query quando `currentClient?.id` existe
   - Arquivo: `src/pages/Maintenance.tsx`

2. **BudgetApprovals.tsx** — Mesmo problema: query sem filtro por `client_id`. Removido também o `enabled: expanded` desnecessário que fazia subtotal sumir após refresh.
   - Alteração: Adicionado filtro `client_id` + removido `enabled: expanded` de budgetItems query
   - Arquivo: `src/pages/BudgetApprovals.tsx`

3. **Users.tsx + AdminUsers.tsx** — Token JWT expirado ao editar usuário (erro "JWT expired"). SDK do Supabase não fazia refresh automático antes de operações críticas.
   - Alteração: Adicionado `await supabase.auth.refreshSession()` antes do `.update()` nas mutations
   - Arquivos: `src/pages/Users.tsx`, `src/pages/AdminUsers.tsx`

4. **CreateActionPlanModal.tsx** — Admin Master bloqueado de criar planos de ação por bug de RLS no banco.
   - Alteração: Melhorado tratamento de erro para exibir mensagem real do Supabase (não genérica)
   - Arquivo: `src/components/CreateActionPlanModal.tsx`
   - **Correção de BD**: Nova migration `supabase/migrations/fix_action_plans_admin_master_rls.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Causa Raiz de action_plans RLS:**
- Admin Master tem `client_id = NULL` no profile
- Migration `add_supervisor_coordinator_roles.sql` usava `client_id IN (SELECT client_id FROM profiles WHERE ... OR role = 'Admin Master')`
- Em SQL, `coluna IN (NULL)` é sempre UNKNOWN (nunca TRUE) → Admin Master ficava bloqueado
- Solução: Usar `EXISTS` com check direto `p.role = 'Admin Master'` em vez de depender de `client_id`

---

## Histórico de Mudanças

Consulte [CHANGELOG.md](CHANGELOG.md) para o histórico detalhado de todas as sessões.