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

### 4. `gemini-ocr`
- Extração de dados de documentos via **Gemini Vision (`gemini-2.5-flash`)**, com `inlineData`.
- Contrato: `POST /functions/v1/gemini-ocr` com `{ file_base64, mime_type, prompt }` e `Authorization: Bearer <jwt>`.
- **Validação server-side obrigatória** (`validation.ts`, funções puras) antes de qualquer chamada externa: MIME permitido (PDF/JPG/PNG/WEBP), **assinatura real do arquivo** (magic number), Base64 válido, máximo de 10 MB e teto de prompt. Respostas `400`/`413`/`415` conforme o caso.
- **Cota atômica por usuário** reservada *antes* da chamada ao Gemini, via RPC `public.consume_gemini_ocr_quota`: 20 chamadas e 100 MB por janela de 1h; excedente devolve `429` com `reason` e `retry_after_seconds`.
- A função tem **dois arquivos** (`index.ts` e `validation.ts`). Ao publicar pelo Dashboard, ambos precisam existir na mesma pasta, senão o deploy falha no import.
- Logs registram apenas status — nunca Base64, prompt completo, conteúdo do documento ou resposta do provedor.

### Outras funções publicadas
`delete-user`, `notify-fleet-ticket-telegram` e `workshop-partnership-manage` também estão ativas nos dois ambientes.

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

Há duas categorias distintas e elas **não** seguem a mesma regra de acesso.

**Buckets privados de documentos** — leitura só para usuário autenticado e autorizado:

1.  **`vehicle-documents`**: CRLV, Inspeção Sanitária, GR, apólice, contrato, orçamentos de manutenção, fotos de peças e evidências de plano de ação.
2.  **`driver-documents`**: CNH, GR, certificados e contrato PJ de motoristas.
3.  **`financial-documents`**: boletos, notas fiscais e evidências de pagamento.
4.  **`fleet-ticket-attachments`**: anexos de chamados.

**Bucket público de fotos operacionais:**

5.  **`checklist-photos`**: fotos capturadas durante inspeções. Permanece público por causa da operação offline de checklists e inspeção de pneus.

### Regras de Acesso a Documentos Privados
- **Nunca usar `getPublicUrl`** nos buckets privados. Ele só é válido para `checklist-photos`.
- O banco persiste o **caminho** do objeto (`{client_id}/...`), nunca uma URL.
- A visualização gera uma **URL assinada de 3600 segundos** sob demanda, via `getPrivateDocumentSignedUrl()` (`src/lib/storageHelpers.ts`) ou o hook `useStorageFileUrl` (`src/hooks/useStorageFileUrl.ts`).
- A URL assinada é um bearer link temporário: não pode ir para o banco, `localStorage`, logs ou query string da aplicação.
- Valores legados que ainda são URLs públicas continuam funcionando: `extractStoragePath()` os converte para caminho no momento da leitura, sem backfill destrutivo. Valores fora do bucket esperado são rejeitados.

### Regras de Upload
- **Imagens**: Comprimidas no lado do cliente (max 1920px, 82% JPEG).
- **PDFs**: Enviados em formato original.
- **Paths**: Sempre organizados por `client_id` para garantir isolamento físico.
- **Retorno**: uploads em buckets privados devolvem o **caminho**, não uma URL.
