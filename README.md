# βetaFleet — Sistema de Gestão de Frotas

Plataforma robusta de gestão de frotas logísticas com foco em controle operacional, manutenção preventiva, gestão de pneus e compliance documental.

## 🎯 Objetivo

Oferecer uma visão centralizada e orientada a dados para empresas de logística, otimizando custos e reduzindo o tempo de indisponibilidade da frota.

---

## ✨ Principais Funcionalidades

- **Dashboard Operacional** — Monitoramento de vencimentos de CRLV, CNH e checklists pendentes com KPIs em tempo real
- **Painel de Custos** — Análise de custos de manutenção, custo por KM e orçamentos aprovados
- **Gestão de Pneus** — Controle detalhado de ciclos de vida, rodízios, recapagens e classificação visual por posição
- **Gestão de Manutenção** — Ordens de serviço internas/externas, fluxos de aprovação de orçamentos e acompanhamento de tempo em oficina
- **Checklists** — Templates customizáveis para inspeção de rotina e segurança com hodômetro integrado
- **Gestão de Documentos** — Alertas de vencimento e armazenamento de PDFs (orçamentos, CNHs, CRLVs)

---

## 🛠️ Tech Stack

| Área | Tecnologias |
|------|-------------|
| **Frontend** | React 19, TypeScript, Vite |
| **Estilização** | Tailwind CSS 4 |
| **Backend/Banco** | Supabase (PostgreSQL), Edge Functions |
| **UI/Gráficos** | Lucide React, Motion, Recharts |
| **Testes** | Playwright (E2E) |

---

## 💰 Valor de Negócio

- **Redução de Custos Operacionais** — Otimização do ciclo de vida dos pneus e redução de manutenções corretivas
- **Aumento da Disponibilidade** — Monitoramento de "Dias em Oficina" para otimização de paradas
- **Compliance e Segurança** — Gestão ativa de vencimentos legais de documentos e veículos
- **Transparência Financeira** — Fluxo de aprovação de orçamentos auditável

---

## 🚀 Quick Start

### Requisitos

- Node.js 18+
- Conta Supabase com projeto criado

### Setup Inicial

1. **Clone e instale dependências:**
   ```bash
   npm install
   ```

2. **Configure variáveis de ambiente** — Crie `.env.local` na raiz:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   GEMINI_API_KEY=sua-chave-gemini  # Para OCR
   ```

3. **Inicie o dev server:**
   ```bash
   npm run dev
   ```

4. **Acesse em:** http://localhost:3000

### Comandos Úteis

```bash
npm run lint              # Type-check (tsc --noEmit)
npm run build             # Build para produção
npm run preview           # Preview do build
npm run test:e2e          # Rodar testes E2E (Playwright)
npm run test:e2e:ui       # Playwright UI para debugging
npm run test:e2e:report   # Relatório HTML de execuções
```

---

## 📚 Documentação

| Documento | Propósito |
|-----------|-----------|
| **[CLAUDE.md](CLAUDE.md)** | Instruções para IA — router de contexto, padrões, estrutura |
| **[CHANGELOG.md](CHANGELOG.md)** | Histórico detalhado de features e correções |
| **[.claude/arch-frontend.md](.claude/arch-frontend.md)** | Arquitetura frontend, componentes, padrões React |
| **[.claude/arch-backend.md](.claude/arch-backend.md)** | Supabase, RLS, migrations, Edge Functions |
| **[.claude/data-model.md](.claude/data-model.md)** | Types, interfaces, schema, multi-tenancy |

---

## 🏗️ Estrutura do Projeto

```
src/
  ├── pages/              # Páginas principais (Dashboard, Vehicles, Tires, etc)
  ├── components/         # Componentes reutilizáveis
  ├── lib/                # Utilitários (mappers, queries, helpers)
  ├── context/            # AuthContext, multi-tenancy
  └── types.ts            # Type-safe interfaces

.claude/
  ├── arch-frontend.md    # Frontend architecture
  ├── arch-backend.md     # Backend & database
  ├── data-model.md       # Types & schema
  ├── style-guide.md      # Code conventions
  ├── testing.md          # E2E testing patterns
  └── troubleshooting.md  # Common gotchas

supabase/
  ├── migrations/         # SQL migrations (executadas manualmente)
  └── functions/          # Edge Functions
```

---

## 👥 Papéis e Permissões

Sistema multi-tenant com 6 papéis. Veja [CLAUDE.md > Referência Rápida de Papéis](CLAUDE.md#referência-rápida-de-papéis-roles) para detalhes.

| Role | Permissões |
|------|-----------|
| **Admin Master** | Sistema inteiro, todos os clientes |
| **Manager** | Todas as abas do cliente, gestão de usuários |
| **Fleet Assistant** | Veículos, checklists, manutenção, configurações |
| **Supervisor** | Checklists, manutenção, planos de ação (coordenação) |
| **Driver** | Checklists, dados pessoais, veículos atribuídos |
| **Workshop** | Visão de manutenção, atualiza OS com orçamento |

---

## 🔄 Fluxo de Migrations

Migrations SQL em `supabase/migrations/` são **executadas manualmente** no Supabase Dashboard (SQL Editor).

**Checklist ao criar migration:**
1. Arquivo: `YYYYMMDDHHMMSS_descricao.sql`
2. Suporte a multi-tenancy (use `client_id` em WHERE e RLS)
3. Commit do arquivo
4. Marque com flag `⚠️ EXECUTAR NO SUPABASE DASHBOARD`
5. Executor copia SQL e executa no Dashboard
6. Remova a flag após execução

Veja [CLAUDE.md > Fluxo de Migrations](CLAUDE.md#fluxo-de-migrations-do-supabase) para detalhes completos.

---

## 📝 Notas Importantes

- **RLS & Admin Master**: Sempre use `OR role = 'Admin Master'` em checks de `client_id` (Admin Master tem `client_id = NULL`)
- **Migrations**: Consultadas em `CHANGELOG.md` para histórico de alterações de schema
- **Testes**: E2E com Playwright — sem testes unitários. Confiança via type-check + integração real

---

## 📖 Primeiros Passos

**Novo no projeto?**
1. Leia este README (você está aqui!)
2. Configure `.env.local` e rode `npm run dev`
3. Consulte [CLAUDE.md](CLAUDE.md) para entender padrões de desenvolvimento
4. Veja [.claude/arch-frontend.md](.claude/arch-frontend.md) ou [.claude/arch-backend.md](.claude/arch-backend.md) conforme sua área

---

**Desenvolvido com ❤️ para otimizar frotas logísticas**
