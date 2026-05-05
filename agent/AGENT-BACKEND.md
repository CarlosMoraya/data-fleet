# AGENT-BACKEND - Padrões Técnicos de Servidor e API

Este guia define a arquitetura e os padrões para o backend do **βetaFleet**, utilizando o Supabase como infraestrutura principal.

## 🏗 Infraestrutura (Supabase)

- **Auth & Database**: Gerenciados diretamente via Supabase Dashboard.
- **Edge Functions**: Deploy manual via Dashboard UI (o projeto não utiliza CLI local).
- **Configuração do Client**: Localizado em `src/lib/supabase.ts` utilizando as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

---

## 🔐 Autenticação e Segurança

- **Provedor**: Supabase Auth (email/senha).
- **Gestão de Sessão**: Hook `useAuth()` via `AuthContext.tsx`.
- **Perfis**: Armazenados na tabela `profiles`, vinculados ao `auth.users.id`.
- **Hierarquia de Roles**:
  - `Driver(1) < Yard Auditor(2) < Workshop(1) < Fleet Assistant(3) < Fleet Analyst(4) < Supervisor(5) < Coordinator(6) < Manager(7) < Director(8) < Admin Master(9)`

---

## ⚡ Edge Functions Ativas

### 1. `create-user`
- Cria usuários no Auth e no Profile simultaneamente.
- Valida hierarquia de roles (não permite criar rank >= ao do criador).
- Endpoint: `POST /functions/v1/create-user`.

### 2. `workshop-invitation`
- Gera tokens criptográficos para convites de parceria (expiração em 30 dias).
- Permite revogar e listar convites pendentes.

### 3. `workshop-accept-invitation`
- Processo de onboarding para novas oficinas via token (sem necessidade de login prévio).
- Cria automaticamente conta de oficina (`workshop_account`) e parceria (`workshop_partnership`).

---

## 🔄 Padrões de Integração

### Mapeamento de Dados (Mappers)
Todo dado trafegado entre o Supabase (snake_case) e o Frontend (camelCase) deve passar pelos mappers em `src/lib/`:
- `vehicleMappers.ts`, `driverMappers.ts`, `workshopMappers.ts`, `maintenanceMappers.ts`, etc.

### Extração de Dados (OCR)
- **Fluxo**: Regex Tabular → Fallback para **Gemini Vision (gemini-2.5-flash)**.
- Localização: `src/lib/budgetOcr.ts`.

---

## 📂 Storage (Buckets)

1.  **`vehicle-documents`**: CRLV, Inspeção Sanitária, GR e evidências de manutenção.
2.  **`driver-documents`**: CNH, GR e certificados de motoristas.
3.  **`checklist-photos`**: Fotos capturadas durante inspeções (bucket público).

### Regras de Upload
- **Imagens**: Comprimidas no lado do cliente (max 1920px, 82% JPEG).
- **PDFs**: Enviados em formato original.
- **Paths**: Sempre organizados por `client_id` para garantir isolamento físico.
