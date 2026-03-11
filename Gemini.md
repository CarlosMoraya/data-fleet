# Gemini.md — Context Router

> **Instrução de Entrada**: Sempre leia este índice antes de qualquer ação. Identifique a categoria da tarefa e carregue o módulo de contexto correspondente usando a ferramenta `view_file` ANTES de codificar.

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

Antes de codificar, carregue o módulo relevante com a ferramenta `view_file` no arquivo correspondente (baseado na raiz do projeto):

| Categoria | Quando usar | Arquivo a ler (`view_file`) |
|-----------|-------------|---------|
| **Frontend** | Componentes React, páginas, routing, layout, Tailwind | `.claude/arch-frontend.md` |
| **Backend** | Supabase, auth, Edge Functions, RLS, banco de dados | `.claude/arch-backend.md` |
| **Testes** | Escrever/rodar E2E, Playwright, fixtures, debugging | `.claude/testing.md` |
| **Estilo** | Convenções de código, nomenclatura, padrões React/TS | `.claude/style-guide.md` |
| **Modelo de Dados** | Types, interfaces, roles, multi-tenancy, schema | `.claude/data-model.md` |

**Regra**: Para tarefas que cruzam múltiplas categorias, carregue todos os módulos relevantes. Ex: criar uma nova página com CRUD Supabase → carregue Frontend + Backend + Modelo de Dados.

---

## Protocolo de Auto-Sincronização

> **DIRETRIZ RÍGIDA**: Se você alterar ferramentas, bibliotecas, padrões arquiteturais, interfaces, tabelas do banco, configuração de testes ou convenções de código, sua **última ação obrigatória ANTES de finalizar a tarefa** deve ser atualizar o arquivo correspondente na pasta `.claude/` (utilize `replace_file_content` ou ferramentas de escrita de arquivo apropriadas).

Checklist de sincronização:
- [ ] Adicionou/removeu dependência → atualizar `.claude/arch-frontend.md` ou `.claude/arch-backend.md`
- [ ] Criou/alterou interface/type → atualizar `.claude/data-model.md`
- [ ] Criou/alterou tabela Supabase ou RLS → atualizar `.claude/arch-backend.md` + `.claude/data-model.md`
- [ ] Adicionou/alterou página ou componente → atualizar `.claude/arch-frontend.md`
- [ ] Adicionou/alterou teste E2E → atualizar `.claude/testing.md`
- [ ] Mudou convenção ou padrão → atualizar `.claude/style-guide.md`

---

## Identificação do Projeto

**Data Fleet** — SaaS multi-tenant de gestão de frotas.
Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase.
---

## Registro de Mudanças (Sessão Atual)

- **Módulo de Veículos**: Atualizado `VehicleForm.tsx` com campos obrigatórios dinâmicos, novos uploads (Sanitária e GR) e suporte a múltiplos tipos de veículos.
- **Banco de Dados**: Corrigida a constraint `vehicles_type_check` no Supabase para aceitar os tipos em português (Passeio, Vuc, etc.).
- **Configurações Dinâmicas**: Lançada tabela `vehicle_field_settings` para controle per-client de campos obrigatórios do veículo.
- **Testes E2E (Playwright)**:
    - Criados testes de permissão por papel (Manager, Analyst, Assistant).
    - Implementado script de *seeding* automático (`tenant-users-manager-seed.spec.ts`) para massa de dados.
- **Auto-Sync**: Atualizados manuais em `.claude/` (Frontend, Backend, Testing, Data Model) com as novas regras de negócios.
