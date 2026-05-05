# SPEC - Especificação Técnica (βetaFleet)

Este documento detalha a arquitetura técnica, o modelo de dados e os contratos de API do sistema.

## 🏗️ Arquitetura do Sistema

O **βetaFleet** segue uma arquitetura de Single Page Application (SPA) com Backend as a Service (BaaS).

### Fluxo de Dados
1.  **Client**: React 19 + Vite (Roteamento via React Router).
2.  **State**: React Query para cache de dados e sincronização remota.
3.  **Local Storage**: Dexie (IndexedDB) para fila de sincronização offline.
4.  **BaaS**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).

---

## 📂 Modelo de Dados (Schema)

### Entidades Principais
- **Clients**: `id (PK)`, `name`, `logo_url`.
- **Profiles**: `id (PK)`, `role`, `client_id (FK)`, `workshop_account_id (FK)`.
- **Vehicles**: `id (PK)`, `license_plate`, `type`, `axle_config (JSONB)`, `shipper_id (FK)`.
- **Tires**: `id (PK)`, `tire_code`, `visual_classification`, `active`.

### Relacionamentos Críticos
- **Vehicle ↔ Driver**: 1:1 (via `vehicles.driver_id`).
- **Shipper ↔ OperationalUnit**: 1:N.
- **WorkshopAccount ↔ Client**: N:M (via `workshop_partnerships`).

---

## 📡 Contratos de API (Edge Functions)

| Função | Método | Endpoint | Payload (Resumo) |
| :--- | :--- | :--- | :--- |
| `create-user` | POST | `/functions/v1/create-user` | `{ email, password, role, name, clientId }` |
| `workshop-invitation` | POST | `/functions/v1/workshop-invitation` | `{ action: 'create', clientId }` |
| `validate-token` | RPC | `rpc/validate_workshop_token` | `{ p_token: string }` |

---

## 🛡️ Camada de Segurança (RLS)

As políticas de RLS são aplicadas no nível da linha, garantindo que usuários de um tenant não acessem dados de outro.

**Exemplo de Política (Checklists):**
```sql
CREATE POLICY "Assistant see tenant checklists" 
ON checklists FOR SELECT 
USING (
  (client_id = auth.jwt()->>'client_id' AND (SELECT role_rank FROM profiles WHERE id = auth.uid()) >= 3)
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'Admin Master'
);
```

---

## 🚀 Plano de Fases (Roadmap Técnico)

1.  **Fase 1 (Concluída)**: Bootstrap, Auth e Cadastros Básicos.
2.  **Fase 2 (Concluída)**: Checklists, Gestão de OS e OCR.
3.  **Fase 3 (Concluída)**: Módulo de Pneus e Multi-Parcerias de Oficina.
4.  **Fase 4 (Atual)**: Estabilização de Testes e Refatoração de Performance.
5.  **Fase 5 (Futura)**: Telemetria em tempo real e Integração com Rastreadores.
