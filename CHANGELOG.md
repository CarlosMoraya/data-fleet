# Changelog — βetaFleet

## 2026-04-05 — Fix: Recursão Infinita RLS (workshop_partnerships)

**Problema:** Após execução da migration `20260404000000_workshop_partnership.sql`, todas as queries que transitavam por `maintenance_orders` falhavam com erro PostgreSQL `42P17` (infinite recursion detected in policy for relation "workshop_partnerships").

**Raiz do problema:** Ciclo de dependência entre duas RLS policies:
- `wpart_workshop_select` (workshop_partnerships) → acessava `workshop_accounts`
- `wa_client_select` (workshop_accounts) → acessava `workshop_partnerships`

Essa recursão era disparada ao consultar `vehicles` via `workshop_vehicle_select` → `maintenance_orders` → `workshop_partnerships` ↔ `workshop_accounts`.

**Solução:** Reescrita de `wpart_workshop_select` para usar `profiles.workshop_account_id` diretamente (FK adicionado pela migration), eliminando o cross-reference com `workshop_accounts`.

**Migration:** `supabase/migrations/20260405000000_fix_workshop_partnership_rls.sql` ✅ Executada no Supabase Dashboard

**Arquivos Modificados:**
- `supabase/migrations/20260405000000_fix_workshop_partnership_rls.sql` — Nova migration com o fix
- `supabase/migrations/20260404000000_workshop_partnership.sql` — Policy `wpart_workshop_select` corrigida para consistência

---

## 2026-04-05 — Fix: E2E Tests 08 e 09 (Workshop Partnership)

**Correção de validação e seletores E2E:**

- **Teste 08 (Editar Oficina)**: Adicionado atributo `title="Editar"` ao botão de editar em Workshops.tsx (linha 331) para que o seletor Playwright `button[title="Editar"]` encontre o elemento corretamente
- **Teste 09 (CNPJ Duplicado)**: Implementada pré-verificação de CNPJ duplicado em `saveMutation` (Workshops.tsx, linhas 101-108) antes do INSERT. Query busca workshop existente com mesmo `client_id` + `cnpj`; se encontrado, lança erro com código 23505 que `WorkshopForm.handleSubmit` já trata, exibindo "Este CNPJ já está cadastrado para este cliente." no modal sem fechá-lo
- **Status**: Todos 14 testes do workshop partnership passing (suite completa deve rodar serialmente — testes 08-09 dependem de 04 para state inicial)

**Arquivos Modificados:**
- `src/pages/Workshops.tsx` — Adicionado `title="Editar"` e pré-check CNPJ em saveMutation
- `.claude/arch-frontend.md` — Documentado CNPJ check e edit button selector
- `.claude/testing.md` — Adicionada documentação de workshop partnership tests (14 casos)

---

## 2026-04-05 — Opção B: Oficina como Referência ou Parceira

**Separação dos modelos de criação de oficina:**

- **"Cadastrar Oficina"** (ex "Adicionar Oficina") — apenas cadastro de referência, sem criação de login nem acesso ao sistema
- **"Convidar Oficina Parceira"** — acesso real via convite + partnership (modelo de login mantido)
- Tabela de oficinas ganhou coluna **"Tipo"**: badge azul "Parceira" (tem `workshop_partnership` ativa) ou cinza "Referência"
- Removido badge "Acesso ativo" da coluna Status (substituído pela coluna Tipo)
- `WorkshopForm.tsx`: removida seção "Acesso ao Sistema" (loginEmail/loginPassword), `onSave` simplificado para `(workshop: Partial<Workshop>) => Promise<void>`
- `Workshops.tsx`: `saveMutation` não chama mais Edge Function `create-user`; query `partnerWorkshopIds` classifica oficinas; botão renomeado; `colSpan` 7→8

**Promoção de oficina de referência ao aceitar convite:**

- `workshop-accept-invitation`: busca registro em `workshops` pelo mesmo CNPJ+client_id antes de criar novo
- Se encontrado: promove o registro existente (update com profile_id + dados do workshop_account) em vez de inserir duplicata
- FKs de `maintenance_orders.workshop_id` permanecem intactas após promoção

**Modal "Convidar Oficina" — fix de autenticação:**

- Substituído `supabase.functions.invoke()` por `fetch()` direto com `invokeFn()` helper
- `supabase.auth.getSession()` garante que o JWT do usuário é enviado (não a anon key)
- Erro real da Edge Function agora exibido no modal
- Edge Functions `workshop-invitation`, `workshop-partnership-manage` e `workshop-accept-invitation`: opção **"Verify JWT"** desativada no Supabase Dashboard (as funções fazem validação própria com service role)

**Arquivos Modificados:**
- `src/components/WorkshopForm.tsx` — removida seção de login; `onSave` simplificado
- `src/pages/Workshops.tsx` — query `partnerWorkshopIds`, coluna Tipo, saveMutation simplificado, botão renomeado
- `src/components/InviteWorkshopModal.tsx` — `invokeFn()` via `fetch()` direto com JWT explícito
- `supabase/functions/workshop-accept-invitation/index.ts` — promoção por CNPJ match
- **Supabase Dashboard**: "Verify JWT" desativado nas 3 funções acima

---

## 2026-03-26 — Visibilidade de Embarcador, Unidade Operacional e Finalidade na Tabela de Veículos

**Exibição de informações de alocação e uso de veículos na lista:**

- Tabela de Veículos em `/cadastros/veiculos` agora exibe **Embarcador** e **Unidade Operacional** em coluna única (stacked) com quebra de linha
- Nova coluna **Finalidade** com field `vehicleUsage` (Operação | Uso Administrativo | Uso por Lideranças | Outros)
- Coluna **Motorista** agora quebra nome após o segundo nome para evitar desproporção (ex: "João da" / "Silva Santos")
- Quando campos vazios: exibem `—` em cinza para clareza visual
- Colunas totais: 7 (Veículo | Tipo/Energia | Proprietário | Motorista | Embarcador/Unid.Op. | Finalidade | Ações)
- Dados já vinham da query via `.select('*, drivers(name), shippers(name), operational_units(name)')`
- Tipos Vehicle já possuíam `shipperName`, `operationalUnitName` e `vehicleUsage` — apenas renderização ajustada

**Arquivos Modificados:**
- `src/pages/Vehicles.tsx` — Tabela atualizada: header + cells com novo layout stackable para Embarcador/Unid.Op.; quebra de linha em Motorista; `colSpan` ajustado de 5 para 7
- `.claude/arch-frontend.md` — Documentado padrão visual e layout de Vehicles.tsx

---

## 2026-03-25 — Exclusão de Pneus para Admin Master

**Funcionalidade de exclusão permanente de pneus:**

- Admin Master pode deletar pneus cadastrados permanentemente
- Ícone `Trash2` (vermelho) na coluna Ações da tabela de pneus em `/pneus`
- Modal de confirmação `DeleteConfirmModal` com aviso de ação irreversível
- Histórico de movimentação deletado automaticamente via `ON DELETE CASCADE`
- RLS policy `tires_delete` já existia na migration `20260324000000_create_tire_management.sql` — permite DELETE para Director/Admin Master com bypass de client_id para Admin Master
- Frontend restrito a Admin Master apenas via `ROLES_CAN_DELETE_TIRES = ['Admin Master']`

**Arquivos Modificados:**
- `src/pages/Tires.tsx` — Adicionado import `Trash2`, constante `ROLES_CAN_DELETE_TIRES`, booleano `canDelete`, state `tireToDelete`, mutation `deleteMutation`, componente `DeleteConfirmModal`, botão delete na tabela, renderização do modal
- `.claude/arch-frontend.md` — Documentada exclusão em seção Tires.tsx
- `.claude/arch-backend.md` — Clarificada RLS policy `tires_delete` com suporte a Admin Master

**⚠️ Nenhuma migration adicional necessária** — RLS já suporta a operação.

---

## 2026-03-25 — Configuração Detalhada de Eixos em Veículos

**Configurador dinâmico de eixos no cadastro de veículos com cálculo automático de pneus:**

- Campo `eixos` agora dispara um editor dinâmico "Configuração de Eixos" (oculto para Moto)
- Cada eixo configurável: **Tipo de Eixo** (direcional, simples, duplo, duplo_tandem, triplo_tandem, elevação) + **Rodagem** (simples, dupla, tripla)
- Regras de negócio: primeiro eixo fixo como Direcional; rodagem tripla proibida no primeiro eixo; tipos multi-eixo (duplo=2, triplo_tandem=3) consomem múltiplos slots e filtram opções disponíveis
- Campo "Estepes de fábrica" (`stepsCount`) para estepes incluídos de fábrica
- Total de pneus calculado automaticamente (mostra `—` enquanto configuração incompleta)
- Badge de status: âmbar (incompleto) / esmeralda (completo com X/N eixos)
- Dados persistidos como JSONB (`axle_config`) e INT (`steps_count`) na tabela `vehicles`
- Módulo de pneus atualizado: `generatePositionsFromConfig()` usa a config detalhada quando disponível; fallback para `VehicleTireConfig` seed em veículos sem config
- Rodagem tripla gera posições `E{n}I/E{n}M/E{n}E/D{n}I/D{n}M/D{n}E`

**Arquivos Criados:**
- `supabase/migrations/20260325081826_add_axle_config_vehicles.sql` — Colunas `axle_config JSONB`, `steps_count INT` em vehicles; atualiza CHECK `position_type` em tires para suportar `triple_*` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**
- `src/lib/axleConfigUtils.ts` — Funções puras: `getPhysicalAxles`, `getAvailableAxleTypes`, `getAvailableRodagem`, `calculateTotalTires`, `totalPhysicalAxles`, `isConfigComplete` + labels
- `src/components/AxleConfigEditor.tsx` — Editor dinâmico com rows por eixo, dropdowns filtrados, estepes e total

**Arquivos Modificados:**
- `src/types.ts` — `AxleType`, `RodagemType`, `AxleConfigEntry` types; `TirePositionType` expandido com `triple_*`; `axleConfig?` e `stepsCount?` em `Vehicle`
- `src/lib/vehicleMappers.ts` — `axle_config` / `steps_count` em `VehicleRow`, `vehicleFromRow`, `vehicleToRow`
- `src/lib/tirePositions.ts` — `generatePositionsFromConfig()`; `classifyPositionType()` atualizado para sufixo `M`
- `src/components/VehicleForm.tsx` — Integração do `AxleConfigEditor`; useEffect para auto-inicializar primeiro eixo; reset de config ao alterar `eixos`
- `src/pages/Tires.tsx`, `src/components/TireForm.tsx`, `src/components/TireBatchForm.tsx` — Suporte a `axleConfig` + `stepsCount`; usa `generatePositionsFromConfig` quando disponível

---

## 2026-03-24 — Módulo de Gestão de Pneus

**Cadastro, rastreamento e histórico de movimentação de pneus da frota:**

- Rota: `/pneus` — item "Pneus" na Sidebar (icon: Circle, Fleet Assistant+)
- Dois modos de cadastro: Por Placa (individual) e Por Modelo (lote multi-step)
- Posições por veículo baseadas em `vehicle_tire_configs`: eixos simples (E/D), duplos (I/E), estepes (Step N)
- Histórico de movimentação append-only em `tire_position_history`
- Índice parcial `WHERE active = true` garante 1 pneu ativo por posição por veículo
- Classificação visual: Novo / Meia vida / Troca
- Toggle ativar/desativar com confirmação

**Arquivos Criados:**
- `supabase/migrations/20260324000000_create_tire_management.sql` — 3 tabelas + RLS + seed **⚠️ EXECUTAR NO SUPABASE DASHBOARD**
- `src/types.ts` — Tire, TirePositionHistory, VehicleTireConfig + TireVisualClassification, TirePositionType
- `src/lib/tireMappers.ts` — TireRow + converters camelCase ↔ snake_case
- `src/lib/tirePositions.ts` — generatePositions(), validatePositionAssignment(), classifyPositionType()
- `src/pages/Tires.tsx` — Página principal (cards + tabela + modais)
- `src/components/TireForm.tsx` — Modal de cadastro/edição individual
- `src/components/TireBatchForm.tsx` — Modal multi-step de lote por modelo
- `src/components/TireHistoryModal.tsx` — Modal de histórico de movimentação

**Arquivos Modificados:**
- `src/App.tsx` — `<Route path="pneus" element={<Tires />} />`
- `src/components/Sidebar.tsx` — Item "Pneus" após Manutenção (icon Circle)
- `.claude/arch-frontend.md`, `.claude/arch-backend.md`, `.claude/data-model.md` — Documentados

---

## 2026-03-20 — Cancelamento de Ordens de Serviço de Manutenção

**Gerenciamento de OS Canceladas:**

- Status **'Cancelado'** agora disponível como terminal (sem Edit/Complete, sem reabrir inline)
- Fleet Assistant+ (`!isWorkshopUser`) pode cancelar qualquer OS ativa (não-concluída, não-cancelada)
- Botão **Ban** (cancelar) abre modal de confirmação com resumo: OS, placa, status atual
- Cancelamento persiste `cancelled_at` (TIMESTAMPTZ) + `cancelled_by_id` (UUID FK → profiles) para auditoria
- OS canceladas **não contam** em cálculos de custo do Dashboard:
  - Query `dashboard-maintenance`: `.neq('status', 'Cancelado')`
  - Filtro defensivo em `CostPanel`: `maintenanceOrders.filter(o => o.status !== 'Cancelado')`
  - KPI "Em Manutenção" em `OperationalPanel`: exclui tanto 'Concluído' quanto 'Cancelado'
- Fluxo "Reabrir": botão **RotateCcw** em OS canceladas → abre formulário clone pré-preenchido (sem `id`, sem `os`, sem `cancelledAt/By`) com status resetado para 'Aguardando orçamento' → ao salvar, INSERT com nova OS gerada
  - Reutiliza mecanismo `prefillData` existente (já usado por schedule-to-maintenance)
  - Registro cancelado permanece intocado com status 'Cancelado'
- 6º card de resumo "Cancelados" adicionado (grid 5→6 colunas, status terminal cinzento)

**Arquivos Modificados:**
- `src/pages/Maintenance.tsx` — Tipo `MaintenanceStatus` + 'Cancelado'; mutation `cancelMutation`; botões Cancel/Reopen; modal confirmação; card Cancelados; `counts['Cancelado']`
- `src/lib/maintenanceMappers.ts` — `MaintenanceOrderRow` + colunas `cancelled_at/by`; mapper atualizado
- `src/components/MaintenanceDetailModal.tsx` — `statusColor('Cancelado')`
- `src/pages/Dashboard.tsx` — `.neq('status', 'Cancelado')` na query `dashboard-maintenance`
- `src/components/dashboard/CostPanel.tsx` — Filtro defensivo client-side
- `src/components/dashboard/OperationalPanel.tsx` — KPI "Em Manutenção" exclui canceladas
- `supabase/migrations/add_cancelled_status_maintenance.sql` — ALTER CHECK de status, colunas de auditoria (⚠️ EXECUTADA NO SUPABASE DASHBOARD)
- `.claude/arch-backend.md` — Documentada migration + CHECK status + colunas de auditoria
- `.claude/arch-frontend.md` — Maintenance.tsx (cancel/reopen flow), Dashboard queries, panel filters
- `.claude/data-model.md` — `MaintenanceStatus` union + `MaintenanceOrder` campos de auditoria

---

## 2026-03-20 — Redesign da Tela de Login com Logo βetaFleet e Background Mídia

**Tela de Login Alinhada com Marca + Preparada para Mídia:**

- **Logo βetaFleet**: Substituição do ícone Truck + texto "Sign in to Data Fleet" pelo logo tipográfico βetaFleet (β em orange-500 + etaFleet em branco) + tagline "Evolution always", mesmo padrão visual do Sidebar
- **Texto**: "Sign in to βetaFleet"
- **Background com Fallback Inteligente**:
  - Prioridade 1: Vídeo em `public/videos/login-bg.mp4` (autoPlay, loop, muted, playsInline)
  - Prioridade 2: Imagem em `public/images/login-bg.jpg` (fallback se vídeo falha)
  - Prioridade 3: Fundo sólido `bg-zinc-900` (fallback se ambos falham)
  - Detecção via `onError` handlers — sem pré-fetch, browser determina o que consegue carregar
- **Overlay**: `bg-black/50` sobre mídia para garantir legibilidade do formulário
- **Card do Formulário**: Branco semi-transparente `bg-white/95` com backdrop-blur, posicionado sobre a mídia com z-index adequado

**Estrutura de Pastas:**
```
public/
  videos/
    login-bg.mp4   ← colocar vídeo aqui
  images/
    login-bg.jpg   ← colocar imagem aqui (fallback)
```

**Arquivo Modificado:**
- `src/pages/Login.tsx` — Reescrito com logo βetaFleet, texto "Sign in to βetaFleet", lógica de background com fallback vídeo → imagem → cor, estados `videoFailed` e `imageFailed` para detecção de erros via `onError`
- `.claude/arch-frontend.md` — Atualizado descrição de Login.tsx

---

## 2026-03-20 — OCR Inteligente com Cache e Portabilidade (βetaFleet)

**Arquitetura de OCR Otimizada para Custo e Escalabilidade:**

- **Cache de Resultados**: Implementada tabela `ocr_cache` no Supabase que armazena o hash SHA-256 do arquivo e o JSON retornado pela IA. Isso evita cobranças duplicadas para o mesmo documento.
- **Portabilidade de IA (Vendor Agnostic)**: A lógica do Gemini foi abstraída para `src/lib/ocr/geminiProvider.ts` seguindo a interface `OcrProvider`. Trocar de IA agora requer apenas a criação de um novo provider.
- **Orquestrador Central**: `src/lib/ocr/ocrEngine.ts` gerencia o fluxo: Hash → Busca Cache → (Miss) Chamada IA → Salva Cache → Retorno.
- **Utilitários**: `src/lib/hashUtils.ts` para cálculo de SHA-256 no navegador.

**Arquivos Criados/Modificados:**
- `src/lib/ocr/` (types.ts, geminiProvider.ts, cacheService.ts, ocrEngine.ts) — Nova infraestrutura.
- `src/lib/hashUtils.ts` — Cálculo de hash de arquivos.
- `src/lib/documentOcr.ts`, `src/lib/budgetOcr.ts` — Refatorados para usar a nova engine.
- `supabase/migrations/20260320090000_create_ocr_cache.sql` — Nova tabela com RLS. **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

---

## 2026-03-19 — Novo Logo Tipográfico βetaFleet

**Implementação do Logo BetaFleet:**

- Criação de um novo logo tipográfico, substituindo o ícone e texto originais "Data Fleet" na barra lateral (`Sidebar.tsx`) pelo formato original da marca: **βetaFleet**.
- Utilização da letra grega beta (`β`) em cor laranja (`orange-500`) combinada com "etaFleet" em branco, alinhadas milimetricamente na mesma baseline da fonte Inter.
- Inclusão do subtítulo "Evolution always" em uppercase com amplo espaçamento entre caracteres para uma aparência harmônica e moderna.
- Implementação baseada em texto e classes Tailwind (100% livre de assets ou complexidade SVG).
- Criação do arquivo auxiliar `betafleet_logo_guidelines.md` (o qual possui histórico de design system alternativo também).

**Arquivos Modificados:**
- `src/components/Sidebar.tsx` — Nova construção flex-col no header contendo a tipografia βetaFleet pura.
- `.claude/arch-frontend.md` — Modificações refletidas no layout da Sidebar.

---

## 2026-03-19 — Gráficos de Embarcador e Unidade Operacional no Dashboard

**Novos gráficos no Painel Operacional e Painel de Custos:**

**Painel Operacional:**
- Gráfico "Frota por Embarcador" — contagem de veículos filtrados agrupados por `shipper_name`
- Gráfico "Frota por Unidade Operacional" — contagem de veículos filtrados agrupados por `operational_unit_name`

**Painel de Custos:**
- Gráfico "Custo por Embarcador" — soma de `approved_cost` das OS filtradas, agrupadas por embarcador
- Gráfico "Custo por Unidade Operacional" — soma de `approved_cost` das OS filtradas, agrupadas por unidade operacional
- Todos os 4 novos gráficos são condicionais (renderizam apenas se `data.length > 0`)

**Correções de KPIs no Painel de Custos:**
- **Custo por Veículo**: denominator corrigido para `filteredVehicles.length` (todos os veículos filtrados, não só com OS aprovada)
- **Custo por KM**: fórmula reescrita — usa `odometer_km` dos **checklists** (não `current_km` de maintenance_orders); por veículo: `MAX(odometer_km) - MIN(odometer_km)` nos checklists dentro do `dateRange`; props `checklistRows` e `dateRange` adicionadas ao `CostPanel`

**Arquivos Modificados:**
- `src/components/dashboard/OperationalPanel.tsx` — Interface `VehicleRow` expandida com `shipper_name?` e `operational_unit_name?`; 2 novos `useMemo` + 2 novos `VehicleTypeBarChart` condicionais
- `src/pages/Dashboard.tsx` — Query `dashboard-vehicles` expandida com `shippers(name), operational_units(name)` + mapeamento explícito para extração dos joins; query `dashboard-checklists` adicionada coluna `odometer_km`; `checklistRows` e `dateRange` passados ao `CostPanel`
- `src/components/dashboard/CostPanel.tsx` — Props `checklistRows` e `dateRange` adicionadas; `costPerVehicle` corrigido; `costPerKm` reescrito para usar checklists; 2 novos `useMemo` + 2 novos `VehicleTypeBarChart` condicionais
- `.claude/data-model.md` — `VehicleRow` atualizado com campos `shipper_name?` e `operational_unit_name?`
- `.claude/arch-frontend.md` — Atualizado descrição de `OperationalPanel.tsx`, `CostPanel.tsx`, queries do Dashboard, fórmulas de KPI

---

## 2026-03-19 — Dashboard com Painéis Operacional e de Custos

**Dashboard Completo com KPIs Reais e Gráficos Interativos:**

- Dois painéis (abas): **Painel Operacional** e **Painel de Custos de Manutenção**
- Gráficos interativos que atuam como filtros (click = toggle filtro)
- Filtros aditivos (AND) compartilhados entre painéis: `vehicleType` + `maintenanceType`

**Painel Operacional — 5 KPIs:**
1. **Total de Veículos** (Truck, azul) — contagem de veículos filtrados
2. **Em Manutenção** (Wrench, âmbar) — OS com `status !== 'Concluído'`
3. **Checklists Vencidos** (CalendarDays, vermelho) — veículos cuja última checklist de Rotina ou Segurança ultrapassa intervalo em `checklist_day_intervals`
4. **CRLVs Vencidos** (FileWarning, laranja) — veículos com `crlv_year < ano atual`
5. **CNHs Vencidas** (UserX, vermelho) — motoristas com `expiration_date < hoje`

**Painel Operacional — 2 Gráficos:**
- Barras: veículos por tipo (8 tipos)
- Rosca: contagem de OS por tipo de manutenção (Corretiva/Preventiva/Preditiva)

**Painel de Custos — 3 KPIs:**
1. **Custo Total** (DollarSign, verde) — `SUM(approved_cost)` de OS com custo aprovado
2. **Custo por Veículo** (Truck, azul) — Custo Total / nº de veículos distintos com OS
3. **Custo por KM** (Gauge, roxo) — Custo Total / km total agregado (por veículo: MAX(current_km) - initial_km)

**Painel de Custos — 2 Gráficos:**
- Barras: custo por tipo de veículo
- Rosca: custo por tipo de manutenção

**Arquivos Criados:**
- `src/components/dashboard/DashboardKpiCard.tsx` — Card reutilizável (icon, label, value, subtitle, isAlert)
- `src/components/dashboard/VehicleTypeBarChart.tsx` — Gráfico de barras com click=filtro; click novamente limpa
- `src/components/dashboard/MaintenanceTypeDonutChart.tsx` — Gráfico de rosca com click=filtro; cores: Corretiva=#ef4444, Preventiva=#3b82f6, Preditiva=#8b5cf6
- `src/components/dashboard/OperationalPanel.tsx` — 5 KPIs + 2 gráficos; exporta interfaces VehicleRow, MaintenanceOrderDashboard, DashboardFilters
- `src/components/dashboard/CostPanel.tsx` — 3 KPIs + 2 gráficos; cálculo de cost per KM

**Arquivo Modificado:**
- `src/pages/Dashboard.tsx` — Reescrito: 5 queries (dashboard-vehicles, dashboard-maintenance, dashboard-checklists, dashboard-intervals, dashboard-drivers); state de filtros lifted; abas + loading state; cálculo de overdue checklists via useMemo

**Arquivos de Migração:**
- `supabase/migrations/fix_vehicles_admin_master_rls.sql` — Corrige SELECT RLS em vehicles table para incluir `OR role = 'Admin Master'` (Admin Master tem client_id = NULL, precisava de exceção especial como em maintenance_orders e action_plans). **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Queries (react-query):**
```ts
dashboard-vehicles    → vehicles: SELECT id, type, crlv_year, driver_id
dashboard-maintenance → maintenance_orders: SELECT id, vehicle_id, type, status, approved_cost, current_km, vehicles(type)
dashboard-checklists  → checklists: SELECT vehicle_id, context, completed_at (status='completed')
dashboard-intervals   → checklist_day_intervals: SELECT rotina_day_interval, seguranca_day_interval (maybeSingle)
dashboard-drivers     → drivers: SELECT id, expiration_date
```

**Filtros Interativos:**
```ts
type DashboardFilters = {
  vehicleType: string | null;       // ex: 'Passeio'
  maintenanceType: string | null;   // ex: 'Corretiva'
};
```
- Client-side filtering via useMemo em ambos os painéis
- Alterar filtro atualiza KPIs e ambos os gráficos
- Filtros persistem ao trocar entre abas

**Arquivos Modificados:**
- `src/pages/Dashboard.tsx` — Reescrito com 5 queries, filtros, abas, painéis
- `src/components/dashboard/OperationalPanel.tsx` — Criado com VehicleRow interface (sem coluna `status` pois não existe no DB)
- `src/components/dashboard/CostPanel.tsx` — Criado com cálculo de cost per KM
- `.claude/arch-frontend.md` — Documentado Dashboard e componentes do dashboard/
- `.claude/arch-backend.md` — Documentada migration fix_vehicles_admin_master_rls.sql
- `.claude/data-model.md` — Documentadas interfaces VehicleRow, MaintenanceOrderDashboard, DashboardFilters

---

## 2026-03-19 — Intervalo em Dias entre Checklists

**Configuração de Intervalo entre Checklists de Rotina e Segurança:**

- Nova aba "Checklists" em `src/pages/Settings.tsx` — acessível a Fleet Assistant+
- Configuração global por cliente (não por veículo) do intervalo em dias entre checklists consecutivos
- Dois campos: intervalo máximo em dias para Rotina e intervalo máximo em dias para Segurança
- Campos opcionais (podem ser deixados em branco = não configurado)
- Informativo — valores usados futuramente para gerar alertas de checklists em atraso
- Tabela: `checklist_day_intervals` (migration: `create_checklist_day_intervals.sql` — ⚠️ EXECUTAR NO SUPABASE DASHBOARD)
- Componente: `src/components/ChecklistDayIntervalSettings.tsx` (props: clientId, userId)
- Padrão de upsert: `onConflict: 'client_id'` — cria ou atualiza em um round-trip

**Arquivos Modificados:**
- `src/types.ts` — Adicionado `ChecklistDayInterval` interface
- `src/pages/Settings.tsx` — Nova aba "Checklists" com import do componente, TabType expandido, tabs array com novo item
- `src/components/ChecklistDayIntervalSettings.tsx` — Novo componente com validação inline
- `supabase/migrations/create_checklist_day_intervals.sql` — Nova tabela com RLS
- `.claude/data-model.md` — Documentada tabela `checklist_day_intervals` e interface `ChecklistDayInterval`
- `.claude/arch-backend.md` — Documentada tabela `checklist_day_intervals` + migration
- `.claude/arch-frontend.md` — Documentado componente `ChecklistDayIntervalSettings` + Settings.tsx description

---

## 2026-03-19 — Acesso de Oficinas Parceiras

**Workshop Login e Visão de Manutenção:**

- Novo role `'Workshop'` (rank 1) — oficinas parceiras acessam o sistema com login próprio
- Fluxo de criação: Fleet Assistant+ cria workshop com campos opcionais `loginEmail + loginPassword`
- Edge Function `create-user` suporta get-or-create semântico para Workshop (como Driver)
- Tabela `workshops` nova coluna: `profile_id UUID FK → profiles(id)` — liga workshop ao perfil do usuário
- `AuthContext.tsx` busca `workshopId` ao fazer login com role 'Workshop'
- Sidebar: Workshop vê apenas "Manutenção"; redirect HomeRedirect → `/manutencao`
- Maintenance.tsx:
  - Query filtra por `workshop_id` quando Workshop
  - Botão "Nova Manutenção" oculto para Workshop
  - Coluna OS mostra `workshopOs` em vez de `os` para Workshop
  - UPDATE parcial: Workshop atualiza apenas `expected_exit_date, workshop_os_number, mechanic_name, current_km`
- MaintenanceForm.tsx:
  - Novo prop `mode?: 'default' | 'workshop'`
  - Modo Workshop: 4 campos obrigatórios (expectedExitDate, workshopOs, mechanicName, currentKm) + PDF obrigatório
  - Botão: "Enviar Orçamento" (Workshop) vs "Criar/Editar Manutenção" (padrão)
- WorkshopForm.tsx:
  - Seção "Acesso ao Sistema" apenas na criação (loginEmail, loginPassword opcionais)
  - Badge "Com/Sem acesso ao sistema" na edição
- RLS: Múltiplas migrations para suportar Workshop
  - `20260319100000_add_workshop_login.sql`: role 'Workshop' em CHECK, role_rank(1), profile_id em workshops, policies de maintenance_orders/items
  - `fix_workshop_vehicles_rls.sql`: policy SELECT em vehicles para Workshop (acesso a veículos em suas OS)

**Arquivos Modificados:**
- `src/types.ts` — 'Workshop' em Role, workshopId em User, profileId em Workshop
- `src/context/AuthContext.tsx` — busca workshopId para role Workshop
- `supabase/functions/create-user/index.ts` — Workshop rank 1, get-or-create semântico
- `src/components/WorkshopForm.tsx` — loginEmail/loginPassword opcionais, badge acesso
- `src/lib/workshopMappers.ts` — profileId mapeado
- `src/pages/Workshops.tsx` — saveMutation chama create-user se login fornecido
- `src/components/Sidebar.tsx` — 'Workshop' em Manutenção roles
- `src/App.tsx` — HomeRedirect para Workshop → /manutencao
- `src/pages/Maintenance.tsx` — isWorkshopUser, query/UPDATE/UI adaptativos
- `src/components/MaintenanceForm.tsx` — modo='workshop' com 4 campos + PDF obrigatório
- `.claude/data-model.md` — Role union, User.workshopId, Workshop.profileId
- `.claude/arch-backend.md` — workshops.profile_id, migrations 20260319100000 + fix_workshop_vehicles_rls
- `.claude/arch-frontend.md` — WorkshopForm, MaintenanceForm, Maintenance adaptações

**Pendente Execução Manual (Supabase Dashboard):**
1. `supabase/migrations/20260319100000_add_workshop_login.sql` — role check, role_rank, profile_id, RLS
2. `supabase/migrations/fix_workshop_vehicles_rls.sql` — vehicles SELECT policy para Workshop
3. Republicar Edge Function `create-user` com suporte Workshop

---

## 2026-03-19 — Rastreamento de Hodômetro em Checklists

1. **Km Inicial em Veículos** — Novo campo obrigatório (configurável por cliente) no cadastro de veículos.
   - Campo: `initialKm` (INTEGER) — baseline para validação de checklists
   - Mapper: Incluído em `src/lib/vehicleMappers.ts` (bidirectional: camelCase ↔ snake_case)
   - UI: Novo input na seção "Propriedade & Rastreamento" em `src/components/VehicleForm.tsx`
   - Config: Campo `initial_km_optional` em `vehicle_field_settings` permite configuração por cliente
   - Migration: `supabase/migrations/add_initial_km_vehicles.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

2. **Hodômetro em Checklists** — Campo obrigatório como **primeira etapa** de todo preenchimento de checklist.
   - Campo: `odometerKm` (INTEGER) — hodômetro do veículo no momento do preenchimento
   - Validação: Não pode ser menor que o último `odometer_km` registrado (ou `initial_km` se nenhum checklist anterior)
   - UI: Seção dedicada em `src/pages/ChecklistFill.tsx` com:
     * Referência visual do último KM registrado (com fallback para `initial_km`)
     * Input numérico com validação em tempo real
     * Bloqueio dos itens até KM ser confirmado (mesmo padrão da seleção de oficina)
     * Badge verde indicando KM confirmado + botão "Alterar"
   - Mapper: Incluído em `src/lib/checklistMappers.ts` com type `odometerKm?: number`
   - Migration: `supabase/migrations/add_odometer_km_checklists.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Sequência de Preenchimento (ChecklistFill.tsx):**
1. Confirmar oficina (se contexto é Entrada/Saída de Oficina)
2. Confirmar hodômetro (novo)
3. Responder todos os itens obrigatórios
4. Finalizar checklist

**Arquivos Modificados:**
- `src/types.ts` — Adicionado `initialKm?: number` em Vehicle, `initialKmOptional` em VehicleFieldSettings, `odometerKm?: number` em Checklist
- `src/lib/vehicleMappers.ts` — Mapeamento completo de initial_km
- `src/lib/checklistMappers.ts` — Mapeamento completo de odometer_km
- `src/lib/fieldSettingsMappers.ts` — Suporte a initial_km_optional com mapa FIELD_TO_SETTING
- `src/components/VehicleForm.tsx` — Novo input para Km Inicial (section "Propriedade & Rastreamento")
- `src/pages/ChecklistFill.tsx` — Lógica e UI do hodômetro com queries para lastOdometerKm e vehicleInitialKm
- `.claude/arch-frontend.md` — Documentado VehicleForm (Km Inicial) e ChecklistFill (hodômetro)
- `.claude/arch-backend.md` — Documentadas novas colunas e migrations

---

## 2026-03-18 — Km entre Revisões

**Configuração de Km entre Revisões por Veículo:**

- Nova aba "Revisões" em `src/pages/Settings.tsx` — acessível a Fleet Assistant+
- Mostra todos os veículos do cliente com campo para km entre revisões
- Filtros por marca, modelo e categoria (client-side); paginação de 50/página
- Bulk apply: insere o mesmo km em todos os veículos filtrados de uma só vez
- Salva via `.upsert({ onConflict: 'vehicle_id' })` — um round-trip para N alterações
- Guard de página alterado: `ROLES_CAN_ACCESS_SETTINGS` (Fleet Assistant+); abas Veículos/Motoristas condicionais (Manager+)
- Sidebar: "Configurações" agora visível para Fleet Assistant+
- Tabela: `vehicle_km_intervals` (migration: `create_vehicle_km_intervals.sql` — ✅ EXECUTADA NO SUPABASE DASHBOARD)
- Componente: `src/components/VehicleKmIntervalSettings.tsx` (props: clientId, userId)

**Arquivos Modificados:**
- `src/types.ts` — Adicionado `VehicleKmInterval` interface
- `src/pages/Settings.tsx` — Nova aba + role guards atualizados
- `src/components/Sidebar.tsx` — Configurações visível para Fleet Assistant+
- `src/components/VehicleKmIntervalSettings.tsx` — Novo componente
- `supabase/migrations/create_vehicle_km_intervals.sql` — Nova tabela com RLS (✅ executada)
- `.claude/arch-backend.md` — Documentada tabela `vehicle_km_intervals`
- `.claude/arch-frontend.md` — Documentados Settings.tsx e VehicleKmIntervalSettings
- `.claude/data-model.md` — Documentada interface `VehicleKmInterval`

---

## Correções Recentes (2026-03-18)

**Correções de Bugs de Multi-Tenancy e RLS:**

1. **Maintenance.tsx** — Query não filtrava por `client_id` quando cliente era selecionado no dropdown. Admin Master via sempre os mesmos dados (Grupo LLE) independente do cliente selecionado.
   - Alteração: Adicionado `.eq('client_id', currentClient.id)` na query quando `currentClient?.id` existe
   - Arquivo: `src/pages/Maintenance.tsx`

2. **BudgetApprovals.tsx** — Mesmo problema: query sem filtro por `client_id`. Removido também o `enabled: expanded` desnecessário que fazia subtotal sumir após refresh.
   - Alteração: Adicionado filtro `client_id` + removido `enabled: expanded` de budgetItems query
   - Arquivo: `src/pages/BudgetApprovals.tsx`

3. **Users.tsx + AdminUsers.tsx** — Token JWT expirado ao editar usuário (erro "JWT expired"). SDK do Supabase não fazia refresh automático antes de operações críticas.
   - Alteração: Adicionado `await supabase.auth.refreshSession()` antes do `.update()` nas mutations
   - Arquivos: `src/pages/Users.tsx`, `src/pages/AdminUsers.tsx`

4. **CreateActionPlanModal.tsx** — Admin Master bloqueado de criar planos de ação por bug de RLS no banco.
   - Alteração: Melhorado tratamento de erro para exibir mensagem real do Supabase (não genérica)
   - Arquivo: `src/components/CreateActionPlanModal.tsx`
   - **Correção de BD**: Nova migration `supabase/migrations/fix_action_plans_admin_master_rls.sql` — **⚠️ EXECUTAR NO SUPABASE DASHBOARD**

**Causa Raiz de action_plans RLS:**
- Admin Master tem `client_id = NULL` no profile
- Migration `add_supervisor_coordinator_roles.sql` usava `client_id IN (SELECT client_id FROM profiles WHERE ... OR role = 'Admin Master')`
- Em SQL, `coluna IN (NULL)` é sempre UNKNOWN (nunca TRUE) → Admin Master ficava bloqueado
- Solução: Usar `EXISTS` com check direto `p.role = 'Admin Master'` em vez de depender de `client_id`

---


## 2026-03-19 — Coluna Total + Remoção de campos redundantes

- **Adição**: `BudgetItemsTable.tsx` agora exibe coluna `Total (R$)` = `Qtd × Valor` em cada linha (modo edição e leitura), com `colSpan` atualizado de 4 para 5.
- **Remoção**: Removidos campos `Custo Estimado (R$)` e `Subtotal da OS (R$)` de `MaintenanceForm.tsx` — o subtotal já aparece no rodapé da tabela. Removida constante `hasItemsWithValue` e callback `onSubtotalChange`.
- **Estado inicial**: `estimatedCost: 0` mantido para garantir INSERT sem erros; `approvedCost` não é mais exposto no formulário.

## 2026-03-18 — Auditoria de RLS & Admin Master Access

- **Investigação exaustiva**: Analisadas **19 tabelas** em todas as migrations e `schema.sql` para verificar suporte correto a Admin Master.
- **Problema identificado**: `maintenance_orders` usava políticas que requeriam `role_rank >= 3 AND client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())` SEM exceção para Admin Master, bloqueando-o 100%.
- **Solução**: Criada migration `fix_maintenance_orders_admin_master_rls.sql` recriando as 4 policies (SELECT, INSERT, UPDATE, DELETE) com padrão `(... role_rank(...) AND client_id = ...) OR role = 'Admin Master'`.
- **Resultado final**: ✓ Todas as 19 tabelas agora suportam Admin Master corretamente. Nenhuma outra tabela afetada.
- **Padrão para futuro**: Ao criar novas tabelas com RLS baseada em `client_id`, SEMPRE adicionar `OR role = 'Admin Master'` (sem restrição de tenant) em TODAS as policies.

## 2026-03-18 — Testes E2E: Integração Agendamento → Manutenção e Dual OS

- **Novo arquivo**: `e2e/tenant-users-assistant-maintenance.spec.ts` — 7 testes seriais cobrindo o fluxo completo sob o perfil Fleet Assistant (Pedro).
- **Cobertura**:
  1. Seed: cria agendamento com primeiro veículo/oficina disponíveis.
  2. Navegação: botão "Gerar OS" (`ClipboardList`) em `/agendamentos` navega para `/manutencao` e abre form automaticamente.
  3. Prefill: `vehicleId`, `workshopId`, `entryDate`, `type` e `status` pré-preenchidos do agendamento.
  4. OS Interna read-only: verifica ausência de `input[name="os"]` e presença de "Será gerada automaticamente".
  5. Salvar via prefill: OS Interna gerada com padrão `OS-AAMM-XXXX`; OS da Oficina persistida.
  6. Editar: OS Interna mostra valor real read-only; `input[name="workshopOs"]` tem o valor salvo.
  7. Fluxo manual: "+ Nova Manutenção" também exibe OS Interna read-only.
- **Padrão**: `sessionStorage.clear()` removido (causava `SecurityError` em Playwright serial tests); `goto` antes de `evaluate` quando necessário.

## 2026-03-18 — Estabilização de Testes E2E (Shippers/Units)

- Resolvidos erros de **Strict Mode** no Playwright substituindo `getByText` por `getByRole('cell', ...).first()`.
- Implementado handler global de **diálogos nativos** (`window.confirm`) para aceitar exclusões automaticamente.
- Resolvido bug de **duplicidade de dados** em testes sequenciais através do uso de sufixos dinâmicos (`Math.random()`) e CNPJs randômicos por execução.
- Refatorado `OperationalUnits.tsx` para usar **React Query** (`useQuery`, `useMutation`), melhorando a performance e o tratamento de erros de integridade referencial (FK).
- Adicionado suporte a **aria-modal** e **roles de diálogo** nos formulários de cadastro para maior acessibilidade e facilidade de teste.
- Corrigido fluxo de seleção em cascata (Embarcador → Unidade) no `VehicleForm.tsx`. Sincronizado para garantir que o dropdown de unidades seja filtrado e limpo corretamente ao trocar o embarcador.

## 2026-03-18 — Integração Agendamento → Manutenção (Dual OS System)

- **Fluxo semi-automatizado**: Botão "Gerar OS" (ícone `ClipboardList`) em WorkshopSchedules.tsx navega para `/manutencao` com dados pré-preenchidos via React Router `state`.
- **Dual OS System**:
  - **OS Interna** (`os_number`): auto-gerada no INSERT via formato `OS-YYMM-XXXX`, **imutável** (nunca incluída em UPDATE).
  - **OS da Oficina** (`workshop_os_number`): novo campo editável por Fleet Assistant+, armazena OS fornecida pela oficina.
- **Arquivos modificados**:
  - `src/pages/Maintenance.tsx`: adicionado `useLocation` para ler `prefillMaintenance` do state; `saveMutation` separado INSERT/UPDATE logic; novo state `prefillData`; auto-abertura do form via `useEffect`.
  - `src/components/MaintenanceForm.tsx`: novo prop `prefill`, inicialização mergeada com `...prefill`; substituição do campo OS único por dual fields (OS Interna read-only display + OS da Oficina editable input).
  - `src/lib/maintenanceMappers.ts`: adicionado `workshop_os_number` a `MaintenanceOrderRow`; mapeamento no return `workshopOs: row.workshop_os_number || undefined`.
  - `src/pages/WorkshopSchedules.tsx`: função `handleGenerateMaintenance()` com `navigate()` + state; botão no `ScheduleRow` visível apenas para Fleet Assistant+ (status !== 'cancelled').
- **Migration SQL**: `20260318110000_add_workshop_os_to_maintenance.sql` — adiciona coluna `workshop_os_number VARCHAR(100) NULL`.
- **MaintenanceOrder interface**: adicionado `workshopOs?: string` (opcional).
- **Bug Fix**: Maintenance.tsx desestruturava `profile` inválido de `useAuth()` — corrigido com alias `user: profile`.

## 2026-03-18 — Refatoração para React Query e Performance

- **WorkshopSchedules.tsx**: Migrado para `useQuery` e `useMutation`. Adicionado suporte a `useMemo` para filtragem otimizada. Persistência de formulário em `sessionStorage`.
- **ActionPlans.tsx**: Migrado para `useQuery`. Implementada hidratação pós-fetch para nomes de perfis e filtragem otimizada com `useMemo`.
- **ChecklistFill.tsx**: Migrado para `useQuery` e `useMutation`. Otimizada a consolidação de estados de itens e respostas via `useMemo`.
- **Módulo de Manutenção** (`Maintenance.tsx`):
  - Tabela `maintenance_orders` no Supabase com RLS baseada em `role_rank`.
  - Mappers de dados (`src/lib/maintenanceMappers.ts`).
  - Migração completa para React Query (`useQuery`, `useMutation`).
  - Otimização de filtros e contadores com `useMemo`.
  - Implementado `actual_exit_date` automático na conclusão da O.S.
  - Trigger `set_maintenance_updated_at` para auditoria de timestamps.

## 2026-03-18 — Agendamento de Oficina (Workshop Schedules)

- **Nova tabela**: `workshop_schedules` (id, client_id, vehicle_id FK RESTRICT, workshop_id FK RESTRICT, scheduled_date, status CHECK('scheduled','completed','cancelled'), completed_at, checklist_id FK SET NULL, notes, created_by, created_at, updated_at) com RLS: SELECT Driver (veículo próprio via join drivers→vehicles) + Fleet Assistant+ (tenant) + Admin Master; INSERT Fleet Assistant+; UPDATE Fleet Assistant+ + Driver (veículo próprio, para auto-complete); DELETE Manager+.
- **Novos arquivos**:
  - `src/lib/workshopScheduleMappers.ts` (WorkshopScheduleRow, scheduleFromRow, scheduleToRow, buildGoogleMapsUrl, formatWorkshopAddress)
  - `src/components/ScheduleForm.tsx` (modal com vehicle/workshop dropdowns + date + notes)
  - `src/pages/WorkshopSchedules.tsx` (dual-view: tabela Fleet Assistant+ com ações Concluir/Cancelar/Editar/Excluir; cards para Driver com endereço + Google Maps link + histórico colapsável)
- **Routing**: Rota `/agendamentos` em `App.tsx`; item "Agendamentos" com ícone `CalendarClock` no `Sidebar.tsx` (visível para Driver + Fleet Assistant+).
- **Auto-conclusão**: `ChecklistFill.tsx` `handleFinish()` — após marcar checklist como `completed`, se contexto = "Entrada em Oficina", busca agendamento pending mais antigo (FIFO) com mesmo `vehicle_id` + `workshop_id` e atualiza para `completed` (best-effort, não bloqueia). Bug corrigido: condição usava `checklist?.workshopId` (null no estado inicial); corrigido para `resolvedWorkshopId = selectedWorkshopId || checklist?.workshopId`.
- **Bug RLS workshops**: `add_supervisor_coordinator_roles.sql` havia recriado `workshops_select` sem Driver/Yard Auditor. Corrigido via `fix_workshops_roles_rls.sql`. ⚠️ Ao atualizar `workshops_select` no futuro, SEMPRE incluir: Driver, Yard Auditor, Fleet Assistant, Fleet Analyst, Supervisor, Manager, Coordinator, Director + Admin Master.

## 2026-03-17 — Correcções Associação Motorista-Veículo

- **Bug Multi-tenancy — Índice UNIQUE Global**: Índice `idx_vehicles_driver_unique` em `driver_id` era **global** (não scoped por client), violando multi-tenancy — um motorista de um cliente bloqueava todo o sistema. Criada migration `fix_driver_unique_index_multitenant.sql`: remove índice quebrado e cria novo índice `(client_id, driver_id)` permitindo que cada cliente tenha seu próprio motorista vinculado a 1 veículo.
- **Bug Auth — currentClient NULL para Drivers**: AuthContext tentava fazer LEFT JOIN implícito em profiles com clients, retornando null para motoristas. Corrigido em `AuthContext.tsx`: agora faz SELECT direto em clients usando profile.client_id, garantindo que todo usuário com client_id válido terá currentClient preenchido.
- **Bug Checklists — Queries falhavam com currentClient null**: Adicionadas guardas em Checklists.tsx para retornar early se currentClient?.id for vazio, evitando queries inválidas. Melhorada precisão da query de driver: agora filtra por `(profile_id, client_id)` e depois busca veículo com `(driver_id, client_id)`.
- **UX — Mensagens de erro claras**: VehicleForm.tsx agora diferencia erro 23505 entre motorista vinculado e placa duplicada, inspecionando a mensagem PostgreSQL. Validação em tempo real quando motorista é selecionado, com feedback imediato se não estiver disponível.
