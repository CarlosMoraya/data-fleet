# Modelo de Dados

## Interfaces TypeScript (src/types.ts)

### Role
```ts
type Role = 'Driver' | 'Yard Auditor' | 'Fleet Assistant' | 'Fleet Analyst' | 'Manager' | 'Director' | 'Admin Master';
```

### Hierarquia de Roles
```
Driver(1) < Yard Auditor(2) < Fleet Assistant(3) < Fleet Analyst(4) < Manager(5) < Director(6) < Admin Master(7)
```

**Regras:**
- Usuário só pode criar/editar roles abaixo do seu nível
- Client switching: apenas Manager(5)+
- Área admin (`/admin/*`): apenas Admin Master(7)
- Gestão de usuários (`/users`): Fleet Assistant(3)+
- **Exclusão de veículos**: Manager(5)+ sempre, ou Fleet Analyst(4) se o flag `canDeleteVehicles` estiver ativo.
- **Exclusão de motoristas**: Manager(5)+ sempre, ou Fleet Analyst(4) se o flag `canDeleteDrivers` estiver ativo.
- **Exclusão de oficinas**: Manager(5)+ sempre, ou Fleet Analyst(4) se o flag `canDeleteWorkshops` estiver ativo.
- Route guard: Driver/Yard Auditor → redirect para `/checklists`

### User
```ts
interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string; // tenant primário
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
  canDeleteWorkshops: boolean;
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
  acquisition: 'Owned' | 'Rented';
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
}
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
  createdAt?: string;
  updatedAt?: string;
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
- `vehicles` (id UUID PK, client_id FK → clients, brand, model, crlv_upload, renavam, chassi, etc. + check constraints atualizados)
- `vehicle_field_settings` (client_id PK/FK → clients, renavam_optional, chassi_optional, e demais flags de configurabilidade)
- `vehicles` — adicionado: `driver_id UUID NULL FK → drivers(id) ON DELETE SET NULL` + `UNIQUE INDEX idx_vehicles_driver_unique WHERE driver_id IS NOT NULL` (garante 1:1)
- `drivers` (id UUID PK, client_id FK, **profile_id UUID UNIQUE FK → profiles(id)**, name, cpf — UNIQUE(client_id, cpf), issue_date, expiration_date, cnh_upload, registration_number, category, renach, gr_upload, gr_expiration_date, certificate1_upload, course_name1, certificate2_upload, course_name2, certificate3_upload, course_name3) + INDEX idx_drivers_profile_id
- `driver_field_settings` (client_id PK/FK → clients, issue_date_optional, cnh_upload_optional, e demais flags)
- `workshops` (id UUID PK, client_id FK → clients, name, cnpj — UNIQUE(client_id, cnpj), phone, email, contact_person, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, specialties TEXT[], notes, active, created_at, updated_at) com RLS policies

Tabelas de checklists (ativas):
- `checklist_item_suggestions` (seed ~45 itens globais)
- `checklist_templates` (is_free_form, vehicle_category nullable, status draft/published/deprecated)
- `checklist_template_versions` (snapshots imutáveis)
- `checklist_items` (por template_id + version_number)
- `checklists` (vehicle_id nullable para templates Livre; DELETE Admin Master only)
- `checklist_responses` (status ok/issue/skipped/not_applicable; CASCADE)
- `action_plans` (pending/in_progress/completed/cancelled; work_order_number; DELETE Admin Master only)
