# IMPLEMENTATION.md
Gerado em: 2026-07-04
Sessão: Semi-reboque/Implemento como ativo de primeira classe + engate/desengate (plano completo executável, 4 fases)
Tipo de mudança: Tipo 4 — Mudança estrutural/crítica (CHECK constraints em `vehicles`/`checklist_templates`/`profiles`, migração de dados em produção, novas tabelas + RLS, novo papel de acesso)
Baseado em: docs/SPEC.md (2026-06-22) + docs/MEMORY.md (2026-07-03) + agent/AGENT*.md

---

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação completa e fechada desta iniciativa. O agente de código que executar QUALQUER fase:

- NÃO toma decisões de arquitetura além do que está especificado aqui.
- NÃO cria arquivos além dos listados na etapa que estiver executando.
- NÃO modifica arquivos além dos listados na etapa que estiver executando.
- NÃO instala dependências (esta iniciativa NÃO introduz nenhuma dependência nova).
- NÃO refatora código não relacionado à tarefa. NÃO "melhora" código que não está causando problema.
- SE encontrar algo que parece errado mas não está neste documento: registra no `docs/MEMORY.md` como observação e continua — não corrige.

Qualquer decisão não prevista aqui deve ser tratada como: **parar, informar o usuário e aguardar instrução.**

### Como executar por fase (o usuário implementa aos poucos)
Cada fase é **autocontida e executável isoladamente**. O usuário abrirá uma sessão dizendo, por exemplo, *"Leia agent/AGENT.md e IMPLEMENTATION.md e execute apenas a Fase 2"*. O agente deve:
1. Ler as **Pré-condições da fase** e confirmar que a fase anterior está concluída (checar os "Critérios de conclusão" da fase anterior). Se não estiver, PARAR e avisar.
2. Executar as etapas **na ordem numérica**, respeitando as pré-condições de cada etapa.
3. Ao final, validar os "Critérios de conclusão" da fase.

### Ordem obrigatória entre fases
FASE 1 → FASE 2 → FASE 3 → FASE 4. Uma fase só começa após a anterior concluída, com migrations aplicadas em **dev e prod** e suíte verde. Bancos dev e prod são **separados** (ver `docs/MEMORY.md`): toda migration é validada em dev e só então promovida a prod, confirmando o `project ref` antes de executar. Backend/SQL/RLS sempre antes do frontend (Protocolo de 4 Fases, `agent/AGENT.md`).

---

## Contexto necessário
Antes de implementar QUALQUER etapa, leia obrigatoriamente:
- `agent/AGENT.md` — regras universais (Admin Master `client_id = NULL`; backend antes de frontend).
- `agent/AGENT-DATABASE.md` — RLS padrão-ouro por `client_id`; migrations manuais no SQL Editor do Supabase (NÃO há CLI de migração). Existe a função `public.role_rank(role)` e o padrão de RLS `(SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= N`.
- `agent/AGENT-FRONTEND.md` — React 19, Tailwind v4, persistência de UI via `usePersistentUiState`/`uiStateStorage`, offline-first Dexie (`src/lib/offline/offlineDb.ts`).
- `agent/AGENT-BACKEND.md` — Supabase, mappers snake_case↔camelCase em `src/lib/*Mappers.ts`, buckets `vehicle-documents`/`driver-documents`/`checklist-photos`, edge functions `create-user`/`delete-user`.

Arquivos-âncora por fase estão listados dentro de cada etapa.

---

## O produto e a mudança
**O que é este produto:** βetaFleet — plataforma multi-tenant de gestão de frota (veículos, motoristas, pneus, checklists, manutenção, oficinas), RLS por `client_id`, checklists offline-first, módulo de pneus/eixos por veículo.

**O que será implementado (visão geral):** tornar o **semi-reboque/implemento um ativo de primeira classe dentro da tabela `vehicles`** (reusando pneus, eixos, checklist, odômetro, documentos, RLS já chaveados por `vehicleId`) e registrar o **engate/desengate** com cavalos (próprios ou de terceiros) como evento temporal, com controle de km, anti-fraude e responsabilidade. **NÃO cria tabela/entidade paralela para o semi-reboque.**

---

## Padrões de mercado aplicados
- **Reuse-over-rebuild (Strangler Fig parcial)**: semi-reboque entra em `vehicles`; flag legado `semiReboque` estrangulado por etapas (mantido 1 release para rollback).
- **Expand/Contract**: constraints/colunas primeiro expandidas, dados migrados, legado contraído só depois.
- **Event Sourcing leve**: engate/desengate é registro temporal append-only (`coupled_at`/`uncoupled_at`).
- **Command/correction espelhado**: lançamento/correção de backoffice do engate reusa o padrão security-definer de `vehicle_odometer_corrections`.
- **Capability no backend (RLS + papel)**: novo papel `Coupling Agent` com superfície mínima; separação externo×interno no alcance de RLS, nunca só na UI.
- **View `security_invoker`**: km efetivo/derivado da carreta segue o padrão de `vehicle_odometer_effective_readings`.

---

## Pré-condições (globais)
- Suíte verde confirmada em 2026-07-04: `npm run lint` (0 erros, 104 warnings pré-existentes aceitos), `npm run test:unit` (707 passando / 72 arquivos), `npm run test:smoke` (6 passando).
- App em `http://localhost:3000`; `.env.local` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Acesso ao SQL Editor do Supabase de **dev** e **prod**.
- Nenhuma dependência nova em nenhuma fase.

---

## Funções e módulos reutilizados (NÃO reimplementar)
- `src/lib/fieldSettingsMappers.ts` → `isFieldRequired`, `CONFIGURABLE_FIELDS`.
- `src/components/AxleConfigEditor.tsx` — editor de eixos.
- Módulo de pneus (`tires`, `TireInspection`, `axleConfigSnapshot`) chaveado por `vehicleId`.
- Mappers `src/lib/*Mappers.ts` (padrão snake_case↔camelCase; cada um tem `.test.ts`).
- `src/lib/rolePermissions.ts` (`ROLE_RANK`, `getRoleRank`, capability functions) e `src/types/role.ts`.
- Padrão SQL: tabela append-only + RLS por `role_rank` + view `security_invoker` de `vehicle_odometer_corrections` (`supabase/migrations/20260622000000_create_vehicle_odometer_corrections.sql`), com `source_context` adicionado em `20260622010002_odometer_effective_readings_origin.sql`.
- Edge functions `create-user`/`delete-user` para provisionar/remover o login do terceiro.
- `src/lib/offline/offlineDb.ts` (Dexie versionado) para hashes e rascunhos offline.
- `src/components/VehicleDetailModal.tsx` — onde vivem abas/badges do detalhe do veículo.
- `src/pages/ChecklistFill.tsx` + rota `checklists/preencher/:checklistId` — fluxo de preenchimento com GPS/foto/timestamp/km.

---

## Restrições absolutas — o que NÃO fazer (toda a iniciativa)
- NÃO criar tabela/entidade paralela para o semi-reboque. Ele é um registro em `vehicles`.
- NÃO somar eixos da carreta no cadastro do cavalo. Cada ativo configura só os seus, cada um no seu `AxleConfigEditor`.
- NÃO gravar composição/PBTC em `vehicles`. É visão calculada (Fase 4).
- NÃO amarrar o km da carreta ao odômetro absoluto do último cavalo. Acúmulo sempre por delta durante cada engate (Fase 3).
- NÃO tocar o KPI `CostPanel.tsx:254` ("Custos com Reboque"): é placeholder de custo, não é `ChecklistContext`.
- NÃO criar dois papéis para engate externo × interno. Um único papel `Coupling Agent`; diferença no alcance de RLS/ciclo de conta.
- NÃO reusar o papel `Driver` para o terceiro.
- NÃO expor a lista de carretas ao terceiro — apenas hashes das placas válidas+desvinculadas; validação definitiva no servidor.
- NÃO instalar bibliotecas novas.

---
---

# FASE 1 — Semi-reboque/Implemento como ativo + rename de vocabulário

**Classificação:** Tipo 4. **Objetivo:** destravar cadastro, eixos, pneus, checklist, manutenção e documentos do implemento por reuso, e liberar "reboque" do sentido de guincho.

**Pré-condições da fase:** suíte verde (Pré-condições globais). Nenhuma fase anterior.

**Decisões fechadas (não reabrir):** tipos novos = `Semirreboque`, `Reboque`, `Dolly` (os três, uma migração só); rótulo do context renomeado = `'Guincho'` puro; flag legado do Cavalo mantido como texto livre + nota de descontinuação (migração só na Fase 2); CMT×PBT fica para a Fase 4.

**Ordem:** 1.1 (SQL) → 1.2 (tipos TS) → 1.3 (rename UI) → 1.4 (VehicleForm) → 1.5 (arrays dependentes) → 1.6 (testes).

---

### Etapa 1.1 — Migração SQL (lote único: tipos + categoria + rename de context)

**Padrão aplicado:** Expand/Contract (só Expand aqui; nada removido).

**Pré-condições de entrada:** suíte verde; acesso ao SQL Editor de dev; confirmar `project ref` de dev.

**Contexto autocontido (estado atual verificado):**
- `vehicles_type_check` = `CHECK (type IN ('Passeio','Utilitário','Van','Moto','Vuc','Toco','Truck','Cavalo'))` (`supabase/migrations/fix_vehicle_type_constraint.sql`).
- `vehicles_category_check` = `CHECK (category IS NULL OR category IN ('Leve','Médio','Pesado','Elétrico'))` (`20260619000000_align_vehicle_columns.sql`).
- `checklist_templates_context_check` = `CHECK (context IN ('Rotina','Auditoria','Reboque','Entrada em Oficina','Saída de Oficina','Segurança','Atualização de Hodômetro'))` (`20260622010000_add_odometer_update_context.sql`).
- `checklist_templates.vehicle_category` é nullable, com `check_free_form_or_category`. NÃO alterar essa constraint.

**O que fazer:** criar `supabase/migrations/20260704000000_semitrailer_asset_and_guincho_rename.sql`, nesta ordem:
1. Rename de context (dado antes da constraint):
   - `UPDATE public.checklist_templates SET context = 'Guincho' WHERE context = 'Reboque';`
   - `ALTER TABLE public.checklist_templates DROP CONSTRAINT IF EXISTS checklist_templates_context_check;`
   - `ALTER TABLE public.checklist_templates ADD CONSTRAINT checklist_templates_context_check CHECK (context IN ('Rotina','Auditoria','Guincho','Entrada em Oficina','Saída de Oficina','Segurança','Atualização de Hodômetro'));`
2. Tipo de veículo:
   - `ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;`
   - `ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_type_check CHECK (type IN ('Passeio','Utilitário','Van','Moto','Vuc','Toco','Truck','Cavalo','Semirreboque','Reboque','Dolly'));`
3. Categoria:
   - `ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_category_check;`
   - `ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_category_check CHECK (category IS NULL OR category IN ('Leve','Médio','Pesado','Elétrico','Semi-reboque/Implemento'));`
4. `NOTIFY pgrst, 'reload schema';`
5. Ao final, bloco comentado `-- ROLLBACK` com os inversos exatos (reverter context para `'Reboque'`, recriar as 3 constraints sem os valores novos, `NOTIFY`), com nota de que reverter tipo/categoria só é seguro se nenhum registro usar valor novo.

**Arquivos a criar:** `supabase/migrations/20260704000000_semitrailer_asset_and_guincho_rename.sql` (não deve alterar `check_free_form_or_category` nem `unique_published_category_context`).
**Arquivos a modificar:** nenhum.

**Restrições:** NÃO aplicar em prod nesta etapa (só dev); NÃO remover valores legados; NÃO renomear context fora de `checklist_templates.context`.

**Verificação de saída (dev):**
- `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='vehicles_type_check';` contém `Semirreboque`,`Reboque`,`Dolly`.
- `... conname='vehicles_category_check';` contém `Semi-reboque/Implemento`.
- `... conname='checklist_templates_context_check';` contém `Guincho` e NÃO contém `Reboque`.
- `SELECT count(*) FROM public.checklist_templates WHERE context='Reboque';` = `0`.

**Regra de parada:** se alguma constraint divergir do estado verificado (nome/definição), PARAR, registrar em `docs/MEMORY.md`, aguardar.

---

### Etapa 1.2 — Tipos TypeScript

**Pré-condições:** 1.1 concluída e verificada em dev.

**Contexto:** `src/types/vehicle.ts:10` (union `type`), `:50` (union `category`); `src/types/checklist.ts:3` (`VehicleCategory`), `:5` (`ChecklistContext`).

**O que fazer:**
1. `vehicle.ts:10` → acrescentar `'Semirreboque' | 'Reboque' | 'Dolly'` após `'Cavalo'`.
2. `vehicle.ts:50` → acrescentar `'Semi-reboque/Implemento'`.
3. `checklist.ts:3` → acrescentar `'Semi-reboque/Implemento'` a `VehicleCategory`.
4. `checklist.ts:5` → trocar `'Reboque'` por `'Guincho'` em `ChecklistContext`.

**Modificar:** `src/types/vehicle.ts`, `src/types/checklist.ts`. Permanece: `semiReboque`/`placaSemiReboque`, `WORKSHOP_CONTEXTS`, `ODOMETER_UPDATE_CONTEXT`.

**Verificação:** `npm run lint` = 0 erros (o `tsc` pode acusar `'Reboque'` de context nos arquivos da Etapa 1.3 — resolvidos lá).

**Regra de parada:** se `tsc` acusar consumidor de context fora de `ChecklistTemplateForm.tsx`/`ChecklistTemplates.tsx`/`checklistTemplateRules.test.ts`/`CostPanel.tsx`, PARAR e registrar.

---

### Etapa 1.3 — Rename de vocabulário na UI (`'Reboque' → 'Guincho'`)

**Pré-condições:** 1.2 concluída.

**Contexto (verificado):** `ChecklistTemplateForm.tsx:55` (`{ value:'Reboque', label:'Reboque', description:'Inspeção específica para reboques' }`); `ChecklistTemplates.tsx:242` (array de filtros com `'Reboque'`).

**O que fazer:**
1. `ChecklistTemplateForm.tsx:55` → `{ value: 'Guincho', label: 'Guincho', description: 'Inspeção de veículo sendo guinchado até a oficina' }`.
2. `ChecklistTemplates.tsx:242` → `'Reboque'` vira `'Guincho'`.

**Restrições:** NÃO tocar `CostPanel.tsx:254`; NÃO usar rótulo `'Reboque (Guincho)'`.

**Verificação:** `grep -rn "'Reboque'" src/ --include=*.ts --include=*.tsx` não retorna uso como context (aceitável só a label livre do KPI e `placaSemiReboque`/`semiReboque`); `npm run lint` = 0 erros.

**Regra de parada:** outro arquivo persistindo context `'Reboque'` → PARAR e registrar.

---

### Etapa 1.4 — `VehicleForm`: categoria "Semi-reboque/Implemento" + campos condicionais

**Pré-condições:** 1.2 e 1.3 concluídas.

**Contexto (`src/components/VehicleForm.tsx`, verificado):** `CATEGORY_TYPES_MAP` (~201); `<select name="category">` (~602-608, só Leve/Médio/Pesado); `<select name="type">` (~665-684); `<select name="energySource">` (~686-692); PBT/CMT/Eixos (~694-706); `AxleConfigEditor` (~708-724); bloco `type==='Cavalo'` com `semiReboque`/`placaSemiReboque` (~726-740); bloco `energySource==='Combustão'` (~742-758); seção "Motorista Responsável" `driverId` (~863-895); handler `name==='category'` (~236-249).

**Campos a esconder quando `category==='Semi-reboque/Implemento'`:** `fuelType`, `tankCapacity`, `avgConsumption`, `energySource`, `driverId`, `cmt`. **Manter:** `pbt`, `eixos`, `AxleConfigEditor`, documentos/seguro/contrato/garantia/logística, identificação.

**O que fazer:**
1. `CATEGORY_TYPES_MAP` → adicionar `'Semi-reboque/Implemento': ['Semirreboque','Reboque','Dolly']`; garantir todas as chaves de `VehicleCategory` presentes (inclui `'Elétrico'`, já existente) para o `tsc`.
2. `<select name="category">` → adicionar `<option value="Semi-reboque/Implemento">Semi-reboque/Implemento</option>`.
3. Após leitura de `formData`, criar `const isImplement = formData.category === 'Semi-reboque/Implemento';`.
4. Envolver com `!isImplement &&`: o `<select name="energySource">` + bloco Combustão; o campo CMT; a seção "Motorista Responsável" inteira. (O bloco `type==='Cavalo'` já não aparece p/ implemento — manter condicionado a `type==='Cavalo'`.)
5. Manter renderizando quando `isImplement`: PBT, Eixos, `AxleConfigEditor`, documentos/seguro/contrato/garantia/logística.
6. Ao virar implemento, o handler `name==='category'` já autoseleciona o 1º `type` compatível. `energySource` mantém default `'Combustão'` no `formData` mesmo oculto (coluna NOT NULL) — NÃO remover o default.
7. Texto de ajuda nos eixos do Cavalo (quando `type==='Cavalo'`): `<p class="mt-1 text-xs text-zinc-400">` = "Informe apenas os eixos do cavalo mecânico; os do semi-reboque são cadastrados no próprio semi-reboque."
8. Nota de descontinuação no flag legado (bloco `type==='Cavalo'`): `<p class="mt-1 text-xs text-amber-600">` = "Campo em descontinuação: em breve o semi-reboque será um cadastro próprio (ativo) vinculado por engate. Continue preenchendo por ora."

**Modificar:** `src/components/VehicleForm.tsx` (só os pontos acima). Permanece: draft/persistência, uploads, OCR CRLV, validações de submit, comportamento de Leve/Médio/Pesado.

**Restrições:** NÃO remover campos escondidos do tipo `Vehicle`/`formData`; NÃO mudar obrigatoriedade além do que `isFieldRequired` já define; NÃO alterar `AxleConfigEditor`; NÃO mexer no `energySource` de categorias não-implemento.

**Verificação:** `npm run lint` = 0 erros; manual guiada (documentar no PR): categoria "Semi-reboque/Implemento" → `type` só `Semirreboque/Reboque/Dolly`, campos de cavalo ocultos, PBT/Eixos/editor de eixos presentes; categoria "Pesado" + `type=Cavalo` → ajuda de eixos e nota de descontinuação presentes.

**Regra de parada:** se `CATEGORY_TYPES_MAP` exigir `type` inexistente ou chave não resolvível pelos literais da Etapa 1.2, PARAR e registrar.

---

### Etapa 1.5 — Arrays/labels dependentes de `type`/`category`

**Pré-condições:** 1.4 concluída.

**Contexto (verificado):** `CostPanel.tsx:36` `VEHICLE_TYPES`; `ChecklistTemplates.tsx:31` `CATEGORY_LABEL`; `ChecklistTemplates.tsx:228` filtros de categoria; `ChecklistTemplateForm.tsx:46` `CATEGORY_OPTIONS`; `fieldSettingsMappers.ts:232` nota de `placaSemiReboqueOptional`.

**O que fazer:**
1. `CostPanel.tsx:36` → adicionar `'Semirreboque','Reboque','Dolly'` a `VEHICLE_TYPES`.
2. `ChecklistTemplates.tsx:31` → `CATEGORY_LABEL` recebe `'Semi-reboque/Implemento': 'Semi-reboque/Implemento'`.
3. `ChecklistTemplates.tsx:228` → filtros recebem `'Semi-reboque/Implemento'`.
4. `ChecklistTemplateForm.tsx:46` → `CATEGORY_OPTIONS` recebe `{ value:'Semi-reboque/Implemento', label:'Semi-reboque/Implemento' }`.
5. `fieldSettingsMappers.ts:232` → nota vira `'Quando Tipo = Cavalo (campo legado, em descontinuação)'`.

**Modificar:** `CostPanel.tsx`, `ChecklistTemplates.tsx`, `ChecklistTemplateForm.tsx`, `fieldSettingsMappers.ts` (só os pontos acima).
**Restrições:** NÃO alterar a label/valor do KPI (só `VEHICLE_TYPES`); NÃO adicionar chaves a `CONFIGURABLE_FIELDS`.
**Verificação:** `npm run lint` = 0 erros; `grep -n "Semi-reboque/Implemento"` nos dois arquivos de checklist retorna as adições.
**Regra de parada:** outro `switch`/enumeração exaustiva de `type`/`category` sem default que quebre → PARAR e registrar.

---

### Etapa 1.6 — Testes

**Pré-condições:** 1.1–1.5 concluídas.

**Contexto:** `checklistTemplateRules.test.ts:15` usa `'Reboque'`; existe `src/components/VehicleForm.test.tsx` no working tree; não há teste da visibilidade condicional por categoria.

**O que fazer:**
1. `checklistTemplateRules.test.ts:15` → `'Reboque'` vira `'Guincho'`.
2. Estender `src/components/VehicleForm.test.tsx` (ou criar `src/components/VehicleForm.implement-fields.test.tsx`):
   - `category='Semi-reboque/Implemento'` → `fuelType`/`tankCapacity`/`avgConsumption`/`energySource`/`cmt` e a seção "Motorista Responsável" ausentes; `pbt`/`eixos` presentes.
   - `category='Pesado'`, `type='Cavalo'` → nota de descontinuação e ajuda de eixos presentes.
   - Edge: alternar "Pesado"→"Semi-reboque/Implemento" seleciona `type='Semirreboque'`.

**Justificativa de camada:** estado visual condicional → teste de componente (Vitest/RTL, padrão do projeto). Rename de context → unit + verificação SQL da 1.1.

**Verificação:** `npm run test:unit` todos passando; `npm run lint` = 0 erros.
**Regra de parada:** se exigir mudar a assinatura pública (props) de `VehicleForm`, PARAR e registrar.

---

## Critérios de conclusão — FASE 1
- [ ] Migração `20260704000000_...sql` aplicada e verificada em **dev**.
- [ ] Migração promovida a **prod** (confirmando `project ref`) e verificada.
- [ ] `npm run lint`=0 erros; `npm run test:unit` todos passando; `npm run test:smoke`=6 passando.
- [ ] Manual guiada da 1.4 registrada.
- [ ] Sem uso remanescente do context `'Reboque'` (só a label livre do KPI permanece).

---
---

# FASE 2 — Engate/desengate + terceiros + anti-fraude + migração do flag legado

**Classificação:** Tipo 4. **Objetivo:** engate/desengate como evento temporal, com login mínimo do terceiro, anti-fraude e migração segura do flag legado.

**Pré-condições da fase:** Fase 1 concluída (todos os critérios; migrations em dev e prod). Suíte verde.

**Ordem:** 2.1 (SQL entidades+RLS) → 2.2 (SQL contexts+migração legado) → 2.3 (tipos/mappers/papel/RPC) → 2.4 (frontend terceiro+anti-fraude) → 2.5 (checklist+superfícies de status) → 2.6 (testes+aplicar migração legado).

**Checklist de segurança (ativado — dados pessoais, autenticação, upload, funcionalidade de terceiros):** requisitos PENDENTE viram etapas abaixo; resolvidos em 2.1/2.3/2.4.

---

### Etapa 2.1 — SQL: cadastro decoplado de terceiro + entidade de engate + RLS

**Padrão aplicado:** tabela append-only + RLS por `role_rank` (espelha `vehicle_odometer_corrections`).

**Pré-condições de entrada:** Fase 1 em dev/prod; `project ref` de dev confirmado.

**Contexto (verificado):** existe `public.role_rank(role)`; padrão RLS `(SELECT public.role_rank(role) FROM public.profiles WHERE id=auth.uid()) >= N`; `Fleet Assistant`=rank 3; Admin Master tem `client_id=NULL` e entra com `OR role='Admin Master'`. Buckets: `vehicle-documents`, `driver-documents`.

**O que fazer:** criar `supabase/migrations/20260711000000_coupling_and_third_party.sql` com:
1. **`third_party_tractor`** (cadastro extensível; só placa é usada na UI da Fase 2, resto reservado nullable):
   - `id uuid PK default gen_random_uuid()`, `client_id uuid NOT NULL REFERENCES clients(id)`, `plate text NOT NULL`, `crlv_upload text`, `crlv_expiration_date date`, `antt text`, `gr_upload text`, `gr_expiration_date date`, `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL default now()`.
   - `UNIQUE (client_id, plate)`; índice em `(client_id, plate)`.
2. **`third_party_driver`** (extensível; só nome usado agora):
   - `id`, `client_id NOT NULL REFERENCES clients(id)`, `name text NOT NULL`, `cnh text`, `cnh_expiration_date date`, `phone text`, `address text`, `created_at`, `updated_at`.
3. **`vehicle_couplings`** (evento temporal):
   - `id`, `client_id uuid NOT NULL REFERENCES clients(id)`, `trailer_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE`, `tractor_id uuid REFERENCES vehicles(id) ON DELETE SET NULL` (**NULLABLE**), `tractor_plate text`, `tractor_driver_name text`, `third_party_tractor_id uuid REFERENCES third_party_tractor(id) ON DELETE SET NULL`, `third_party_driver_id uuid REFERENCES third_party_driver(id) ON DELETE SET NULL`, `coupled_at timestamptz NOT NULL default now()`, `uncoupled_at timestamptz` (NULL = engatado agora), `coupled_latitude numeric`, `coupled_longitude numeric`, `uncoupled_latitude numeric`, `uncoupled_longitude numeric`, `odometer_coupled numeric`, `odometer_uncoupled numeric`, `distance_km numeric`, `coupling_checklist_id uuid REFERENCES checklists(id) ON DELETE SET NULL`, `uncoupling_checklist_id uuid REFERENCES checklists(id) ON DELETE SET NULL`, `filled_by uuid NOT NULL REFERENCES profiles(id)`, `notes text`, `created_at`, `updated_at`.
   - `CHECK (tractor_id IS NOT NULL OR btrim(coalesce(tractor_plate,'')) <> '')` — sempre identificar o cavalo (registrado OU por placa; placa é a fonte da verdade quando `tractor_id` é nulo).
   - `CREATE UNIQUE INDEX uniq_open_coupling_per_trailer ON vehicle_couplings(trailer_id) WHERE uncoupled_at IS NULL;` (impede engate duplo).
   - Índices: `(trailer_id)`, `(tractor_id)`, `(client_id)`.
4. **RLS** nas três tabelas (`ENABLE ROW LEVEL SECURITY`):
   - SELECT: `(role_rank >= 3 AND client_id = <meu client_id>) OR role='Admin Master'` **OR** (para `vehicle_couplings` e leitura do próprio terceiro) `role='Coupling Agent' AND client_id = <meu client_id>`.
   - INSERT/UPDATE `vehicle_couplings`: `client_id = <meu client_id> AND (role_rank >= 3 OR role='Coupling Agent') OR role='Admin Master'`. `filled_by = auth.uid()`.
   - INSERT/UPDATE `third_party_*`: `client_id = <meu client_id> AND (role_rank >= 3 OR role='Coupling Agent') OR role='Admin Master'`.
   - Sem DELETE (append-only; desengate é UPDATE de `uncoupled_at`). Admin Master sempre incluso.
5. `NOTIFY pgrst, 'reload schema';` e bloco `-- ROLLBACK` (`DROP TABLE ... CASCADE` das três, na ordem inversa das FKs).

**Arquivos a criar:** `supabase/migrations/20260711000000_coupling_and_third_party.sql`.
**Restrições:** só dev nesta etapa; NÃO gravar composição/PBTC; `tractor_id` DEVE ser nullable; NÃO criar policy de DELETE.
**Verificação (dev):** `\d vehicle_couplings` mostra colunas e o índice parcial; tentar 2 INSERTs abertos para o mesmo `trailer_id` → o 2º falha (unique parcial); `SELECT tablename FROM pg_tables WHERE tablename IN ('third_party_tractor','third_party_driver','vehicle_couplings');` = 3 linhas; `rowsecurity` = true nas três.
**Regra de parada:** se `public.role_rank` não existir com essa assinatura, ou o CHECK de `profiles.role` não puder receber `Coupling Agent` na Etapa 2.3, PARAR e registrar.

---

### Etapa 2.2 — SQL: contexts `'Engate'`/`'Desengate'` + migração do flag legado

**Pré-condições de entrada:** 2.1 concluída em dev.

**Contexto (verificado):** `checklist_templates_context_check` após Fase 1 contém `'Guincho'`. Colunas legadas em `vehicles`: `semi_reboque boolean`, `placa_semi_reboque text` (nomes snake_case; confirmar com `\d vehicles`).

**O que fazer:** criar `supabase/migrations/20260711000100_coupling_contexts_and_legacy_migration.sql`:
1. Estender o context:
   - `ALTER TABLE public.checklist_templates DROP CONSTRAINT IF EXISTS checklist_templates_context_check;`
   - `ADD CONSTRAINT ... CHECK (context IN ('Rotina','Auditoria','Guincho','Engate','Desengate','Entrada em Oficina','Saída de Oficina','Segurança','Atualização de Hodômetro'));`
2. **Migração do flag legado** (idempotente, em `DO $$ ... $$`): para cada `vehicles v` com `v.semi_reboque = true AND btrim(coalesce(v.placa_semi_reboque,'')) <> ''` que ainda não tenha implemento vinculado:
   - INSERT em `vehicles` um implemento mínimo: `client_id=v.client_id`, `license_plate=v.placa_semi_reboque`, `type='Semirreboque'`, `category='Semi-reboque/Implemento'`, `active=true`, `energy_source='Combustão'` (default NOT NULL), demais campos NOT NULL preenchidos com o mínimo válido (documentar no comentário quais e com quê — ex.: `brand='(migrado)'`, `model='(migrado)'`, `year=extract(year from now())`). Capturar o `id` gerado.
   - INSERT em `vehicle_couplings` um engate **aberto**: `trailer_id = <novo implemento>`, `tractor_id = v.id`, `tractor_plate = v.license_plate`, `coupled_at = now()`, `filled_by = <um profile de sistema/aplicante>` — usar `v` sem `filled_by` do usuário? `filled_by` é NOT NULL: usar o `created_by`/owner do cliente ou um Admin Master; **documentar a escolha exata no comentário** e, se não houver profile elegível, PULAR o vínculo e registrar.
   - NÃO remover `semi_reboque`/`placa_semi_reboque` (mantidos 1 release para rollback).
3. `NOTIFY pgrst, 'reload schema';` e bloco `-- ROLLBACK` (reverter constraint; e, para o dado, `DELETE` dos couplings e implementos criados por esta migração — para isso, marcar os implementos criados com `tag='migrated-legacy-semireboque'` para permitir rollback seguro).

**Arquivos a criar:** `supabase/migrations/20260711000100_coupling_contexts_and_legacy_migration.sql`.
**Restrições:** migração idempotente (rodar 2× não duplica); NÃO deletar/alterar colunas legadas; sem perda de dado.
**Verificação (dev):** rodar 2× → contagem de implementos migrados estável; cada `vehicles.semi_reboque=true` com placa tem exatamente 1 implemento + 1 coupling aberto; constraint contém `Engate`/`Desengate`.
**Regra de parada:** se `vehicles` tiver colunas NOT NULL sem default que a migração não consiga preencher de forma segura, PARAR e registrar a lista de colunas — não inventar valores de negócio arbitrários além dos marcadores `(migrado)` documentados.

---

### Etapa 2.3 — Papel `Coupling Agent` + tipos + mappers + RPC de backoffice

**Pré-condições de entrada:** 2.1 e 2.2 concluídas em dev.

**Contexto (verificado):** `src/types/role.ts` (union `Role`); `src/lib/rolePermissions.ts` (`ROLE_RANK`, `ROLE_LABELS`, `ROLE_COLORS`, `getDefaultRouteForRole`, `canAccessRoute`, `TENANT_USER_ROLE_OPTIONS`). Constraint `profiles_role_check` em migration de roles. Mappers seguem `src/lib/*Mappers.ts` com `.test.ts`.

**O que fazer:**
1. **SQL** `supabase/migrations/20260711000200_add_coupling_agent_role.sql`: `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check; ADD CONSTRAINT profiles_role_check CHECK (role IN (... todos os atuais ..., 'Coupling Agent'));` + `NOTIFY pgrst`. (Obter a lista atual com `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='profiles_role_check';` e apenas ACRESCENTAR `'Coupling Agent'`.)
2. **RPC security-definer de backoffice** `public.insert_coupling_backoffice(...)` (espelha o padrão de correção de odômetro): recebe os campos do engate/desengate; valida `role_rank(auth.uid) >= 3 AND client_id do usuário`; grava em `vehicle_couplings` com `filled_by = auth.uid()`. `SECURITY DEFINER`, `SET search_path=public`, `GRANT EXECUTE ... TO authenticated`. (Fonte da verdade do "quem puxou" = `tractor_plate`+`tractor_driver_name`; `filled_by` = quem lançou.)
3. **`src/types/role.ts`** → adicionar `'Coupling Agent'` ao union.
4. **`src/lib/rolePermissions.ts`** → `ROLE_RANK['Coupling Agent']=0` (superfície mínima, abaixo de Driver não é possível; usar 0 e diferenciar por capability, NÃO por rank); `ROLE_LABELS['Coupling Agent']='Operador de Engate'`; `ROLE_COLORS['Coupling Agent']='bg-teal-100 text-teal-700'`; adicionar `export const ROLES_CAN_FILL_COUPLING: Role[] = ['Coupling Agent','Fleet Assistant','Fleet Analyst','Supervisor','Operations Manager','Coordinator','Manager','Director','Admin Master'];` e `export function canFillCoupling(role): boolean`; em `getDefaultRouteForRole` → `if (role==='Coupling Agent') return '/engate';`; em `canAccessRoute` → `Coupling Agent` só acessa rotas que começam com `/engate` (espelhar o padrão `OPERATIONS_MANAGER_ALLOWED_ROUTES` com um `COUPLING_AGENT_ALLOWED_ROUTES=['/engate','/conta/senha']`). **Correção de plano:** `Coupling Agent` continua fora de `ROLES_WITH_ACCESS`, mas DEVE aparecer no fluxo existente de `Novo Usuário` (`TENANT_USER_ROLE_OPTIONS`/modal de usuários) para que o login seja provisionado pela UI já existente. O isolamento permanece por rota/RLS, não por ausência de opção de cadastro.
5. **Tipos+mappers** novos: `src/types/coupling.ts` (`VehicleCoupling`, `ThirdPartyTractor`, `ThirdPartyDriver`), `src/lib/couplingMappers.ts` + `couplingMappers.test.ts`, `src/lib/thirdPartyMappers.ts` + `thirdPartyMappers.test.ts` (padrão snake↔camel dos mappers existentes). Exportar em `src/types/index.ts`.

**Arquivos a criar:** as 2 migrations acima, `src/types/coupling.ts`, `src/lib/couplingMappers.ts`(+test), `src/lib/thirdPartyMappers.ts`(+test).
**Arquivos a modificar:** `src/types/role.ts`, `src/lib/rolePermissions.ts`, `src/types/index.ts`.
**Restrições:** NÃO reusar `Driver`; NÃO dar ao `Coupling Agent` acesso a rotas de frota; separação por RLS (2.1) + `canAccessRoute`, não só UI.
**Verificação:** `npm run lint`=0; `npm run test:unit` inclui os testes de mapper + um teste em `rolePermissions.test.ts` garantindo que `canAccessRoute('Coupling Agent','/cadastros/veiculos')===false` e `=== true` para `/engate`.
**Regra de parada:** se a lista atual de `profiles_role_check` não puder ser lida, PARAR e registrar.

---

### Etapa 2.4 — Frontend: login mínimo do terceiro + identificação da carreta + anti-fraude

**Pré-condições de entrada:** 2.3 concluída.

**Contexto (verificado):** rotas em `src/App.tsx` (rotas protegidas sob `<Layout />`; guards por rank); `src/lib/offline/offlineDb.ts` (Dexie versionado — hoje na `version(3)`); buckets/compressão de imagem em `src/lib/storageHelpers.ts`; provisionamento de usuário via edge function `create-user`.

**O que fazer:**
1. **RPC de lookup anti-fraude** `public.lookup_trailer_for_coupling(p_plate text)` (SECURITY DEFINER, search_path public): retorna **apenas** `{ exists boolean, available boolean }` para o `client_id` do chamador — `exists` = há `vehicles` com `type IN ('Semirreboque','Reboque','Dolly')` e essa placa; `available` = não há `vehicle_couplings` aberto para esse `trailer_id`. **NUNCA** retorna id/lista/inventário. `GRANT EXECUTE TO authenticated`.
2. **Rota `/engate`** em `src/App.tsx`: nova página `src/pages/CouplingAgent.tsx` sob `<Layout />`, mas com guard que **só** permite `Coupling Agent` (e frota `canFillCoupling` para teste interno). Nenhum item de menu de frota é exibido para `Coupling Agent` (a Sidebar já filtra por rota/rank — garantir que `Coupling Agent` veja só "Engate").
3. **Fluxo de identificação** em `CouplingAgent.tsx`: input de **digitação** da placa (nunca `<select>` de carretas) → chama `lookup_trailer_for_coupling` → só prossegue se `exists && available`; mensagens: não existe / já vinculada.
4. **Anti-fraude:** foto obrigatória, geolocalizada (usar a captura de GPS já existente no fluxo de checklist) e datada, da placa física; comprimir via `storageHelpers`; subir no bucket `checklist-photos` (path por `client_id`). GPS ancorado no último desengate/pátio conhecido → **ALERTA** não-bloqueante se distância > limiar.
5. **Offline:** em `offlineDb.ts` adicionar `version(4)` com store `couplingPlateHashes` (hash das placas válidas+desvinculadas do tenant) e store de rascunho do engate. **NÃO** armazenar a lista de placas — só hashes (usar `crypto.subtle` já disponível em contexto seguro; ver memória `feedback_secure_context_testing`). A validação definitiva roda no servidor no sync (lookup RPC).
6. **Provisionamento pela UI existente:** o papel `Operador de Engate` deve aparecer no modal `Novo Usuário` do backoffice (`src/pages/Users.tsx` e, quando aplicável, `src/pages/AdminUsers.tsx`), reutilizando a edge function `create-user`. **NÃO** criar tela paralela de cadastro nem fluxo alternativo de autenticação.

**Arquivos a criar:** `supabase/migrations/20260711000300_lookup_trailer_rpc.sql`, `src/pages/CouplingAgent.tsx`.
**Arquivos a modificar:** `src/App.tsx` (rota), `src/lib/offline/offlineDb.ts` (version 4), Sidebar (arquivo `src/components/Sidebar.tsx` — filtrar itens para `Coupling Agent`), `src/pages/Users.tsx` e `src/pages/AdminUsers.tsx` para expor o papel no `Novo Usuário`.
**Restrições:** NUNCA embarcar/expor lista de carretas; lookup só devolve `exists`/`available`; GPS é alerta, não bloqueio; provisionar login do terceiro via `create-user` com role `Coupling Agent` (NÃO criar fluxo de auth novo).
**Verificação:** `npm run lint`=0; manual guiada: logar como `Coupling Agent` → vê só "Engate"; digitar placa inexistente → bloqueia; placa existente e livre → prossegue; foto sem GPS → bloqueia; `/cadastros/veiculos` redireciona (guard).
**Regra de parada:** se a Sidebar/guards usarem um mecanismo diferente do esperado (rank-only sem hook por rota), PARAR e registrar antes de adaptar.

---

### Etapa 2.5 — Frontend: checklist Engate/Desengate + superfícies de status

**Pré-condições de entrada:** 2.4 concluída.

**Contexto (verificado):** `src/pages/ChecklistFill.tsx` + rota `checklists/preencher/:checklistId`; contexts dirigem templates; `src/components/VehicleDetailModal.tsx` (abas/badges do detalhe).

**O que fazer:**
1. Ligar os contexts `'Engate'`/`'Desengate'` ao fluxo de checklist (templates desses contexts aparecem no `ChecklistFill`/`Checklists` como os demais). Ao concluir um checklist de Engate, criar `vehicle_couplings` aberto (via RPC `insert_coupling_backoffice` ou insert direto conforme RLS), gravando `coupling_checklist_id`, GPS, `odometer_coupled` quando cavalo registrado; ao concluir Desengate, dar UPDATE em `uncoupled_at`, `uncoupling_checklist_id`, GPS, `odometer_uncoupled`, e calcular `distance_km` (Fase 3 refina o cálculo; aqui grava o informado/derivado simples).
2. **`VehicleDetailModal.tsx`:** para implemento (`category='Semi-reboque/Implemento'`), badge de status "Engatado/Desvinculado" + aba **"Histórico de Engates"** listando `vehicle_couplings` do `trailer_id`. Para cavalo registrado, aba/espelho listando couplings onde `tractor_id = <cavalo>`.
3. **Painel de frota "Engates/Pátio":** nova rota `/engates` (frota, `hasRoleAccess`) com lista de couplings abertos/fechados do tenant. Adicionar item na Sidebar para frota.

**Arquivos a criar:** `src/pages/CouplingsPanel.tsx` (rota `/engates`).
**Arquivos a modificar:** `src/App.tsx`, `src/components/VehicleDetailModal.tsx`, `src/pages/ChecklistFill.tsx` (hook pós-conclusão para Engate/Desengate), Sidebar.
**Restrições:** reusar a infra offline de checklist (não duplicar); NÃO expor esse painel ao `Coupling Agent`.
**Verificação:** `npm run lint`=0; manual guiada: concluir checklist de Engate cria coupling aberto e o badge/aba refletem; Desengate fecha e mostra `distance_km`; painel `/engates` lista corretamente.
**Regra de parada:** se `ChecklistFill` não tiver um ponto de hook pós-conclusão claro, PARAR e registrar (não forçar).

---

### Etapa 2.6 — Testes + aplicação da migração do flag legado (dev→prod)

**Pré-condições de entrada:** 2.1–2.5 concluídas em dev.

**O que fazer:**
1. Testes unitários: mappers (2.3), `canFillCoupling`/`canAccessRoute` do `Coupling Agent` (2.3), cálculo simples de `distance_km`, e um teste do RPC de lookup (mock) garantindo que **não** vaza inventário (retorna só `exists`/`available`).
2. Teste E2E ou validação manual guiada do fluxo Engate→Desengate (offline-first).
3. Aplicar as migrations 2.1/2.2/2.3/2.4 em **dev** (se ainda não), validar, e **promover a prod** (confirmando `project ref`), rodando a migração do flag legado em prod com verificação de contagem.

**Verificação:** `npm run lint`=0; `npm run test:unit` todos passando; `npm run test:smoke`=6; migração legada em prod verificada (contagem estável, idempotente).
**Regra de parada:** qualquer divergência de schema entre dev e prod → PARAR e registrar antes de promover.

---

## Critérios de conclusão — FASE 2
- [ ] Tabelas `third_party_tractor`, `third_party_driver`, `vehicle_couplings` + RLS em dev e prod; índice parcial anti-engate-duplo ativo.
- [ ] Papel `Coupling Agent` no CHECK de `profiles.role` e no frontend (rota isolada `/engate`, sem acesso a frota).
- [ ] Contexts `'Engate'`/`'Desengate'` disponíveis; badge/aba "Histórico de Engates" e painel `/engates` funcionando.
- [ ] Migração do flag legado aplicada em dev e prod, idempotente, sem perda de dado (colunas legadas preservadas).
- [ ] `npm run lint`=0; `npm run test:unit` passando; `npm run test:smoke`=6.
- [ ] Anti-fraude: lookup não expõe inventário; foto geolocalizada obrigatória; hashes offline (não a lista).

---
---

# FASE 3 — Km da carreta

**Classificação:** Tipo 3/4. **Objetivo:** km da carreta por setting do cliente (hubodômetro × acumulado por engate), sem amarrar ao odômetro absoluto do último cavalo.

**Pré-condições da fase:** Fase 2 concluída (couplings existentes) em dev e prod. Suíte verde.

**Ordem:** 3.1 (SQL setting + km view) → 3.2 (backend cálculo) → 3.3 (frontend) → 3.4 (testes).

---

### Etapa 3.1 — SQL: setting por cliente + origem das leituras

**Pré-condições de entrada:** Fase 2 em dev/prod.

**Contexto (verificado):** a view `public.vehicle_odometer_effective_readings` (`WITH security_invoker=true`) já expõe `source_context` (context do template) e `has_evidence` — este é o precedente de "origin". Leituras vêm de `checklists.odometer_km` (context `'Atualização de Hodômetro'`).

**O que fazer:** criar `supabase/migrations/20260718000000_trailer_km_settings_and_origin.sql`:
1. **`vehicle_km_source_settings`**: `id`, `client_id uuid NOT NULL UNIQUE REFERENCES clients(id)`, `trailer_km_mode text NOT NULL DEFAULT 'coupling_accumulated' CHECK (trailer_km_mode IN ('hubodometer','coupling_accumulated'))`, `updated_at`, `updated_by uuid REFERENCES profiles(id)`. RLS: SELECT rank>=3 do tenant + Admin Master; UPDATE/INSERT rank>=6 (Coordinator+) + Admin Master (espelha settings existentes).
2. Estender a semântica de **origin** das leituras: recriar `vehicle_odometer_effective_readings` acrescentando uma coluna computada `origin text` = `CASE WHEN t.context='Atualização de Hodômetro' AND v.type IN ('Semirreboque','Reboque','Dolly') THEN 'hubodometer' ELSE 'vehicle' END` (join com `vehicles v ON v.id=c.vehicle_id`). Preservar todas as colunas atuais da view. `GRANT SELECT ... TO authenticated`.
3. `NOTIFY pgrst` + `-- ROLLBACK` (recriar a view sem `origin`; drop da tabela de settings).

**Arquivos a criar:** a migration acima.
**Restrições:** NÃO amarrar km ao odômetro absoluto do cavalo; a view continua `security_invoker`.
**Verificação (dev):** `SELECT origin, count(*) FROM vehicle_odometer_effective_readings GROUP BY 1;` retorna `hubodometer` para leituras de implemento; `vehicle_km_source_settings` com RLS ativa.
**Regra de parada:** se a definição atual da view divergir do arquivo `20260622010002_...`, PARAR e recriar a partir da definição real (registrar).

---

### Etapa 3.2 — Backend: cálculo do km da carreta

**Pré-condições de entrada:** 3.1 concluída em dev.

**O que fazer:** criar `supabase/migrations/20260718000100_trailer_effective_km.sql` com uma função `public.trailer_effective_km(p_trailer_id uuid)` (SECURITY INVOKER, STABLE):
- Ler `trailer_km_mode` do cliente do implemento.
- **`hubodometer`**: `MAX(effective_km) - MIN(effective_km)` (ou último, conforme regra do dashboard) sobre `vehicle_odometer_effective_readings` do `trailer_id` com `origin='hubodometer'`.
- **`coupling_accumulated`**: `SUM(distance_km)` de `vehicle_couplings` fechados do `trailer_id`. `distance_km` é definido no **desengate** (Etapa 2.5), agora refinado:
  - cavalo registrado (`tractor_id` não nulo): delta = `effective_km` do cavalo no `uncoupled_at` menos no `coupled_at` (janela do engate), via `vehicle_odometer_effective_readings` do `tractor_id`.
  - cavalo de terceiro (`tractor_id` nulo): `distance_km` = valor informado pelo operador no desengate (`odometer_uncoupled` - `odometer_coupled` se ambos informados, senão o campo manual).
- Atualizar o hook de conclusão do Desengate (2.5) para gravar `distance_km` por essa regra.
- `GRANT EXECUTE ... TO authenticated`.

**Arquivos a criar:** a migration acima.
**Arquivos a modificar:** `src/pages/ChecklistFill.tsx` (regra de `distance_km` no Desengate) e mapper se necessário.
**Restrições:** acúmulo sempre por delta durante o engate; NUNCA odômetro absoluto do último cavalo.
**Verificação (dev):** casos de teste SQL: cavalo registrado → delta correto; terceiro → valor manual; modo hubodômetro → MAX−MIN.
**Regra de parada:** se faltar leitura de odômetro do cavalo na janela, a função retorna o que houver e marca `NULL` — registrar; não inventar km.

---

### Etapa 3.3 — Frontend: setting + exibição do km

**Pré-condições de entrada:** 3.2 concluída.
**O que fazer:** em `src/pages/Settings.tsx` adicionar o controle do `trailer_km_mode` por cliente (hubodômetro × acumulado). Em `VehicleDetailModal.tsx` (implemento) exibir "Km da carreta" chamando `trailer_effective_km`. Mapper/serviço conforme padrão.
**Arquivos a modificar:** `src/pages/Settings.tsx`, `src/components/VehicleDetailModal.tsx` (+ serviço/mapper).
**Verificação:** `npm run lint`=0; manual: alternar modo muda a origem do km exibido.
**Regra de parada:** se `Settings.tsx` não tiver seção de settings por cliente compatível, PARAR e registrar.

### Etapa 3.4 — Testes
Unit do cálculo (`trailer_effective_km` por modo), teste do delta por janela de engate. `npm run test:unit` verde.

## Critérios de conclusão — FASE 3
- [ ] `vehicle_km_source_settings` + `origin` na view + `trailer_effective_km` em dev e prod.
- [ ] `distance_km` calculado por delta (cavalo registrado) e por informe manual (terceiro).
- [ ] Setting no Settings; km exibido no detalhe do implemento.
- [ ] Suíte verde.

---
---

# FASE 4 — Composições, PBTC e evoluções futuras

**Classificação:** Tipo 4. **Objetivo:** composições (bitrem/rodotrem), PBTC combinado (calculado), CRLV vencido no engate, QR sem conta.

**Pré-condições da fase:** Fase 3 concluída em dev e prod. Suíte verde.

**Ordem:** 4.1 → 4.2 → 4.3 → 4.4 (independentes entre si; podem ser executadas em sub-sessões separadas, cada uma com sua verificação).

---

### Etapa 4.1 — Composições (bitrem/rodotrem)
- SQL `supabase/migrations/20260725000000_coupling_position.sql`: adicionar `position smallint NOT NULL DEFAULT 1` em `vehicle_couplings` (ordem do implemento no conjunto) e ajustar o índice parcial anti-duplo para `(trailer_id) WHERE uncoupled_at IS NULL` (mantém) + permitir múltiplos trailers por `tractor_id` aberto (bitrem). Frontend: fluxo de engate permite N implementos por cavalo.
- Verificação: engatar 2 implementos ao mesmo cavalo cria 2 couplings abertos com `position` 1 e 2.

### Etapa 4.2 — PBTC combinado + alerta CMT×PBT
- **Visão calculada** (NÃO gravada): função/serviço que soma `pbt` dos implementos engatados + tara do cavalo e compara com `cmt` do cavalo. Exibir na tela de engate/painel. Alerta não-bloqueante quando `Σ PBT > CMT`.
- Arquivos: serviço de cálculo + exibição em `CouplingsPanel.tsx`/tela de engate. NÃO persistir PBTC.
- Verificação: conjunto com Σ PBT > CMT mostra alerta; nada é gravado em `vehicles`.

### Etapa 4.3 — QR sem conta (link de uso único)
- Reavaliar tensão com offline-first antes de implementar. Edge function que gera token de uso único por carreta; tela pública de engate sem login. **Só implementar após validar** que não quebra o fluxo offline/IndexedDB do `Coupling Agent`. Se conflitar, registrar como não-recomendado e parar.

### Etapa 4.4 — CRLV vencido do cavalo-terceiro no engate
- Usar `third_party_tractor.crlv_expiration_date` (reservado na Fase 2). No engate, se o cavalo-terceiro tiver CRLV vencido, alertar/bloquear ("CRLV vencido"). Preencher a UI dos campos extras de `third_party_tractor` (CRLV+validade) nesta etapa.
- Verificação: engate com CRLV vencido dispara o alerta/bloqueio configurado.

## Critérios de conclusão — FASE 4
- [ ] Composições suportadas (position); PBTC calculado e exibido (não gravado); alerta CMT×PBT.
- [ ] CRLV vencido do terceiro tratado no engate; QR sem conta implementado OU registrado como não-recomendado com justificativa.
- [ ] Suíte verde.

---
---

## Suite completa ao final (de CADA fase)
```
npm run lint && npm run test:unit && npm run test:smoke
```
Esperado: lint 0 erros; unit todos passando (≥707 + novos da fase); smoke 6 passando.

---

## Segurança (consolidado)
- **Multi-tenant:** todo objeto novo tem RLS por `client_id` + `OR role='Admin Master'`. Terceiro (`Coupling Agent`) restrito por RLS **e** `canAccessRoute` — nunca vê inventário/frota.
- **Anti-fraude (Fase 2):** lookup só devolve `exists`/`available`; foto geolocalizada obrigatória; GPS ancorado (alerta); hashes offline, nunca a lista de placas; validação definitiva no servidor.
- **Uploads:** foto de placa reusa `checklist-photos` (validação de tipo real, limite, path por `client_id`).
- **LGPD (Fase 2):** dados do terceiro (nome; futuramente CNH/telefone/endereço) — finalidade documentada, informação ao titular, exclusão via `delete-user`/DELETE administrativo. Provisionamento e desativação do login do terceiro via `create-user`/`delete-user`.
- **Auth:** papel `Coupling Agent` não escala privilégio (rank 0, capability própria); separação no backend.
- **Fase 1:** sem dado pessoal novo; risco de migração de constraint/dado mitigado por Expand/Contract + rollback + dev antes de prod.

## Tratamento de erros
- **Migrations:** falha de `ADD CONSTRAINT` por dado divergente → investigar com `SELECT DISTINCT`; NÃO usar `NOT VALID`. Migração de dado idempotente e com marcador de rollback (`tag='migrated-legacy-semireboque'`).
- **Engate duplo:** o índice parcial único levanta violação → capturar e mostrar "Carreta já engatada".
- **VehicleForm (1.4):** mantém o tratamento de `23505` existente; implemento sem motorista é válido.
- **Lookup/coupling:** placa inexistente/indisponível → mensagem específica, nunca vazar inventário.

## Decisões tomadas nesta sessão (para o agente não "corrigir")
- Categoria "Semi-reboque/Implemento" é uma **nova `VehicleCategory`** (não `type` sob categoria existente); como `VehicleCategory===TemplateCategory`, o implemento ganha checklists próprios — intencional.
- Tipos `Semirreboque/Reboque/Dolly` juntos na Fase 1 (uma migração de constraint).
- Context renomeado = `'Guincho'` puro.
- Flag legado permanece na Fase 1 (nota de descontinuação); migração na Fase 2, sem perda de dado, colunas mantidas 1 release.
- `CostPanel.tsx` "Custos com Reboque" NÃO é o context — não tocar.
- `energySource` mantém default `'Combustão'` mesmo oculto para implemento (coluna NOT NULL).
- Engate/desengate é papel `Coupling Agent` (um único), separação externo×interno por RLS/ciclo de conta — não por papéis distintos, não reusando `Driver`.
- "Origin" das leituras (prompt) é materializado como a coluna computada `origin` na view `vehicle_odometer_effective_readings` (precedente: `source_context`), não coluna física em uma tabela de leituras.

## Observações para sessões futuras
- **Débito técnico:** 104 warnings de lint pré-existentes (`react-hooks/rules-of-hooks` condicionais) — fora do escopo; não corrigir aqui.
- **Bundle único ~1,96 MB** (sem code splitting em App.tsx) — ver `docs/MEMORY.md` `project_perf_protocol`; adicionar as novas páginas com `lazy` se o bundle crescer relevante.
- **QR sem conta (4.3)** só depois de validar compatibilidade com offline-first.

## Após a implementação (de cada fase)
1. Atualizar `docs/MEMORY.md` com o estado da fase concluída.
2. Mover detalhes para `docs/MEMORY-HISTORY.md`.
3. Sugerir commit (o usuário executa após validar):
```
git add docs/MEMORY.md docs/MEMORY-HISTORY.md [arquivos da fase] supabase/migrations/[migrations da fase]
git commit -m "feat(fleet): [descrição objetiva da fase]"
```
- `IMPLEMENTATION.md` é transitório e NÃO entra no commit por padrão (só se o usuário pedir).
- Migrations manuais: aplicar no SQL Editor (dev → prod), confirmando `project ref`.
