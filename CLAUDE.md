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

## Registro de Mudanças (Sessão Atual)

- **Módulo de Veículos**: Atualizado `VehicleForm.tsx` com campos obrigatórios dinâmicos, novos uploads (Sanitária e GR) e suporte a múltiplos tipos de veículos.
- **Módulo de Motoristas**: Implementado CRUD completo em `Drivers.tsx` com `DriverForm.tsx`, incluindo upload de CNH, GR e até 3 certificados (armazenados em bucket `driver-documents`).
- **Configurações Dinâmicas**: Centralizadas em `Settings.tsx`, permitindo configurar campos obrigatórios tanto para Veículos quanto para Motoristas por cliente.
- **Permissões de Exclusão**: Separadas as permissões de exclusão de veículos (`can_delete_vehicles`) e motoristas (`can_delete_drivers`) na tabela `profiles`, com interface de gestão em `Users.tsx`.
- **Módulo de Oficinas**: Implementado CRUD completo em `Workshops.tsx` com `WorkshopForm.tsx`, incluindo gestão de endereços e especialidades técnica. Validado com Testes E2E (Manager e Analyst).
- **UX Responsiva**: Implementado Menu Mobile (Drawer) com botão hamburger no Topbar e overlay inteligente para melhor experiência em smartphones.
- **Deploy & Hosting**: Adicionado `vercel.json` e orientações de deploy do frontend na Vercel com conexão ao Supabase.
- **Seeding de Veículos**: Cadastrados 6 novos veículos (VEC0001-VEC0006) com preenchimento completo de garantia, revisão e seguro. Identificada limitação de upload (403) no perfil de Assistente, com bypass realizado via Analista.
- **Auto-Sync**: Atualizados manuais em `.claude/` (Frontend, Backend, Testing, Data Model) com as novas funcionalidades e melhorias de UX.
