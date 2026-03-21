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
│   ├── Sidebar.tsx      # Menu lateral com navegação (contém logo tipográfico βetaFleet com letra grega)
│   ├── Topbar.tsx       # Barra superior (client switcher, user info)
│   ├── VehicleForm.tsx  # Formulário multi-step para veículos (props: availableDrivers, availableShippers, availableOperationalUnits). Campos: Identificação + Propriedade (incluindo Km Inicial) + Documentos + Técnicas + Garantia + Seguro + Motorista + Logística. Field settings dinâmicos.
│   ├── DriverForm.tsx   # Formulário para motoristas (CNH, GR, certificados + email/senha ao criar, cria usuário via Edge Function)
│   ├── ShipperForm.tsx  # Formulário modal para embarcadores (name, cnpj, phone, email, contactPerson, notes, active)
│   ├── OperationalUnitForm.tsx # Formulário modal para unidades operacionais (shipperId required, name, code, city, state, notes, active)
│   ├── WorkshopForm.tsx # Formulário modal para oficinas (sem uploads, 4 seções); **NOVO**: seção "Acesso ao Sistema" apenas na criação (loginEmail + loginPassword opcionais); badge "Com/Sem acesso ao sistema" na edição; prop `onSave` recebe `(workshop, loginEmail?, loginPassword?)`
│   ├── VehicleDetailModal.tsx  # Modal read-only de detalhes do veículo (8 seções, links de uploads)
│   ├── DriverDetailModal.tsx   # Modal read-only de detalhes do motorista (5 seções, links de uploads)
│   ├── WorkshopDetailModal.tsx # Modal read-only de detalhes da oficina (5 seções, sem uploads)
│   ├── ChecklistTemplateForm.tsx # Modal 3-step: metadados (categoria + contexto) → ações → itens; nome auto-gerado como "Checklist [Categoria] [Contexto]"
│   ├── ChecklistDetailModal.tsx  # Modal read-only com respostas, fotos, score de conformidade
│   ├── ActionPlanModal.tsx       # Modal de gestão de ação (status, notas de conclusão, upload de evidência — imagem/PDF via uploadActionPlanEvidence)
│   ├── CameraCapture.tsx         # Captura de foto via câmera (getUserMedia + GPS + compressão)
│   ├── MaintenanceForm.tsx       # Formulário de OS (dual OS, upload PDF orçamento, extração OCR, BudgetItemsTable, Km Atual, sem Custo Estimado/Subtotal); **NOVO**: prop `mode?: 'default' | 'workshop'` — no modo 'workshop' exibe apenas 5 campos obrigatórios (expectedExitDate, workshopOs, mechanicName, currentKm, PDF) + info read-only da OS. **Restrição Data Entrada (2026-03-20)**: campo `entryDate` com `max={today}` (horário local via `toLocaleDateString('en-CA')`) — impossibilita inserção de datas futuras
│   ├── MaintenanceDetailModal.tsx # Modal read-only de OS (seção Orçamento: badge, PDF link, BudgetItemsTable readOnly)
│   ├── BudgetItemsTable.tsx      # Tabela editável/read-only de itens de orçamento (5 cols: Item, Sistema, Qtd, Valor, Total) + subtotal
│   ├── dashboard/
│   │   ├── DashboardKpiCard.tsx          # Card de KPI reutilizável (icon, label, value, isAlert)
│   │   ├── VehicleTypeBarChart.tsx        # Gráfico de barras por tipo de veículo com click=filtro; props: data, activeFilter, onFilterChange, title, valueFormatter
│   │   ├── MaintenanceTypeDonutChart.tsx  # Gráfico de rosca por tipo de manutenção com click=filtro; cores: Corretiva=#ef4444, Preventiva=#3b82f6, Preditiva=#8b5cf6
│   │   ├── OperationalPanel.tsx           # Painel Operacional: 5 KPIs (Total Veículos, Em Manutenção, Checklists Vencidos, CRLVs Vencidos, CNHs Vencidas) + 4 gráficos (por Tipo, por Tipo de Manutenção, por Embarcador*, por Unidade Operacional*); exporta VehicleRow, MaintenanceOrderDashboard, DashboardFilters (*condicionais, aparecem só se houver dados)
│   │   └── CostPanel.tsx                  # Painel de Custos: 3 KPIs (Custo Total, por Veículo, por KM) + 4 gráficos (por Tipo, por Tipo de Manutenção, por Embarcador*, por Unidade Operacional*); props: vehicles, maintenanceOrders, checklistRows, dateRange, filters, onFiltersChange (*condicionais)
│   ├── VehicleKmIntervalSettings.tsx # Aba "Revisões" em Settings: configura km entre revisões por veículo; filtros (marca/modelo/categoria), bulk apply, paginação 50/página, bulk upsert via onConflict vehicle_id; props: clientId, userId
│   └── ChecklistDayIntervalSettings.tsx # Aba "Checklists" em Settings: configura intervalo em dias entre checklists de Rotina e Segurança (global por cliente); 2 inputs numéricos, upsert via onConflict client_id; props: clientId, userId
├── context/
│   └── AuthContext.tsx   # Auth + client context → useAuth() hook
├── lib/
│   ├── supabase.ts      # Supabase client (VITE_SUPABASE_URL + ANON_KEY)
│   ├── utils.ts         # cn() helper (clsx + tailwind-merge)
│   ├── vehicleMappers.ts  # Mapper camelCase (TS) ↔ snake_case (Supabase) para Vehicle (agora com shipper_id e operational_unit_id)
│   ├── shipperMappers.ts  # Mapper camelCase (TS) ↔ snake_case (Supabase) para Shipper (re-exporta formatCNPJ)
│   ├── operationalUnitMappers.ts # Mapper camelCase (TS) ↔ snake_case (Supabase) para OperationalUnit (normaliza code/state uppercase)
│   ├── driverMappers.ts   # Mapper camelCase (TS) ↔ snake_case (Supabase) para Driver
│   ├── workshopMappers.ts # Mapper camelCase (TS) ↔ snake_case (Supabase) + formatCNPJ() + WORKSHOP_SPECIALTIES
│   ├── fieldSettingsMappers.ts  # Mapper + CONFIGURABLE_FIELDS + isFieldRequired() para Veículo
│   ├── driverFieldSettingsMappers.ts  # Mapper + DRIVER_CONFIGURABLE_FIELDS + isDriverFieldRequired() para Motorista
│   ├── inputHelpers.ts    # Filtros de input (filterCPF, filterCNHCategory, filterCNPJ, filterPhone, filterCEP, etc.)
│   ├── storageHelpers.ts  # Upload/delete de arquivos (vehicle-documents e driver-documents), compressão de imagens; inclui uploadMaintenanceBudget()
│   ├── maintenanceMappers.ts # Mappers para MaintenanceOrder + BudgetItem; BudgetStatus type; calcBudgetSubtotal()
│   ├── budgetOcr.ts       # Extração de dados de PDF de orçamento: regex tabular → fallback Gemini Vision (gemini-2.5-flash)
│   ├── checklistTemplateMappers.ts # Mappers para ChecklistTemplate, ChecklistItem, ChecklistItemSuggestion
│   ├── checklistMappers.ts         # Mappers para Checklist e ChecklistResponse
│   ├── actionPlanMappers.ts        # Mappers + actionStatusLabel() + actionStatusColor() para ActionPlan
│   └── checklistStorageHelpers.ts  # uploadChecklistPhoto() + deleteChecklistPhoto() — bucket checklist-photos
├── pages/
│   ├── Login.tsx        # Login com email/senha (Supabase Auth); **REDESIGN 2026-03-20**: Logo βetaFleet tipográfica (β orange-500 + etaFleet branco + "Evolution always"); background com fallback: vídeo `/videos/login-bg.mp4` → imagem `/images/login-bg.jpg` → fundo zinc-900; detecção via `onError` handlers (videoFailed, imageFailed state); overlay black/50; card branco/95 backdrop-blur
│   ├── Dashboard.tsx    # Dois painéis (abas): Painel Operacional + Painel de Custos. Queries: dashboard-vehicles, dashboard-maintenance (com join vehicles(type)), dashboard-checklists, dashboard-intervals, dashboard-drivers. Filtros interativos (vehicleType + maintenanceType) compartilhados entre abas. Cálculo de checklists vencidos via useMemo + checklist_day_intervals.
│   ├── Cadastros.tsx    # Layout wrapper com abas (Veículos, Motoristas, Embarcadores, Unidades Operacionais, Oficinas, Usuários) + <Outlet />
│   ├── Vehicles.tsx     # CRUD de veículos (Fleet Assistant+ acessa, Fleet Analyst+ edita) + botão Eye → VehicleDetailModal + carrega availableShippers/Units para VehicleForm
│   ├── Shippers.tsx     # CRUD de embarcadores (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta) + busca por nome/CNPJ
│   ├── OperationalUnits.tsx # CRUD de unidades operacionais (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta) + busca por nome/código/embarcador + FK restrict validation
│   ├── Drivers.tsx      # CRUD de motoristas (Fleet Assistant+ acessa, Fleet Analyst+ edita) + botão Eye → DriverDetailModal
│   ├── Workshops.tsx    # CRUD de oficinas (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta ou Fleet Analyst com flag) + botão Eye → WorkshopDetailModal
│   ├── Checklists.tsx   # Página de checklists: Driver vê todos os templates publicados da categoria do seu veículo; Auditor seleciona veículo no dropdown e vê apenas templates de Auditoria; Assistant+ vê tabela do tenant. Histórico com busca e filtro de status. **Lookup de veículo via drivers.profile_id → vehicles.driver_id**
│   ├── ChecklistFill.tsx # Tela fullscreen de preenchimento (OK/Problema/N/A, câmera, observação, auto-save, finalização com ações). **NOVO**: Campo KM obrigatório (primeiro, antes dos itens) — exibe último KM registrado ou initial_km do veículo como referência; valida KM >= último; bloqueia itens até KM confirmado. Contexto Entrada/Saída de Oficina: seleção obrigatória de oficina antes dos itens. Contexto Segurança: badge ⚠ em itens com canBlockVehicle
│   ├── ChecklistTemplates.tsx # CRUD de templates (draft/published/deprecated, versionamento, filtro dual por categoria + contexto)
│   ├── ActionPlans.tsx  # Painel Fleet Assistant+ — tabela de ações, filtros por status, modal de gestão
│   ├── Maintenance.tsx  # CRUD de ordens de serviço — dual OS, saveMutation 3-etapas (INSERT/UPDATE → upload PDF → items), coluna Orçamento. **Query filtra por `client_id` do cliente selecionado (suporta Admin Master via dropdown, corrigido 2026-03-18)**; **NOVO**: suporte role 'Workshop' — query filtra por `workshop_id`, botão "Nova OS" oculto, UPDATE parcial (apenas 4 campos), modo 'workshop' em MaintenanceForm, coluna OS mostra workshopOs. **CANCELAMENTO (2026-03-20)**: status 'Cancelado' terminal (Fleet Assistant+, !isWorkshopUser); botão Ban + modal confirmação; botão RotateCcw "Reabrir" (clone sem id → INSERT nova OS via prefillData); cancelMutation persiste cancelled_at + cancelled_by_id; 6º card "Cancelados"
│   ├── WorkshopSchedules.tsx # Agendamentos de oficina — botão "Gerar OS" navega para /manutencao com prefill via state
│   └── BudgetApprovals.tsx  # Aprovação de orçamentos (Fleet Assistant+) — fila FIFO, canApprove(user, total), expand por linha. **Query filtra por `client_id` + budgetItems query sem `enabled: expanded` (subtotal agora persiste após refresh, corrigido 2026-03-18)**
│   ├── Users.tsx        # CRUD usuários do tenant (Fleet Assistant+); **não cria/lista Driver role** (drivers criados via DriverForm). **refreshSession antes de edição (corrigido JWT expired 2026-03-18)**
│   ├── Settings.tsx     # Configurações: abas Veículo + Motorista (Manager+) + Revisões + Checklists (Fleet Assistant+); guard: ROLES_CAN_ACCESS_SETTINGS (Fleet Assistant+); canManageFields controla abas Veículos/Motoristas
│   ├── AdminUsers.tsx   # CRUD todos usuários (Admin Master only). **refreshSession antes de edição (corrigido JWT expired 2026-03-18)**
│   └── AdminClients.tsx # CRUD clientes (Admin Master only)
├── types.ts             # Interfaces compartilhadas
├── constants.ts         # Mock data (MOCK_CLIENTS, MOCK_VEHICLES — Dashboard ainda usa MOCK_VEHICLES)
└── App.tsx              # Definição de rotas (nested /cadastros com sub-rotas)
```

## Roteamento (App.tsx)

- Rotas protegidas aninhadas sob `<Layout>` (`/`)
- Não há route guard real — fluxo de login é UI-driven
- **Nested routes under `/cadastros`**: `/cadastros/veiculos`, `/cadastros/embarcadores`, `/cadastros/unidades-operacionais`, `/cadastros/motoristas`, `/cadastros/oficinas`, `/cadastros/usuarios`
- **Route Guards por role**:
  - Driver/Yard Auditor → redirect `/` para `/checklists`
  - Admin Master → acesso a `/admin/*`
  - Fleet Assistant+ → acesso a `/cadastros/*` (abas visíveis)
  - Manager+ → acesso a `/settings`
- **Backward compatibility**: `/vehicles` → `/cadastros/veiculos`, `/drivers` → `/cadastros/motoristas`, `/users` → `/cadastros/usuarios`
- **Rotas disponíveis**: `/`, `/cadastros/veiculos`, `/cadastros/embarcadores`, `/cadastros/unidades-operacionais`, `/cadastros/motoristas`, `/cadastros/oficinas`, `/cadastros/usuarios`, `/checklists`, `/checklists/preencher/:checklistId`, `/checklist-templates`, `/acoes`, `/agendamentos`, `/manutencao`, `/aprovacao-orcamentos`, `/settings`, `/admin/clients`, `/admin/users`

## Layout Shell

O `Layout.tsx` renderiza:
1. `<Sidebar>` — navegação lateral com suporte a **Mobile Drawer** (hambúrguer menu)
2. `<Topbar>` — exibe client atual, switcher, info do user e botão de menu no mobile
3. `<Outlet>` — conteúdo da página ativa

**Padrão de Scroll Interno (2026-03-20):**
- `<main>` em `Layout.tsx`: `flex-1 overflow-hidden flex flex-col` (não scrollável, apenas contenedor)
- Wrapper inner: `flex-1 min-h-0 flex flex-col` — propaga altura para o `<Outlet />`
- **Cada página** segue um dos 3 padrões abaixo:

**Padrão 1: Tabela Simples** (Vehicles, Drivers, Workshops, Shippers, OperationalUnits, Users, AdminUsers, AdminClients, ChecklistTemplates)
- Raiz: `flex flex-col gap-6 h-full`
- Tabela wrapper: `overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col`
- Inner table div: `flex-1 overflow-auto` (scrollável verticalmente)
- `<thead>`: `sticky top-0 z-10` (permance visível ao rolar)

**Padrão 2: Cards + Tabela** (Maintenance, ActionPlans, BudgetApprovals)
- Raiz: `flex flex-col gap-6 h-full`
- Cards/resumos: shrink-0 (altura natural, não participam do `flex-1`)
- Tabela wrapper: `flex-1 min-h-0 flex flex-col overflow-hidden` (recebe espaço restante)
- Inner table div: `flex-1 overflow-auto`

**Padrão 3: Abas + Conteúdo** (Dashboard, Settings)
- Raiz: `flex flex-col gap-6 h-full`
- Título + filtros + tabs: shrink-0 (altura natural)
- Painel/aba ativo: `flex-1 min-h-0 overflow-y-auto` (recebe espaço restante, scrollável)

**Padrão 4: Múltiplas Views por Role** (Checklists)
- Raiz: `flex flex-col gap-6 h-full`
- Título: shrink-0
- View ativa (Driver/Auditor/Assistant+): `flex-1 min-h-0 overflow-y-auto flex flex-col gap-6` (para Driver/Auditor); ou `flex-1 min-h-0 flex flex-col` + inner table pattern (para Assistant+)

**Padrão 5: Layout Wrapper com Sub-rotas** (Cadastros)
- Raiz: `flex flex-col gap-6 h-full`
- Título + tabs: shrink-0
- Outlet wrapper: `flex-1 min-h-0` — passa altura para sub-páginas (que usam Padrão 1)

**Regra de Ouro:**
- `h-full` só funciona quando o pai tem altura definida (raiz `h-full` ou `flex-1`)
- `flex-1 min-h-0` garante que: (1) flexbox filho recebe espaço restante; (2) pode encolher abaixo do conteúdo (para scroll funcionar)
- Sem `min-h-0`, altura mínima = conteúdo, scroll não ativa
- Sem `flex-1`, não recebe espaço restante, torna-se "natural height"

## Deploy & Hosting

- **Vercel**: Hospedagem recomendada para o frontend React.
- **`vercel.json`**: Configurado com rewrites para garantir que rotas SPA (ex: `/cadastros/oficinas`) funcionam ao recarregar.

## Padrões de Componentes

- **Formulários modais**: abrem em overlay `fixed inset-0`, React `useEffect` reseta state ao abrir
- **Criação de Drivers com usuário (2026-03-14)**:
  - `DriverForm` em modo **criação** (sem driver existente):
    - Exibe seção "Acesso ao Sistema" com campos obrigatórios: email (type="email"), senha (min 6 chars)
    - Ao submeter: chama Edge Function `create-user` com role='Driver', obtém `profileId`, passa para `onSave`
    - `onSave` insere driver com `profile_id = profileId`
    - Se falha na criação do driver (e2g, CPF duplicado), usuário fica criado mas sem driver (aceitável, reutilizável depois)
  - `DriverForm` em modo **edição**: email/senha não aparecem (não altera credenciais aqui)
- **Associação motorista×veículo**: `VehicleForm` recebe prop `availableDrivers: {id, name, cpf}[]` — lista de motoristas livres. Vehicles.tsx carrega a lista via `fetchAvailableDrivers(currentDriverId?)` ao abrir o form. Drivers.tsx exibe a placa do veículo via `driverVehicleMap: Record<string, string>` (driver_id → license_plate).
- **Tabelas**: renderizadas com map sobre array local (`useState`), ações inline (edit/delete)
- **Client switcher**: ComboBox no Topbar, visível apenas para Manager/Director/Admin Master
- **Gráficos**: `Recharts` (BarChart, PieChart) no Dashboard, filtrados por `currentClient.id`
- **Navegação em abas**: `Cadastros.tsx` e `Settings.tsx` utilizam navegação por abas com estilo ativo (border-b-2 orange). `Cadastros` utiliza sub-rotas via `<Outlet />`, enquanto `Settings` utiliza estado local (`activeTab`) para alternar as seções.
- **Sidebar**: item único "Cadastros" (`FolderOpen` icon) → `/cadastros`, substitui items individuais de Veículos/Motoristas/Usuários. Novos itens: "Plano de Ação" (`ClipboardList`) para Fleet Assistant+; "Templates" (`FileStack`) para Fleet Analyst+
- **Integração Embarcadores + Veículos**: Seção "Logística" em VehicleForm com 2 dropdowns em cascata:
  - Dropdown 1: Embarcador (lista de shippers ativos, "Nenhum embarcador" option)
  - Dropdown 2: Unidade Operacional (filtrada por embarcador selecionado, disabled até selecionar embarcador)
  - Ao trocar embarcador: unidade é resetada, lista é recalculada
  - Padrão identico a VehicleForm com disponibleDrivers
- **Modais de detalhe (read-only)**:
  - `VehicleDetailModal` renderiza 8 seções (Identificação, Propriedade, Equipamentos, Adicionais, Motorista, Documentos com links, Garantia, Seguro/Manutenção) a partir de um objeto `Vehicle`
  - `DriverDetailModal` renderiza 5 seções (Dados Pessoais, CNH, GR, Certificados, Veículo Associado) com links para uploads
  - `WorkshopDetailModal` renderiza 5 seções (Identificação, Contato, Endereço, Especialidades, Observações) sem uploads
  - Container externo usa `flex items-start justify-center` para iniciar no topo da viewport em telas pequenas
  - Links de arquivo (`FileField`) exibem "Visualizar 🔗" em laranja ou "Não enviado" em cinza
  - Acionado por botão Eye (`<Eye />` icon) nas tabelas de Vehicles, Drivers e Workshops

## Users.tsx — Gestão de Drivers (2026-03-14)

**Padrão de permissões e criação:**
- Role 'Driver' **não pode ser criado** via Users.tsx (filtrado em `creatableRoles()`)
- Role 'Driver' **não aparece na lista** de usuários (filtrado em `fetchUsers()`)
- **Drivers são criados exclusivamente via DriverForm** (módulo Cadastros > Motoristas), que:
  1. Cria a conta de usuário (auth + profile) via Edge Function `create-user`
  2. Insere driver record com `profile_id` linkando ao novo user
  3. Garante que toda conta Driver tem um driver record associado

## Dashboard.tsx — Painéis Operacional e de Custos (2026-03-19)

**Arquitetura:**
- Dois painéis (abas): Painel Operacional + Painel de Custos de Manutenção
- Abas: mesmo padrão de Settings.tsx (border-b-2 orange, `cn()` utility, TabType state)
- 5 queries independentes via react-query (todas scoped por `currentClient.id`)
- Filtros interativos compartilhados entre painéis: `{ vehicleType, maintenanceType }`
- Gráficos atuam como filtros (click = toggle; click novamente = clear)
- Client-side filtering via useMemo (sem round-trips extras ao Supabase)

**Painel Operacional:**
- 5 KPI cards: Total Veículos (Truck/azul), Em Manutenção (Wrench/âmbar), Checklists Vencidos (CalendarDays/vermelho), CRLVs Vencidos (FileWarning/laranja), CNHs Vencidas (UserX/vermelho)
- Gráfico de barras: veículos por tipo (Passeio, Utilitário, Van, Moto, Vuc, Toco, Truck, Cavalo)
- Gráfico de rosca: contagem de OS por tipo de manutenção (Corretiva=#ef4444, Preventiva=#3b82f6, Preditiva=#8b5cf6)
- Gráfico de barras: frota por embarcador (condicional — aparece só se houver dados)
- Gráfico de barras: frota por unidade operacional (condicional — aparece só se houver dados)
- Cálculo de checklists vencidos: useMemo agrupa por vehicle_id + context, compara última data contra `checklist_day_intervals` config

**Painel de Custos:**
- 3 KPI cards: Custo Total (DollarSign/verde), Custo por Veículo (Truck/azul), Custo por KM (Gauge/roxo)
- Gráfico de barras: custo total por tipo de veículo
- Gráfico de rosca: custo total por tipo de manutenção
- Gráfico de barras: custo por embarcador (condicional — aparece só se houver dados)
- Gráfico de barras: custo por unidade operacional (condicional — aparece só se houver dados)
- Custo por Veículo: `SUM(approved_cost) / filteredVehicles.length` (todos os veículos filtrados, não só os com OS)
- Custo por KM: `SUM(approved_cost) / SUM(MAX(odometer_km) - MIN(odometer_km) por veículo)` — usa `odometer_km` dos **checklists** filtrados pelo `dateRange` (não usa `current_km` de maintenance_orders)

**Componentes do Dashboard (src/components/dashboard/):**
- `DashboardKpiCard.tsx` — Card reutilizável (icon + label + value + optional subtitle + optional isAlert flag)
- `VehicleTypeBarChart.tsx` — BarChart com click=filtro; active bar azul, inactive dimmed; props: data, activeFilter, onFilterChange, title, valueFormatter, yAxisLabel
- `MaintenanceTypeDonutChart.tsx` — PieChart donut com click=filtro; cores por tipo; props: data, activeFilter, onFilterChange, title, valueFormatter
- `OperationalPanel.tsx` — Exporta interfaces (VehicleRow, MaintenanceOrderDashboard, DashboardFilters); renderiza 5 KPIs + 2 gráficos; aplica filtros via useMemo; KPI "Em Manutenção" exclui status 'Cancelado' e 'Concluído'
- `CostPanel.tsx` — Renderiza 3 KPIs + 2 gráficos; calcula cost per KM com `new Map<string, VehicleRow>` e `new Set<string>` explícitos (TS fix); filtro defensivo exclui status 'Cancelado' antes de qualquer cálculo de custo

**Queries (react-query):**
```ts
dashboard-vehicles    → vehicles: id, type, crlv_year, driver_id, shippers(name), operational_units(name)
                         — resultado mapeado explicitamente para extrair shipper_name e operational_unit_name dos joins
dashboard-maintenance → maintenance_orders: id, vehicle_id, type, status, approved_cost, current_km, vehicles(type)
dashboard-checklists  → checklists: vehicle_id, context, completed_at, odometer_km (status='completed')
dashboard-intervals   → checklist_day_intervals: rotina_day_interval, seguranca_day_interval (maybeSingle per client)
dashboard-drivers     → drivers: id, expiration_date
```

**Notas Importantes:**
- `VehicleRow` NOT inclui coluna `status` (não existe no schema vehicles)
- `MaintenanceOrderDashboard` inclui tipo de manutenção (union: 'Corretiva' | 'Preventiva' | 'Preditiva')
- Filtros persistem ao trocar entre abas
- Temporário: `vehiclesError` exibido em red banner se RLS de vehicles bloquear (diagnóstico)
