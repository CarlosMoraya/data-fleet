# Arquitetura Frontend

## Stack
- **React 19** com JSX/TSX
- **Vite** (dev server porta 3000, `@` alias → raiz do projeto)
- **TypeScript** strict
- **Tailwind CSS v4** (utility-first)
- **Recharts** para gráficos no Dashboard
- **React Router DOM** para roteamento SPA

## Estrutura de Pastas

```
src/
├── components/          # Componentes reutilizáveis
│   ├── Layout.tsx       # Shell: Sidebar + Topbar + Outlet
│   ├── Sidebar.tsx      # Menu lateral com navegação
│   ├── Topbar.tsx       # Barra superior (client switcher, user info)
│   └── VehicleForm.tsx  # Formulário multi-step para veículos
├── context/
│   └── AuthContext.tsx   # Auth + client context → useAuth() hook
├── lib/
│   ├── supabase.ts      # Supabase client (VITE_SUPABASE_URL + ANON_KEY)
│   ├── utils.ts         # cn() helper (clsx + tailwind-merge)
│   └── vehicleMappers.ts # Mapper camelCase (TS) ↔ snake_case (Supabase) para Vehicle
├── pages/
│   ├── Login.tsx        # Login com email/senha (Supabase Auth)
│   ├── Dashboard.tsx    # KPIs + gráficos (ainda mock data)
│   ├── Vehicles.tsx     # CRUD de veículos (Supabase — Fleet Assistant+ acessa, Fleet Analyst+ edita)
│   ├── Checklists.tsx   # Stub — "No checklists"
│   ├── Users.tsx        # CRUD usuários do tenant (Fleet Assistant+)
│   ├── AdminUsers.tsx   # CRUD todos usuários (Admin Master only)
│   └── AdminClients.tsx # CRUD clientes (Admin Master only)
├── types.ts             # Interfaces compartilhadas
├── constants.ts         # Mock data (MOCK_CLIENTS, MOCK_VEHICLES — Dashboard ainda usa MOCK_VEHICLES)
└── App.tsx              # Definição de rotas
```

## Roteamento (App.tsx)

- Rotas protegidas aninhadas sob `<Layout>` (`/`)
- Não há route guard real — fluxo de login é UI-driven
- **Route Guards por role**:
  - Driver/Yard Auditor → redirect `/` para `/checklists`
  - Admin Master → acesso a `/admin/*`
  - Fleet Assistant+ → acesso a `/users`

## Layout Shell

O `Layout.tsx` renderiza:
1. `<Sidebar>` — navegação lateral com links condicionais por role
2. `<Topbar>` — exibe client atual, switcher (Manager/Director/Admin Master), info do user
3. `<Outlet>` — conteúdo da página ativa

## Padrões de Componentes

- **Formulários modais**: abrem em overlay `fixed inset-0`, React `useEffect` reseta state ao abrir
- **Tabelas**: renderizadas com map sobre array local (`useState`), ações inline (edit/delete)
- **Client switcher**: ComboBox no Topbar, visível apenas para Manager/Director/Admin Master
- **Gráficos**: `Recharts` (BarChart, PieChart) no Dashboard, filtrados por `currentClient.id`
