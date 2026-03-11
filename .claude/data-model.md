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
  - Checklists → planejado (próximo passo)

## Schema Supabase (supabase/schema.sql)

Tabelas ativas:
- `profiles` (id UUID PK → auth.users, name, email, role, client_id FK → clients, can_delete_vehicles)
- `clients` (id UUID PK, name, logo_url)
- `vehicles` (id UUID PK, client_id FK → clients, brand, model, crlv_upload, renavam, chassi, etc. + check constraints atualizados)
- `vehicle_field_settings` (client_id PK/FK → clients, renavam_optional, chassi_optional, e demais flags de configurabilidade)

Tabelas planejadas:
- `checklist_templates`
- `checklists`
