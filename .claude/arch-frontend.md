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
│   ├── VehicleForm.tsx  # Formulário multi-step para veículos (prop: availableDrivers)
│   ├── DriverForm.tsx   # Formulário para motoristas (CNH, GR, certificados)
│   └── WorkshopForm.tsx # Formulário modal para oficinas (sem uploads, 3 seções)
├── context/
│   └── AuthContext.tsx   # Auth + client context → useAuth() hook
├── lib/
│   ├── supabase.ts      # Supabase client (VITE_SUPABASE_URL + ANON_KEY)
│   ├── utils.ts         # cn() helper (clsx + tailwind-merge)
│   ├── vehicleMappers.ts  # Mapper camelCase (TS) ↔ snake_case (Supabase) para Vehicle
│   ├── driverMappers.ts   # Mapper camelCase (TS) ↔ snake_case (Supabase) para Driver
│   ├── workshopMappers.ts # Mapper camelCase (TS) ↔ snake_case (Supabase) + formatCNPJ() + WORKSHOP_SPECIALTIES
│   ├── fieldSettingsMappers.ts  # Mapper + CONFIGURABLE_FIELDS + isFieldRequired() para Veículo
│   ├── driverFieldSettingsMappers.ts  # Mapper + DRIVER_CONFIGURABLE_FIELDS + isDriverFieldRequired() para Motorista
│   ├── inputHelpers.ts    # Filtros de input (filterCPF, filterCNHCategory, filterCNPJ, filterPhone, filterCEP, etc.)
│   └── storageHelpers.ts  # Upload/delete de arquivos (vehicle-documents e driver-documents), compressão de imagens
├── pages/
│   ├── Login.tsx        # Login com email/senha (Supabase Auth)
│   ├── Dashboard.tsx    # KPIs + gráficos (ainda mock data)
│   ├── Cadastros.tsx    # Layout wrapper com abas (Veículos, Motoristas, Oficinas, Usuários) + <Outlet />
│   ├── Vehicles.tsx     # CRUD de veículos (Fleet Assistant+ acessa, Fleet Analyst+ edita)
│   ├── Drivers.tsx      # CRUD de motoristas (Fleet Assistant+ acessa, Fleet Analyst+ edita)
│   ├── Workshops.tsx    # CRUD de oficinas (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta ou Fleet Analyst com flag)
│   ├── Checklists.tsx   # Stub — "No checklists"
│   ├── Users.tsx        # CRUD usuários do tenant (Fleet Assistant+)
│   ├── Settings.tsx     # Configurações de campos obrigatórios: Veículo + Motorista (Manager+)
│   ├── AdminUsers.tsx   # CRUD todos usuários (Admin Master only)
│   └── AdminClients.tsx # CRUD clientes (Admin Master only)
├── types.ts             # Interfaces compartilhadas
├── constants.ts         # Mock data (MOCK_CLIENTS, MOCK_VEHICLES — Dashboard ainda usa MOCK_VEHICLES)
└── App.tsx              # Definição de rotas (nested /cadastros com sub-rotas)
```

## Roteamento (App.tsx)

- Rotas protegidas aninhadas sob `<Layout>` (`/`)
- Não há route guard real — fluxo de login é UI-driven
- **Nested routes under `/cadastros`**: `/cadastros/veiculos`, `/cadastros/motoristas`, `/cadastros/oficinas`, `/cadastros/usuarios`
- **Route Guards por role**:
  - Driver/Yard Auditor → redirect `/` para `/checklists`
  - Admin Master → acesso a `/admin/*`
  - Fleet Assistant+ → acesso a `/cadastros/*` (abas visíveis)
  - Manager+ → acesso a `/settings`
- **Backward compatibility**: `/vehicles` → `/cadastros/veiculos`, `/drivers` → `/cadastros/motoristas`, `/users` → `/cadastros/usuarios`
- **Rotas disponíveis**: `/`, `/cadastros/*`, `/checklists`, `/settings`, `/admin/clients`, `/admin/users`

## Layout Shell

O `Layout.tsx` renderiza:
1. `<Sidebar>` — navegação lateral com links condicionais por role
2. `<Topbar>` — exibe client atual, switcher (Manager/Director/Admin Master), info do user
3. `<Outlet>` — conteúdo da página ativa

## Padrões de Componentes

- **Formulários modais**: abrem em overlay `fixed inset-0`, React `useEffect` reseta state ao abrir
- **Associação motorista×veículo**: `VehicleForm` recebe prop `availableDrivers: {id, name, cpf}[]` — lista de motoristas livres. Vehicles.tsx carrega a lista via `fetchAvailableDrivers(currentDriverId?)` ao abrir o form. Drivers.tsx exibe a placa do veículo via `driverVehicleMap: Record<string, string>` (driver_id → license_plate).
- **Tabelas**: renderizadas com map sobre array local (`useState`), ações inline (edit/delete)
- **Client switcher**: ComboBox no Topbar, visível apenas para Manager/Director/Admin Master
- **Gráficos**: `Recharts` (BarChart, PieChart) no Dashboard, filtrados por `currentClient.id`
- **Navegação em abas**: `Cadastros.tsx` renderiza `<NavLink>` com estilo ativo (border-b-2 orange), cada aba renderiza seu módulo via `<Outlet />`
- **Sidebar**: item único "Cadastros" (`FolderOpen` icon) → `/cadastros`, substitui items individuais de Veículos/Motoristas/Usuários
