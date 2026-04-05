# Modelo de Dados

## Interfaces TypeScript (src/types.ts)

### Role
```ts
type Role = 'Driver' | 'Yard Auditor' | 'Workshop' | 'Fleet Assistant' | 'Fleet Analyst' | 'Supervisor' | 'Manager' | 'Coordinator' | 'Director' | 'Admin Master';
```

### Hierarquia de Roles (Ranks)
```
Driver(1) < Yard Auditor(2) < Workshop(1) < Fleet Assistant(3) < Fleet Analyst(4) < Supervisor(5) < Coordinator(6) < Manager(7) < Director(8) < Admin Master(9)
```

**Alteração 2026-03-26:**
- Supervisor: 4 → 5
- Coordinator: 5 → 6 (novo role acima de Manager anterior)
- Manager: 5 → 7
- Director: 6 → 8
- Admin Master: 7 → 9

**Regras:**
- Usuário só pode criar roles abaixo do seu rank (ex: Manager(7) cria Coordinator(6) e abaixo)
- Client switching: apenas Manager(7)+
- Área admin (`/admin/*`): apenas Admin Master(9)
- Gestão de usuários (`/users`): Fleet Assistant(3)+
- **Exclusão de veículos**: Manager(7)+ sempre, ou Fleet Analyst(4) se o flag `canDeleteVehicles` estiver ativo.
- **Exclusão de motoristas**: Manager(7)+ sempre, ou Fleet Analyst(4) se o flag `canDeleteDrivers` estiver ativo; Supervisor(5) com flag.
- **Exclusão de oficinas**: Manager(7)+ sempre, ou Fleet Analyst(4)/Supervisor(5) se o flag `canDeleteWorkshops` estiver ativo.
- **Visualização de usuários**: Rank N só vê users com rank < N; ninguém se vê na lista (próprio user excludido)
- Route guard: Driver/Yard Auditor → redirect para `/checklists`; Workshop → redirect para `/manutencao`

### User
```ts
interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string | null; // null para Workshop no novo modelo multi-transportadora
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
  canDeleteWorkshops: boolean;
  budgetApprovalLimit: number; // 0 = sem permissão de aprovação; > 0 = limite em R$
  workshopId?: string;        // modelo legado: FK → workshops.id da transportadora única
  workshopAccountId?: string; // novo modelo: FK → workshop_accounts.id
}
```

### WorkshopAccount (novo modelo multi-transportadora)
```ts
interface WorkshopAccount {
  id: string;
  profileId: string;
  name: string;
  cnpj: string;      // globalmente único em workshop_accounts
  phone?: string;
  email?: string;
  contactPerson?: string;
  addressStreet?: string; addressNumber?: string; addressComplement?: string;
  addressNeighborhood?: string; addressCity?: string; addressState?: string; addressZip?: string;
  specialties?: string[];
  notes?: string;
  active: boolean;
}
```

### WorkshopPartnership
```ts
interface WorkshopPartnership {
  id: string;
  workshopAccountId: string;
  clientId: string;
  clientName?: string;
  clientLogoUrl?: string;
  legacyWorkshopId?: string; // FK → workshops.id — necessário para manter FK em maintenance_orders
  status: 'active' | 'inactive';
  invitedAt?: string;
  acceptedAt?: string;
}
```

### WorkshopInvitation
```ts
interface WorkshopInvitation {
  id: string;
  clientId: string;
  clientName?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}
```

### Client
```ts
interface Client {
  id: string;
  name: string;
  logoUrl?: string;
}
```

### Vehicle
```ts
interface Vehicle {
  id: string;
  clientId: string;
  type: 'Passeio' | 'Utilitário' | 'Van' | 'Moto' | 'Vuc' | 'Toco' | 'Truck' | 'Cavalo';
  energySource: 'Combustão' | 'Elétrico' | 'Híbrido';
  coolingEquipment: boolean;

  // Campos condicionais
  semiReboque?: boolean;
  placaSemiReboque?: string;
  fuelType?: string;
  tankCapacity?: number;
  avgConsumption?: number;
  coolingBrand?: string;

  // Identificação
  licensePlate: string;
  renavam: string;
  chassi: string;
  detranUF: string;
  brand: string;
  model: string;
  year: number;
  color: string;

  // Operacional
  acquisition: 'Owned' | 'Rented' | 'Agregado';
  acquisitionDate?: string;
  fipePrice: number;
  tracker: string;
  antt: string;
  owner: string;
  status: 'Available' | 'Maintenance' | 'In Use';
  autonomy: number;
  tag?: string;

  // Documentos (URLs)
  crlvUpload?: string;
  sanitaryInspectionUpload?: string;
  grUpload?: string;
  grExpirationDate?: string;

  // Acessórios
  spareKey: boolean;
  vehicleManual: boolean;
  category?: 'Leve' | 'Médio' | 'Pesado';

  // Especificações de peso/capacidade
  pbt?: number;   // Peso Bruto Total (t)
  cmt?: number;   // Capacidade Máxima de Tração (t)
  eixos?: number; // Número de eixos

  // Associação motorista (1:1)
  driverId?: string;    // FK → drivers.id (nullable)
  driverName?: string;  // Nome do motorista (vem do JOIN, não persistido diretamente)

  // Associação logística (N:1 embarcador, N:1 unidade operacional)
  shipperId?: string;           // FK → shippers.id (nullable) — veículo pode estar fora de operação
  shipperName?: string;         // Nome do embarcador (vem do JOIN, não persistido diretamente)
  operationalUnitId?: string;   // FK → operational_units.id (nullable) — depende de shipperId
  operationalUnitName?: string; // Nome da unidade (vem do JOIN, não persistido diretamente)

  // Hodômetro inicial do veículo (rastreamento em checklists)
  initialKm?: number;           // Km de partida quando o veículo entrou na frota
}
```

### Shipper
```ts
interface Shipper {
  id: string;
  clientId: string;
  name: string;              // Obrigatório
  cnpj?: string;             // CNPJ único por cliente (armazenar somente dígitos)
  phone?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
}
```

### OperationalUnit
```ts
interface OperationalUnit {
  id: string;
  clientId: string;
  shipperId: string;         // FK obrigatória (RESTRICT on delete)
  shipperName?: string;      // Nome do embarcador (vem do JOIN, não persistido diretamente)
  name: string;              // Obrigatório
  code?: string;             // Código único por cliente
  city?: string;
  state?: string;            // UF (2 chars, normalizado uppercase)
  notes?: string;
  active: boolean;
  createdAt?: string;
}
```

### MaintenanceOrder (src/pages/Maintenance.tsx)
```ts
type MaintenanceStatus = 'Aguardando orçamento' | 'Aguardando aprovação' | 'Orçamento aprovado' | 'Serviço em execução' | 'Concluído' | 'Cancelado';
// 'Cancelado' é status terminal: sem Edit/Complete; não entra em cálculos de custo

interface MaintenanceOrder {
  id: string; os: string; vehicleId: string; workshopId: string;
  licensePlate: string; workshop: string; entryDate: string;
  expectedExitDate: string; type: 'Corretiva' | 'Preventiva' | 'Preditiva';
  status: MaintenanceStatus; description: string; mechanicName: string;
  estimatedCost: number; approvedCost?: number;
  createdBy: string; createdAt: string; notes?: string;
  workshopOs?: string;      // OS fornecida pela oficina (editável)
  currentKm?: number;       // Km atual do veículo (auto-extraído do PDF ou manual)
  budgetPdfUrl?: string;    // URL pública do PDF no Storage
  budgetStatus?: BudgetStatus; // sem_orcamento | pendente | aprovado | reprovado
  budgetReviewedBy?: string;   // nome do revisor (join)
  budgetReviewedAt?: string;
  cancelledAt?: string;     // ISO timestamp do cancelamento (auditoria)
  cancelledById?: string;   // profile_id de quem cancelou (auditoria)
}
```

### BudgetItem / BudgetStatus (src/lib/maintenanceMappers.ts)
```ts
type BudgetStatus = 'sem_orcamento' | 'pendente' | 'aprovado' | 'reprovado';

interface BudgetItem {
  id?: string; maintenanceOrderId?: string; clientId?: string;
  itemName: string; system: string;
  quantity: number; value: number; // valor unitário (R$)
  sortOrder: number;
}

function calcBudgetSubtotal(items: BudgetItem[]): number // sum(qty * value)
```

### Aprovação de Orçamentos — Regras de Permissão
```ts
const ALWAYS_APPROVE_ROLES = ['Coordinator', 'Director', 'Admin Master'];

function canApprove(user: User, budgetTotal: number): boolean {
  if (ALWAYS_APPROVE_ROLES.includes(user.role)) return true;
  return user.budgetApprovalLimit > 0 && budgetTotal <= user.budgetApprovalLimit;
}
// budgetApprovalLimit = 0 → sem permissão de aprovação
// Coordinator/Director/Admin Master → sempre podem aprovar (sem limite)
```

### VehicleFieldSettings
```ts
interface VehicleFieldSettings {
  id: string;
  clientId: string;
  // Booleans indicando se o campo é OPCIONAL (true) ou OBRIGATÓRIO (false)
  renavamOptional: boolean;
  chassiOptional: boolean;
  detranUFOptional: boolean;
  brandOptional: boolean;
  modelOptional: boolean;
  yearOptional: boolean;
  colorOptional: boolean;
  acquisitionOptional: boolean;
  acquisitionDateOptional: boolean;
  fipePriceOptional: boolean;
  trackerOptional: boolean;
  anttOptional: boolean;
  ownerOptional: boolean;
  autonomyOptional: boolean;
  tagOptional: boolean;
  crlvUploadOptional: boolean;
  sanitaryInspectionUploadOptional: boolean;
  grUploadOptional: boolean;
  grExpirationDateOptional: boolean;
  categoryOptional: boolean;
  spareKeyOptional: boolean;
  vehicleManualOptional: boolean;
  pbtOptional: boolean;
  cmtOptional: boolean;
  eixosOptional: boolean;
  initialKmOptional: boolean;
}
```

### Driver
```ts
interface Driver {
  id: string;
  clientId: string;
  profileId?: string;    // FK → profiles.id — todo motorista é automaticamente um usuário do sistema
  name: string;          // Sempre obrigatório
  cpf: string;           // Sempre obrigatório — armazenar somente dígitos (11 chars)
  issueDate?: string;
  expirationDate?: string;
  cnhUpload?: string;    // URL Storage (driver-documents)
  registrationNumber?: string;
  category?: string;     // A, B, AB, AE, ABCDE, etc.
  renach?: string;
  grUpload?: string;     // URL Storage
  grExpirationDate?: string;
  certificate1Upload?: string; // URL Storage
  courseName1?: string;
  certificate2Upload?: string;
  courseName2?: string;
  certificate3Upload?: string;
  courseName3?: string;
}
```

**Mudança chave (2026-03-14):** Adicionado campo `profileId` para ligar motorista a usuário do sistema. Todo motorista é automaticamente criado como usuário (via Edge Function) com role 'Driver'. Permite que Drivers vejam seu veículo associado ao fazer checklists.

### DriverFieldSettings
```ts
interface DriverFieldSettings {
  id: string;
  clientId: string;
  // true = opcional, false = obrigatório. Default: tudo obrigatório.
  issueDateOptional: boolean;
  expirationDateOptional: boolean;
  cnhUploadOptional: boolean;
  registrationNumberOptional: boolean;
  categoryOptional: boolean;
  renachOptional: boolean;
  grUploadOptional: boolean;
  grExpirationDateOptional: boolean;
  certificate1UploadOptional: boolean;
  courseName1Optional: boolean;
  certificate2UploadOptional: boolean;
  courseName2Optional: boolean;
  certificate3UploadOptional: boolean;
  courseName3Optional: boolean;
}

### Workshop
```ts
interface Workshop {
  id: string;
  clientId: string;
  name: string;
  cnpj: string;              // Armazenar somente dígitos (14 chars)
  phone?: string;            // Somente dígitos (até 11 chars)
  email?: string;
  contactPerson?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;     // UF (2 chars)
  addressZip?: string;       // CEP (8 digits)
  specialties?: string[];    // Array de especialidades (Mecânica Geral, Elétrica, Funilaria/Pintura, etc.)
  notes?: string;
  active: boolean;
  profileId?: string; // FK → profiles.id — quando preenchido, a oficina tem login próprio (role 'Workshop')
  createdAt?: string;
  updatedAt?: string;
}
```

### Checklist Types
```ts
type ChecklistContext = 'Rotina' | 'Auditoria' | 'Reboque' | 'Entrada em Oficina' | 'Saída de Oficina' | 'Segurança';
const WORKSHOP_CONTEXTS: ChecklistContext[] = ['Entrada em Oficina', 'Saída de Oficina']; // exigem seleção de oficina

interface ChecklistTemplate {
  id: string;
  clientId: string;
  vehicleCategory: VehicleCategory; // obrigatório
  context: ChecklistContext;         // obrigatório
  name: string;                      // gerado automaticamente: "Checklist [Categoria] [Contexto]"
  description?: string;
  currentVersion: number;
  status: 'draft' | 'published' | 'deprecated';
  allowDriverActions: boolean;
  allowAuditorActions: boolean;
}

interface ChecklistItem {
  id: string;
  templateId: string;
  versionNumber: number;
  title: string;
  description?: string;
  isMandatory: boolean;
  requirePhotoIfIssue: boolean;
  canBlockVehicle: boolean; // toggle por item, visível apenas em contexto Segurança
  defaultAction?: string;
  orderNumber: number;
}

interface Checklist {
  id: string;
  clientId: string;
  templateId: string;
  templateName?: string;           // from join
  templateContext?: ChecklistContext; // from join
  versionNumber: number;
  vehicleId?: string;
  vehicleLicensePlate?: string;   // from join
  filledBy: string;
  filledByName?: string;          // from join
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed';
  workshopId?: string;            // preenchido nos contextos Entrada/Saída de Oficina
  workshopName?: string;          // from join
  latitude?: number;
  longitude?: number;
  notes?: string;
  odometerKm?: number;            // Hodômetro do veículo no momento do preenchimento (obrigatório, >= último checklist)
}
```

## Multi-Tenancy

- **Padrão**: toda entidade tem `clientId` (TS) / `client_id` (Supabase)
- **Filtragem**: `useAuth().currentClient.id` em todas as queries
- **RLS**: Supabase policies filtram por `client_id` do token JWT
- **Admin Master**: pode ver/operar dados de qualquer client

## Mock Data (src/constants.ts)

- `MOCK_CLIENTS`: array de clientes de exemplo (não importado em nenhuma página ativamente)
- `MOCK_VEHICLES`: ainda usado por `Dashboard.tsx` (remover quando Dashboard migrar)
- **Status de migração**:
  - Clients → migrado (tabela `clients`)
  - Users → migrado (tabela `profiles` + auth.users)
  - Vehicles → **migrado** (tabela `vehicles` + RLS)
  - Drivers → **migrado** (tabela `drivers` + RLS; SQL em `supabase/migrations/create_drivers_tables.sql`)
  - Checklists → **migrado** (7 tabelas + seed em `create_checklist_tables.sql`; bucket `checklist-photos`)

## Schema Supabase (supabase/schema.sql)

Tabelas ativas:
- `profiles` (id UUID PK → auth.users, name, email, role, client_id FK → clients, can_delete_vehicles, can_delete_drivers, can_delete_workshops)
- `clients` (id UUID PK, name, logo_url)
- `vehicles` (id UUID PK, client_id FK → clients, brand, model, crlv_upload, renavam, chassi, etc. + check constraints atualizados para incluir 'Agregado' na aquisição; adicionado `driver_id UUID NULL FK → drivers(id) ON DELETE SET NULL` + `UNIQUE INDEX idx_vehicles_driver_unique WHERE driver_id IS NOT NULL` (garante 1:1); adicionado `shipper_id UUID NULL FK → shippers(id) ON DELETE SET NULL` e `operational_unit_id UUID NULL FK → operational_units(id) ON DELETE SET NULL`; **NOVO**: `initial_km INTEGER NULL` — hodômetro inicial do veículo)
- `vehicle_field_settings` (client_id PK/FK → clients, renavam_optional, chassi_optional, e demais flags de configurabilidade; **NOVO**: `initial_km_optional BOOLEAN DEFAULT false`)
- `shippers` (id UUID PK, client_id FK → clients, name NOT NULL, cnpj — UNIQUE(client_id, cnpj) nullable, phone, email, contact_person, notes, active, created_at) com RLS policies + índices
- `operational_units` (id UUID PK, client_id FK → clients, shipper_id UUID NOT NULL FK → shippers(id) ON DELETE RESTRICT, name NOT NULL, code, city, state, notes, active, created_at) com RLS policies + partial unique index `(client_id, code) WHERE code IS NOT NULL`
- `drivers` (id UUID PK, client_id FK, **profile_id UUID UNIQUE FK → profiles(id)**, name, cpf — UNIQUE(client_id, cpf), issue_date, expiration_date, cnh_upload, registration_number, category, renach, gr_upload, gr_expiration_date, certificate1_upload, course_name1, certificate2_upload, course_name2, certificate3_upload, course_name3) + INDEX idx_drivers_profile_id
- `driver_field_settings` (client_id PK/FK → clients, issue_date_optional, cnh_upload_optional, e demais flags)
- `workshops` (id UUID PK, client_id FK → clients, name, cnpj — UNIQUE(client_id, cnpj), phone, email, contact_person, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, specialties TEXT[], notes, active, created_at, updated_at) com RLS policies

Tabelas de checklists (ativas):
- `checklist_item_suggestions` (seed ~45 itens globais por categoria)
- `checklist_templates` (`context` TEXT NOT NULL CHECK IN ('Rotina','Auditoria','Reboque','Entrada em Oficina','Saída de Oficina','Segurança'), `vehicle_category` NOT NULL, status draft/published/deprecated; EXCLUDE constraint `unique_published_category_context` garante 1 publicado por client+category+context)
- `checklist_template_versions` (snapshots imutáveis)
- `checklist_items` (`can_block_vehicle` BOOLEAN NOT NULL DEFAULT false — usado em contexto Segurança)
- `checklists` (`workshop_id UUID NULL FK → workshops(id)` — preenchido nos contextos Entrada/Saída de Oficina; DELETE Admin Master only; **NOVO**: `odometer_km INTEGER NULL` — hodômetro do veículo no momento do preenchimento, obrigatório, não pode ser menor que o último checklist)
- `checklist_responses` (status ok/issue/skipped/not_applicable; CASCADE)

Tabelas de manutenção (ativas):
- `maintenance_orders` (os_number auto-gerado, workshop_os_number editável, current_km, budget_pdf_url, budget_status, budget_reviewed_by/at; status CHECK inclui 'Cancelado'; colunas de auditoria: cancelled_at TIMESTAMPTZ, cancelled_by_id UUID FK profiles)
- `maintenance_budget_items` (item_name, system, quantity, value unitário R$, sort_order; RLS rank >= 3 + Admin Master; save: delete-then-insert)
- `action_plans` (pending/in_progress/completed/cancelled; work_order_number; DELETE Admin Master only)
- `vehicle_km_intervals` (UNIQUE vehicle_id; km_interval INTEGER NULL; SELECT/INSERT/UPDATE Fleet Assistant+; DELETE Manager+; migration: `create_vehicle_km_intervals.sql`)
- `checklist_day_intervals` (UNIQUE client_id; rotina_day_interval INTEGER NULL, seguranca_day_interval INTEGER NULL; SELECT/INSERT/UPDATE Fleet Assistant+; DELETE Manager+; migration: `create_checklist_day_intervals.sql` ⚠️ EXECUTAR NO SUPABASE DASHBOARD)

### VehicleKmInterval
```typescript
interface VehicleKmInterval {
  id: string;
  clientId: string;
  vehicleId: string;
  kmInterval: number | null;
  updatedAt?: string;
  updatedBy?: string;
}
```

### ChecklistDayInterval
```typescript
interface ChecklistDayInterval {
  id: string;
  clientId: string;
  rotinaDayInterval: number | null;    // null = não configurado
  segurancaDayInterval: number | null; // null = não configurado
  updatedAt?: string;
  updatedBy?: string;
}
```

### Dashboard — Interfaces (src/components/dashboard/OperationalPanel.tsx)

**VehicleRow** — Subconjunto de Vehicle para queries do Dashboard
```typescript
interface VehicleRow {
  id: string;
  type: string;                          // Passeio | Utilitário | Van | Moto | Vuc | Toco | Truck | Cavalo
  crlv_year: string | null;              // Ano de validade do CRLV (ex: "2026")
  driver_id: string | null;              // FK → drivers.id
  initial_km?: number | null;            // Km inicial do veículo (linha de base)
  shipper_name?: string | null;          // Nome do embarcador (join shippers.name)
  operational_unit_name?: string | null; // Nome da unidade operacional (join operational_units.name)
}
```

**MaintenanceOrderDashboard** — Subconjunto de MaintenanceOrder para queries do Dashboard
```typescript
interface MaintenanceOrderDashboard {
  id: string;
  vehicle_id: string;              // FK → vehicles.id
  type: 'Corretiva' | 'Preventiva' | 'Preditiva';
  status: string;                  // 'Aguardando orçamento' | ... | 'Concluído'
  approved_cost: number | null;    // Custo aprovado (null = não aprovado ainda)
  current_km: number | null;       // Km atual do veículo
  vehicle_type: string | null;     // Tipo de veículo (join de vehicles.type)
}
```

**DashboardFilters** — Estado de filtros compartilhados entre painéis
```typescript
interface DashboardFilters {
  vehicleType: string | null;      // ex: 'Passeio' — null = sem filtro
  maintenanceType: string | null;  // ex: 'Corretiva' — null = sem filtro
}
```

**Notas:**
- VehicleRow NÃO inclui coluna `status` (não existe em vehicles table)
- MaintenanceOrderDashboard inclui `vehicle_type` via join com vehicles
- DashboardFilters aplicados client-side via useMemo (sem round-trips ao Supabase)
- Filtros são toggleáveis: mesmo valor = clear filtro

---

## Infraestrutura Offline (IndexedDB via Dexie)

Armazenamento local no browser — **sem migration de banco Supabase**.

### SyncOperation (discriminated union)
```typescript
type SyncOperation =
  | { type: 'save_response'; itemId: string; status: ResponseStatus; observation: string; photoUrl: string; pendingPhotoKey?: string; respondedAt: string }
  | { type: 'confirm_km'; odometerKm: number }
  | { type: 'confirm_workshop'; workshopId: string }
  | { type: 'finish_checklist'; completedAt: string; templateContext: ChecklistContext | null; workshopId?: string; vehicleId?: string };
```

### SyncQueueEntry (store: `syncQueue`)
```typescript
interface SyncQueueEntry {
  id?: number;           // PK auto-increment
  createdAt: number;     // Date.now() — ordem FIFO
  checklistId: string;
  op: SyncOperation;
  status: 'pending' | 'syncing' | 'error';
  errorMessage?: string;
  retryCount: number;    // >= 3 → status 'error' permanente
}
```

### PhotoBlobEntry (store: `photoBlobs`)
```typescript
interface PhotoBlobEntry {
  key: string;        // `${checklistId}/${itemId}/${timestamp}`
  blob: Blob;
  clientId: string;
  checklistId: string;
  itemId: string;
  capturedAt: number;
}
```

**Índices Dexie:**
- `syncQueue`: `++id, checklistId, status, createdAt`
- `photoBlobs`: `key, checklistId`

**Idempotência de replay:**
- `save_response` → upsert `onConflict: 'checklist_id,item_id'` (último vence)
- `confirm_km` / `confirm_workshop` → UPDATE simples (no-op em replay)
- `finish_checklist` → UPDATE status='completed' (no-op em replay)
- Fotos → `uploadChecklistPhoto` usa upsert no Storage

## Módulo de Gestão de Pneus

### TireVisualClassification / TirePositionType
```ts
type TireVisualClassification = 'Novo' | 'Meia vida' | 'Troca';
type TirePositionType = 'single' | 'dual_external' | 'dual_internal' | 'triple_external' | 'triple_middle' | 'triple_internal' | 'spare';
```

### AxleConfigEntry (configuração detalhada de eixos por veículo)
```ts
type AxleType = 'direcional' | 'simples' | 'duplo' | 'duplo_tandem' | 'triplo_tandem' | 'elevacao';
type RodagemType = 'simples' | 'dupla' | 'tripla';

interface AxleConfigEntry {
  order: number;          // 1-based
  type: AxleType;
  rodagem: RodagemType;
  physicalAxles: number;  // 1, 2 ou 3 (derivado do type)
}
```

Campos novos em `Vehicle`:
- `axleConfig?: AxleConfigEntry[]` — armazenado como JSONB em `vehicles.axle_config`
- `stepsCount?: number` — estepes de fábrica em `vehicles.steps_count`

### Tire
```ts
interface Tire {
  id: string; clientId: string; vehicleId: string;
  tireCode: string;          // Imutável após criação
  specification: string;     // ex: "295/80R22.5"
  dot?: string; fireMarking?: string; manufacturer?: string; brand?: string;
  rotationIntervalKm?: number; usefulLifeKm?: number; retreadIntervalKm?: number;
  visualClassification: TireVisualClassification;
  currentPosition: string;   // ex: E1, D2I, Step 1
  lastPosition?: string;
  positionType: TirePositionType;
  active: boolean;
  // JOIN fields:
  vehicleLicensePlate?: string; vehicleModel?: string; vehicleType?: string;
}
```

### TirePositionHistory
```ts
interface TirePositionHistory {
  id: string; clientId: string; tireId: string; vehicleId: string;
  previousPosition?: string; newPosition: string;
  movedAt: string; movedBy: string; movedByName?: string;
  reason?: string; odometerKm?: number;
}
```

### VehicleTireConfig
```ts
interface VehicleTireConfig {
  id: string; vehicleType: string;
  defaultAxles: number; defaultSpareCount: number;
  dualAxles: number[];  // ex: [2, 3] = eixos com rodagem dupla
}
```

**Tabelas:** `tires` (PK: id, UNIQUE: client_id+tire_code), `tire_position_history` (append-only), `vehicle_tire_configs` (seed pré-preenchido).
**Índice Parcial:** `idx_tires_active_position ON tires(vehicle_id, current_position) WHERE active = true` — garante 1 pneu ativo por posição por veículo.
**Colunas em vehicles:** `axle_config JSONB` + `steps_count INTEGER` (migration: `20260325081826_add_axle_config_vehicles.sql` — ⚠️ EXECUTAR NO SUPABASE DASHBOARD)
**Geração de posições:** `generatePositionsFromConfig(entries, stepsCount, vehicleType)` em `tirePositions.ts` — prioridade sobre fallback `generatePositions()` + `VehicleTireConfig`.
