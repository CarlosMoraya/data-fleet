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
│   ├── VehicleForm.tsx  # Formulário multi-step para veículos (props: availableDrivers, availableShippers, availableOperationalUnits)
│   ├── DriverForm.tsx   # Formulário para motoristas (CNH, GR, certificados + email/senha ao criar, cria usuário via Edge Function)
│   ├── ShipperForm.tsx  # Formulário modal para embarcadores (name, cnpj, phone, email, contactPerson, notes, active)
│   ├── OperationalUnitForm.tsx # Formulário modal para unidades operacionais (shipperId required, name, code, city, state, notes, active)
│   ├── WorkshopForm.tsx # Formulário modal para oficinas (sem uploads, 3 seções)
│   ├── VehicleDetailModal.tsx  # Modal read-only de detalhes do veículo (8 seções, links de uploads)
│   ├── DriverDetailModal.tsx   # Modal read-only de detalhes do motorista (5 seções, links de uploads)
│   ├── WorkshopDetailModal.tsx # Modal read-only de detalhes da oficina (5 seções, sem uploads)
│   ├── ChecklistTemplateForm.tsx # Modal 3-step: metadados (categoria + contexto) → ações → itens; nome auto-gerado como "Checklist [Categoria] [Contexto]"
│   ├── ChecklistDetailModal.tsx  # Modal read-only com respostas, fotos, score de conformidade
│   ├── ActionPlanModal.tsx       # Modal de gestão de ação (status, notas de conclusão, upload de evidência — imagem/PDF via uploadActionPlanEvidence)
│   ├── CameraCapture.tsx         # Captura de foto via câmera (getUserMedia + GPS + compressão)
│   ├── MaintenanceForm.tsx       # Formulário de OS (dual OS, upload PDF orçamento, extração OCR, BudgetItemsTable, Km Atual, sem Custo Estimado/Subtotal)
│   ├── MaintenanceDetailModal.tsx # Modal read-only de OS (seção Orçamento: badge, PDF link, BudgetItemsTable readOnly)
│   └── BudgetItemsTable.tsx      # Tabela editável/read-only de itens de orçamento (5 cols: Item, Sistema, Qtd, Valor, Total) + subtotal
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
│   ├── Login.tsx        # Login com email/senha (Supabase Auth)
│   ├── Dashboard.tsx    # KPIs + gráficos (ainda mock data)
│   ├── Cadastros.tsx    # Layout wrapper com abas (Veículos, Motoristas, Embarcadores, Unidades Operacionais, Oficinas, Usuários) + <Outlet />
│   ├── Vehicles.tsx     # CRUD de veículos (Fleet Assistant+ acessa, Fleet Analyst+ edita) + botão Eye → VehicleDetailModal + carrega availableShippers/Units para VehicleForm
│   ├── Shippers.tsx     # CRUD de embarcadores (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta) + busca por nome/CNPJ
│   ├── OperationalUnits.tsx # CRUD de unidades operacionais (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta) + busca por nome/código/embarcador + FK restrict validation
│   ├── Drivers.tsx      # CRUD de motoristas (Fleet Assistant+ acessa, Fleet Analyst+ edita) + botão Eye → DriverDetailModal
│   ├── Workshops.tsx    # CRUD de oficinas (Fleet Assistant+ acessa, Fleet Analyst+ edita, Manager+ deleta ou Fleet Analyst com flag) + botão Eye → WorkshopDetailModal
│   ├── Checklists.tsx   # Página de checklists: Driver vê todos os templates publicados da categoria do seu veículo; Auditor seleciona veículo no dropdown e vê apenas templates de Auditoria; Assistant+ vê tabela do tenant. Histórico com busca e filtro de status. **Lookup de veículo via drivers.profile_id → vehicles.driver_id**
│   ├── ChecklistFill.tsx # Tela fullscreen de preenchimento (OK/Problema/N/A, câmera, observação, auto-save, finalização com ações). Contexto Entrada/Saída de Oficina: seleção obrigatória de oficina antes dos itens. Contexto Segurança: badge ⚠ em itens com canBlockVehicle
│   ├── ChecklistTemplates.tsx # CRUD de templates (draft/published/deprecated, versionamento, filtro dual por categoria + contexto)
│   ├── ActionPlans.tsx  # Painel Fleet Assistant+ — tabela de ações, filtros por status, modal de gestão
│   ├── Maintenance.tsx  # CRUD de ordens de serviço — dual OS, saveMutation 3-etapas (INSERT/UPDATE → upload PDF → items), coluna Orçamento. Query filtra por `client_id` do cliente selecionado (suporta Admin Master ver qualquer cliente)
│   ├── WorkshopSchedules.tsx # Agendamentos de oficina — botão "Gerar OS" navega para /manutencao com prefill via state
│   └── BudgetApprovals.tsx  # Aprovação de orçamentos (Fleet Assistant+) — fila FIFO, canApprove(user, total), expand por linha
│   ├── Users.tsx        # CRUD usuários do tenant (Fleet Assistant+); **não cria/lista Driver role** (drivers criados via DriverForm)
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
