# AGENT-FRONTEND - Padrões de Interface e React

O frontend do **βetaFleet** é uma SPA (Single Page Application) moderna construída com React 19 e Vite.

## 🛠️ Tech Stack
- **Framework**: React 19 (Functional Components + Hooks).
- **Build Tool**: Vite (porta 3000).
- **Estilização**: Tailwind CSS v4.
- **Gráficos**: Recharts.
- **Offline Storage**: Dexie (IndexedDB).

---

## 📂 Estrutura de Diretórios (Destaques)

- `src/components/`: Componentes reutilizáveis (Layout, Sidebar, Forms).
- `src/hooks/`: Lógica compartilhada (`useAuth`, `useOnlineStatus`).
- `src/lib/`: Bibliotecas e utilitários (Supabase client, Mappers, Helpers).
- `src/pages/`: Componentes de página e roteamento.

---

## 🚀 Padrões de Desenvolvimento

### 1. Roteamento (App.tsx)
- Rotas protegidas sob o componente `<Layout />`.
- Sub-rotas aninhadas em `/cadastros/` (Veículos, Motoristas, etc).
- **Guards**: Redirects automáticos baseados no rank do usuário.

### 2. Gestão de Estado (React Query)
- **Cache**: `staleTime` de 3 minutos para navegação fluida.
- **Offline**: Queries de preenchimento de checklist usam `networkMode: 'offlineFirst'`.

### 3. Persistência de Estado de UI
- Todo estado de UI persistido deve usar o hook padrão em `src/hooks/usePersistentUiState.ts` ou o utilitário puro em `src/lib/uiStateStorage.ts`.
- Chaves obrigatoriamente seguem o formato `bf:v1:ui:{scope}:{userId}:{clientId}:{module}:{stateKind}:{name}`.
- Escopos: `session` (sessionStorage), `preference` (localStorage), `draft` (sessionStorage).
- Nunca usar `sessionStorage.setItem` ou `localStorage.setItem` diretamente para estado de UI — sempre passar pelo hook ou utilitário.
- Dados sensíveis (senha, CPF, CNH, documento) nunca devem ser persistidos em storage simples.

---

## 📴 Infraestrutura Offline (Checklists)

O módulo de preenchimento de checklists é crítico e deve funcionar sem internet:
- **Dexie**: Gerencia a fila de sincronização (`syncQueue`) e blobs de fotos.
- **Retry**: Tentativas automáticas de sincronização ao detectar volta da conexão.
- **Feedback**: `<OfflineBanner />` exibe o status de sincronização pendente.

---

## 📊 Gráficos e Painéis
Os gráficos do Dashboard devem ser interativos:
- **Filtros**: Clicar em uma barra ou fatia do gráfico deve filtrar os dados da página.
- **Performance**: Todos os filtros de dashboard são processados client-side via `useMemo` para evitar latência.

---

## 🔗 Deep links de filtros operacionais

### Regra de persistência
Filtros de navegação acionável vivem em query params da URL. São filtros de passagem e NÃO entram em `bf:v1:ui` — não são preferências persistentes. A URL é a fonte de verdade.

### Convenção de nomes (inglês)

| Param | Uso |
|---|---|
| `issue` | Pendência/situação do registro |
| `shipper` | Embarcador |
| `unit` | Unidade operacional |
| `q` | Busca textual livre |

**Valores de `issue` — VEÍCULOS:**

| Valor | Rótulo (PT) |
|---|---|
| `crlv_expired` | CRLV vencido |
| `crlv_expiring` | CRLV a vencer (30 dias) |
| `gr_expiring` | GR a vencer (30 dias) |
| `no_driver` | Sem motorista |
| `checklist_overdue` | Checklist vencido |

**Valores de `issue` — MOTORISTAS:**

| Valor | Rótulo (PT) |
|---|---|
| `cnh_expired` | CNH vencida |
| `cnh_expiring` | CNH a vencer (30 dias) |
| `gr_expiring` | GR a vencer (30 dias) |
| `with_vehicle` | Com veículo |
| `without_vehicle` | Sem veículo |

### Comportamento de `setSearchParams`
- **Filtros estruturados** (`issue`, `shipper`, `unit`): `replace: false` — cada mudança entra no histórico do navegador, permitindo que o botão voltar desfaça o filtro.
- **Digitação de busca** (`q`): `replace: true` — não polui o histórico a cada tecla digitada.

### Retrocompatibilidade
O parser entende os nomes/valores legados:
- `pendencia` → `issue` (com mapa `LEGACY_VEHICLE_ISSUE_VALUES` PT→EN)
- `situacao` → `issue` (com mapa `LEGACY_DRIVER_ISSUE_VALUES` PT→EN)
- `embarcador` → `shipper`
- `unidade` → `unit`

Ao detectar params legados na URL, um `useEffect` na tela reescreve a URL para o padrão novo automaticamente (`replace: true`).

### Preferências persistentes
Preferências que devem sobreviver entre sessões continuam em `bf:v1:ui` via `usePersistentUiState` (escopo `preference` em localStorage). A busca textual (`q`) NÃO é mais persistida em `sessionStorage` — nas telas de Veículos e Motoristas ela vive exclusivamente na URL.

---

## 🔍 Linting e Qualidade de Código

O projeto adota **ESLint 9+ (flat config)** como ferramenta oficial de qualidade de código, integrada ao `tsc --noEmit` em um único pipeline.

### Configuração
- **Arquivo**: `eslint.config.js` (flat config — **não** usar `.eslintrc*` nem `.eslintignore`).
- **Escopo de lint**: apenas `src/` (configs, `e2e/`, `scripts/`, `supabase/` e `docs/` são ignorados via `ignores`).
- **Plugins aplicados**:
  | Plugin | Função |
  | :--- | :--- |
  | `@eslint/js` | Base recomendada de regras JS |
  | `@typescript-eslint` (type-aware) | Regras TS com tipagem real via `projectService` |
  | `eslint-plugin-react` + `eslint-plugin-react-hooks` | Regras React 19 (novo JSX transform) |
  | `eslint-plugin-tailwindcss` | Validação Tailwind v4 (lê `src/index.css`) |
  | `eslint-plugin-security` | Padrões OWASP |
  | `eslint-plugin-import` | Ordenação e duplicidade de imports |
- **Type-aware**: o parser usa `projectService: true`, então regras que dependem de tipos (ex.: `no-misused-promises`) estão ativas. O projeto **não** usa `strict`; a família `no-unsafe-*` é reportada como **warning** (não bloqueia) para evitar enchente sem refatoração fora do escopo.
- **Tailwind v4**: sem `tailwind.config.js`. O plugin aponta `settings.tailwindcss.config` para `src/index.css` (path absoluto) para carregar o design system. `no-custom-classname` permanece **off** para evitar falsos-positivos da v4 parcial.

### Comandos
| Comando | Descrição |
| :--- | :--- |
| `npm run lint` | Roda `eslint src/` + `tsc --noEmit`. Exit 0 = sem erros (warnings são aceitos). |
| `npm run lint:fix` | Aplica auto-correção (`--fix`) + `tsc --noEmit`. |
| `npx eslint src/` | Lint isolado (sem typecheck). |
| `npx eslint <caminho> --fix` | Lint/fix de subconjunto. |

### Regras de destaque
- `react-hooks/rules-of-hooks`: **error**.
- `react-hooks/exhaustive-deps`: warn.
- `@typescript-eslint/no-unused-vars`: warn (ignora `_`, args, rest siblings).
- `no-console`: warn (permite `warn`/`error`/`info`).
- `import/order`: warn (grupos `builtin/external/internal/parent/sibling/index/type`, separados por linha, alfabético).
- `tailwindcss/classnames-order`, `enforces-shorthand`, `enforces-negative-arbitrary-values`, `no-unnecessary-arbitrary-value`: warn.
- `security/*` (OWASP): regras `detect-*` em warn/error conforme `recommended`; `detect-object-injection` off (muitos falsos-positivos em TS).

### Fluxo de desenvolvimento
1. Após mudanças em `src/`, rodar `npm run lint:fix` para auto-ordenar imports e classes.
2. Rodar `npm run lint`; deve terminar com **exit 0**. Warnings residuais são aceitos e reportados.
3. Se uma regra legítima for ruído para o caso, **desativar inline** com comentário justificativo (`// eslint-disable-next-line ...`) — não silenciar globalmente sem motivo.
4. Não gerar `.eslintignore` nem `.eslintrc*` — toda configuração vive em `eslint.config.js`.
5. Não alterar `tsconfig.json` além de tipos ESLint; a separação entre lint (qualidade) e typecheck (tipos) é mantida dentro do mesmo pipeline.

### CI/CD
- Workflow: `.github/workflows/lint.yml` (3 jobs paralelos).
  - **lint**: `npm run lint` — falha o PR se houver erros de ESLint/tsc.
  - **test**: `npm run test:unit` (Vitest).
  - **smoke**: `npm run test:smoke` (Playwright Chromium), exige secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Os jobs rodam em `push`/`pull_request` contra `main`/`master`. O smoke só tem utilidade com os secrets configurados no repositório.
