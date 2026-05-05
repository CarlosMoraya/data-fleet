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

### 3. Persistência de Formulários
- Uso de `sessionStorage` para manter dados de formulários abertos durante a navegação entre abas dentro da mesma sessão.
- Limpeza automática ao salvar ou fazer logout.

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
