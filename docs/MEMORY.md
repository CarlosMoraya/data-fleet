# MEMORY - Estado Atual do Projeto

Este arquivo registra o progresso atual, pendências e a visão de curto prazo para o desenvolvimento.

## 🟢 Estado Atual (Checklist de Progresso)

- [x] **Núcleo de Cadastros**: Veículos, Motoristas, Embarcadores e Unidades Operacionais estabilizados.
- [x] **Gestão de Manutenção**: Workflow de OS, cancelamento e orçamentos (OCR) funcional.
- [x] **Checklists**: Infraestrutura offline-first e versionamento de templates concluídos.
- [x] **Pneus**: Módulo completo com configuração de eixos e histórico de movimentação.
- [x] **Oficinas**: Novo modelo de parcerias multi-tenant e gestão de convites ativa.
- [x] **Performance**: Build otimizado (~8s) e cache de queries (React Query) configurado.

## ✅ Protocolo Oficial de Smoke

- Comando oficial: `npm run test:smoke`
- Objetivo: validar o contrato minimo de aplicacao viva, autenticacao, protecao de rotas e navegacao critica de Cadastros antes de planejamento ou bugfix.
- Pre-condicoes locais: `.env.local` valido, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, credenciais admin de teste e dados demo minimos para `coordinator@demo.betafleet.local`.
- Cobertura do smoke: tela de login, redirect de rota protegida para anonimo, shell autenticado, navegacao de abas de Cadastros e regressao de Coordinator apos idle.
- Fora do escopo: CRUD completo, specs `e2e/pending/**`, importacoes, OCR, fluxos destrutivos e regressao E2E completa.
- Conduta em falha: parar, registrar o teste falho com a evidencia e corrigir o problema antes de continuar.
- Observacao: `npm run test:e2e` continua sendo a regressao completa. Ele nao substitui o smoke oficial.

---

## 🟡 Tarefas em Andamento

1.  **Estabilização de Testes E2E (Inspeção de Pneus)**:
    - Ajustar falhas de timing nos testes de movimentação de pneus.
    - Corrigir o seeding de dados para o motorista (Jorge) e Auditor (Carlos).
2.  **Migração para React Query**:
    - Finalizar a substituição de estados locais por queries em páginas menores (ex: Shippers).
3.  **Acessibilidade**:
    - Revisar `aria-labels` em modais e tabelas para conformidade WCAG.

---

## 🔴 Próximos Passos Definidos

1.  **Módulo de Custos Avançado**:
    - Implementar projeções financeiras baseadas no histórico de manutenção.
2.  **Dashboard Executivo**:
    - Criar visão consolidada para o `Admin Master` com métricas cross-tenant.
3.  **Integração de Notificações**:
    - Sistema de alertas para vencimento de CRLV e CNH via Edge Functions (Cron).

---

## 📌 Contexto de Sessão (Última Auditoria)
A última grande auditoria (11/04/2026) resultou na remoção de 15% de código morto e na unificação de 4 mappers redundantes. O sistema encontra-se saudável e com build estável.

---

## 🆕 Atualização de Sessão (11/05/2026)
- Implementado o campo opcional `phone` no cadastro de motoristas, com persistência completa banco ↔ frontend.
- Migration criada: `supabase/migrations/add_phone_to_drivers.sql` (execução manual no Supabase Dashboard pendente).
- `DriverForm` atualizado com campo "Telefone de Contato" após CPF, com filtro `filterPhone` (somente dígitos).
- `DriverDetailModal` atualizado para exibir telefone formatado em padrão brasileiro.
- `driverMappers.ts` e `driverMappers.test.ts` atualizados para incluir o campo `phone`.
- Validações locais concluídas: `npm run lint` sem erros e `npm run test:unit` com **111 testes passando**.

## 🆕 Atualização de Sessão (16/05/2026)
Bug corrigido: 32 usuários importados via bulk não apareciam na tela /admin/users
Causa raiz: scripts/bulk-import-drivers.ts não inseria registros em public.profiles (apenas em auth.users e drivers)
Correção aplicada: INSERT direto via SQL Editor no Supabase para os 32 perfis ausentes
Arquivos modificados: nenhum arquivo de código — correção via SQL no banco de dados
Testes adicionados: nenhum automatizado — validação manual documentada

## 🆕 Atualização de Sessão (18/05/2026)
Bug corrigido: Driver não via checklists publicados após associação de veículo
Causa raiz: `drivers.profile_id` NULL para motoristas criados via bulk import; a query em `Checklists.tsx` depende de `profile_id = auth.uid()`
Correção aplicada: UPDATE pontual no Supabase para ALESSANDRO (`drivers.id=f1cfbf99-5d79-4051-914f-c3f26ac3afac`) com `profile_id=e29cbf40-3084-4623-99cc-1e99d9fa9e40`; policy `drivers_select_own` confirmada ativa
Desdobramento aprovado: após validação do caso ALESSANDRO, aplicado UPDATE individual para os outros 32 drivers da Deluna com pareamento unívoco `drivers.name` ↔ `profiles.name` (`role='Driver'`, mesmo `client_id`); resultado final: `0` drivers com `profile_id` nulo no tenant
Prevenção aplicada: `scripts/bulk-import-drivers.ts` agora faz `upsert` em `public.profiles` e insere `drivers.profile_id` com o `auth.users.id` criado
Arquivos modificados: `scripts/bulk-import-drivers.ts`, `e2e/completed/driver-checklist-visibility.spec.ts`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/driver-checklist-visibility.spec.ts` cobrindo caso positivo (vínculo correto) e regressão negativa (sem `profile_id`)

## 🆕 Atualização de Sessão (25/05/2026)
- Criado `scripts/seed-betafleet-demo.mjs` para seed manual e idempotente do tenant `BetaFleet`, usando `SUPABASE_SERVICE_ROLE_KEY` e `dotenv` (`.env.local`).
- Implementadas as funções obrigatórias do plano, incluindo introspecção de colunas por tabela para tolerância a diferenças de migrations entre ambientes.
- Criado helper `scripts/seed-betafleet-demo.helpers.mjs` com dataset, gerador determinístico de credenciais e sanitização de relatório.
- Criados documentos `docs/demo/BETAFLEET_DEMO_DATA.md` e `docs/demo/BETAFLEET_DEMO_CREDENTIALS.example.md`.
- Adicionado `.demo-credentials/` ao `.gitignore` e script `seed:demo:betafleet` ao `package.json`.
- Criado teste unitário `tests/unit/seed-betafleet-demo.test.ts` para regras de dataset/credenciais/sanitização.
- Local privado de credenciais definido em `.demo-credentials/betafleet-demo-credentials.json`; relatório versionável sem senha definido em `import-report-betafleet-demo-YYYY-MM-DD.json`.
- Pendência: validação E2E visual continua dependente da normalização do ambiente/porta 3000 e execução manual pós-seed no Supabase.

## 🆕 Atualização de Sessão (01/06/2026)
Bug corrigido: Admin Master nao via ordens de manutencao ao selecionar "Todos os Clientes".
Causa raiz: `useQuery` em `src/pages/Maintenance.tsx` ficava desabilitado para usuarios nao-oficina quando `currentClient` era `null`; para Admin Master, `currentClient = null` representa a visao global.
Correcao aplicada: query de manutencao passa a ser habilitada quando o perfil e `Admin Master`, mesmo sem cliente selecionado, preservando o filtro por `client_id` quando um cliente especifico existe.
Arquivos modificados: `src/pages/Maintenance.tsx`, `src/pages/Maintenance.query-scope.test.ts`, `docs/MEMORY.md`
Testes adicionados: `src/pages/Maintenance.query-scope.test.ts`

## 🆕 Atualização de Sessão (01/06/2026) — Gestor de Operações
- Feature implementada: novo role persistido como `Operations Manager` e exibido como `Gestor de Operações`.
- Migration criada: `supabase/migrations/20260601000000_add_operations_manager_role_and_scope.sql`.
- Banco/RLS:
  - criadas as tabelas `profile_shipper_scopes` e `profile_operational_unit_scopes`;
  - adicionadas validações por trigger para garantir consistência entre perfil, embarcadores e bases;
  - habilitada leitura restrita por escopo em `shippers`, `operational_units`, `vehicles`, `workshop_schedules`, `maintenance_orders`, `maintenance_budget_items` e leitura de `workshops` somente quando referenciadas por registros visíveis.
- Frontend:
  - `Users.tsx` agora permite criar/editar `Gestor de Operações` para `Coordinator+`, com embarcadores e bases obrigatórios;
  - `AdminUsers.tsx` renderiza corretamente o role, mas continua sem expor criação/edição desse perfil;
  - `App.tsx`, `Layout.tsx`, `Sidebar.tsx`, `Topbar.tsx` e `AuthContext.tsx` passaram a tratar redirect, bloqueio de rota e navegação restrita para `/agendamentos` e `/manutencao`;
  - `WorkshopSchedules.tsx` e `Maintenance.tsx` foram ajustadas para leitura apenas, sem ações mutáveis para o novo role.
- Backend:
  - `supabase/functions/create-user/index.ts` agora valida `shipper_ids` e `operational_unit_ids`, força payload read-only e sincroniza escopo em modo replace-all;
  - `supabase/functions/delete-user/index.ts` bloqueia exclusão por `Operations Manager`.
- Helpers e testes adicionados:
  - `src/lib/operationsManagerScope.ts`
  - `src/lib/operationsManagerScope.test.ts`
  - `src/pages/Users.operations-manager.test.ts`
  - `src/pages/Maintenance.query-scope.test.ts`
  - `e2e/pending/operations-manager-readonly-scope.spec.ts`
- Correcao posterior:
  - criada `supabase/migrations/20260602000000_fix_operations_manager_schedule_rls.sql` para remover `Operations Manager` dos blocos tenant-wide por rank e evitar subquery RLS em `vehicles` dentro da policy de `workshop_schedules`;
  - criada `supabase/migrations/20260602000100_fix_workshop_schedules_driver_rls_recursion.sql` para remover também a subquery direta de `vehicles` no ramo `Driver` da mesma policy;
  - criada `supabase/migrations/20260602000200_fix_admin_master_rls_regression.sql` para corrigir regressao de RLS no Admin Master em Dashboard, Veiculos e Oficinas, movendo checks cruzados de Workshop/Gestor para funcoes `SECURITY DEFINER` e recompondo `vehicles_select`, `workshops_select` e `maintenance_select`;
  - a tela `Agendamentos` foi ajustada para buscar `workshop_schedules` sem joins aninhados e hidratar `vehicles`, `workshops` e `profiles` separadamente.
- Validações executadas nesta entrega:
  - `npm run lint` ✅
  - `npm run test:unit` ✅ (`128` testes passando)
- Limitações remanescentes:
  - a suíte E2E completa já falhava antes desta mudança no setup de `Jorge` (`e2e/setup/jorge.setup.ts`, permanência em `/login` em vez de redirect esperado);
  - por isso, o aceite automatizado final desta feature permanece dependente de validação manual guiada ou execução E2E em ambiente funcional do usuário;
  - smoke visual completo via sandbox continua não validado por indisponibilidade de acesso útil a `localhost:3000`.

## 🆕 Atualização de Sessão (03/06/2026)
Bug corrigido: tela em branco ao editar veiculo em /cadastros/veiculos.
Causa raiz: `vehicleFromRow` propagava `vehicles.axle_config` nao-array para `Vehicle.axleConfig`; `VehicleForm` passava esse valor para `AxleConfigEditor`, que chamava `entries.reduce` e quebrava a renderizacao.
Correcao aplicada: normalizacao defensiva de `axle_config` no mapper de veiculos, preservando arrays validos e descartando formatos invalidos como `undefined`.
Arquivos modificados: `src/lib/vehicleMappers.ts`, `src/lib/vehicleMappers.test.ts`, `docs/MEMORY.md`
Testes adicionados: casos unitarios em `src/lib/vehicleMappers.test.ts` para `axle_config` valido e invalido.

## 🆕 Atualização de Sessão (03/06/2026) — Auth/RLS E2E pós Gestor de Operações
Bug corrigido: regressão de autenticação/RLS após Gestor de Operações afetando a confiabilidade da suíte Playwright E2E.
Causa raiz: mistura de `.auth` antigos, specs desatualizados frente às regras atuais de roles, seed E2E incompatível com o schema atual de `vehicles` e fluxos completed dependentes de dados obrigatórios reais do formulário.
Correção aplicada: adicionada validação `e2e/completed/auth-storage-state.spec.ts`; seed de `driver-checklist-visibility` atualizado para respeitar constraints atuais e reutilizar template publicado compatível; `driver-user-integration` atualizado para refletir as regras atuais de roles e preencher o formulário completo exigido pelo tenant; `shippers-operational-units` alinhado ao contexto autenticado real de Manager; `Drivers.tsx` e `Shippers.tsx` agora falham explicitamente sem cliente ativo e aguardam a invalidação das queries antes de fechar o modal.
Arquivos modificados: `e2e/completed/auth-storage-state.spec.ts`, `e2e/completed/driver-checklist-visibility.spec.ts`, `e2e/completed/driver-user-integration.spec.ts`, `e2e/completed/shippers-operational-units.spec.ts`, `src/pages/Drivers.tsx`, `src/pages/Shippers.tsx`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/auth-storage-state.spec.ts`

## 🆕 Atualização de Sessão (03/06/2026) — Cadastros/Usuários
Bug corrigido: abas de Cadastros travavam após alguns segundos para usuário `Coordinator`, mantendo a tela de `Usuários` renderizada mesmo com a URL mudando para outra aba.
Causa raiz: `CreateUserModal` em `src/pages/Users.tsx` iniciava com role padrão `Operations Manager` para perfis `Coordinator`; como `useOperationsManagerOptions` devolvia arrays vazios novos a cada render, um `useEffect` dependente de `operationalUnits` disparava `setForm` em loop e gerava `Maximum update depth exceeded`, bloqueando a atualização do conteúdo da rota.
Correção aplicada: `useOperationsManagerOptions` passou a reutilizar arrays vazios estáveis e `availableRoles` em `Users.tsx` passou a ser memoizado, eliminando o loop de render na tela de `Usuários`; adicionado teste E2E cobrindo navegação entre abas para `Manager` e regressão específica do `Coordinator`.
Arquivos modificados: `src/pages/Users.tsx`, `e2e/completed/cadastros-tab-navigation.spec.ts`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/cadastros-tab-navigation.spec.ts`

## 🆕 Atualização de Sessão (03/06/2026) — Protocolo de Smoke
Melhoria aplicada: protocolo oficial de smoke definido e automatizado.
Causa raiz: `prompts/Evolucao.md` e `prompts/Fixbugs.md` exigiam "testes de fumaca do docs/MEMORY.md", mas o projeto nao tinha um comando unico nem uma spec dedicada, abrindo margem para execucao inconsistente.
Correcao aplicada: criado `npm run test:smoke` com spec dedicada em `e2e/smoke/app-smoke.spec.ts`; `agent/AGENT.md`, `docs/MEMORY.md`, `prompts/Evolucao.md` e `prompts/Fixbugs.md` passaram a apontar para o comando oficial e a bloquear improvisacao manual do smoke.
Arquivos modificados: `e2e/smoke/app-smoke.spec.ts`, `package.json`, `agent/AGENT.md`, `docs/MEMORY.md`, `prompts/Evolucao.md`, `prompts/Fixbugs.md`
Testes adicionados: `e2e/smoke/app-smoke.spec.ts`
Validacoes executadas: `npm run lint` ✅; `npm run test:unit` ✅ (`130` testes passando); `npx playwright test e2e/smoke/app-smoke.spec.ts --project=chromium` ✅ (`6` testes passando); `npm run build` ✅
Observacao operacional: no sandbox local, o `webServer` do Playwright nao conseguiu conectar em `localhost:3000` apesar da porta escutar; a validacao do smoke foi concluida fora do sandbox para confirmar o protocolo real.

## 🆕 Atualização de Sessão (03/06/2026) — Configurações de Veículos
Bug corrigido: configuracoes de campos obrigatorios de veiculos exibiam sucesso mas nao persistiam para usuarios Coordinator.
Causa raiz: RLS de escrita em `vehicle_field_settings` exigia Manager+, enquanto a UI permitia Coordinator; o UPDATE retornava zero linhas sem erro e `Settings.tsx` exibia sucesso falso.
Correcao aplicada: policy de escrita de `vehicle_field_settings` alinhada para Coordinator/Manager/Director/Admin Master; `Settings.tsx` passou a validar linha persistida e invalidar cache usado pelo formulario de veiculos.
Arquivos modificados: `src/pages/Settings.tsx`, `supabase/migrations/20260603000000_fix_coordinator_vehicle_field_settings_rls.sql`, `e2e/completed/settings-vehicle-field-persistence.spec.ts`, `docs/MEMORY.md`
Testes adicionados: `e2e/completed/settings-vehicle-field-persistence.spec.ts`

## 🆕 Atualização de Sessão (03/06/2026) — Baseline E2E
Bug corrigido: suite E2E misturava falhas reais, specs pending e instabilidade operacional, impedindo baseline confiavel.
Causa raiz: execucao padrao incluia `e2e/pending/**`, havia spec completed com credenciais antigas e havia diferenca de conectividade entre sandbox do agente e host local para `localhost:3000`.
Correcao aplicada: baseline E2E separado de pending, script explicito para pending/auth, spec completed de roles atualizada para credenciais oficiais e relatorio de triagem criado.
Arquivos modificados: `playwright.config.ts`, `package.json`, `e2e/completed/new-roles-audit.spec.ts`, `.claude/reports/e2e-baseline-triage-2026-06-03.md`, `docs/MEMORY.md`
Testes adicionados: nenhum teste funcional novo; adicionados gates operacionais via scripts E2E.

## 🆕 Atualização de Sessão (04/06/2026) — Pneus Manager E2E
Bug corrigido: `e2e/completed/tenant-users-manager-tires.spec.ts` falhava no teste 06 ao tentar selecionar uma posicao desabilitada no cadastro individual de pneu.
Causa raiz: spec desatualizada; o teste tratava `disabled=""` como opcao habilitada ao usar `if (!isDisabled)`, embora o produto exibisse corretamente posicoes ocupadas como desabilitadas e posicoes livres como selecionaveis.
Correcao aplicada: selecao de posicao passou a exigir ausencia do atributo `disabled`; o teste falha explicitamente se nao houver posicao livre. Tambem foi ajustado seletor ambíguo do teste 10 no mesmo spec (`De`/`Para`) para headers exatos.
Arquivos modificados: `e2e/completed/tenant-users-manager-tires.spec.ts`, `IMPLEMENTATION_FIXBUG.md`, `.claude/reports/tire-manager-test-06-triage-2026-06-04.md`, `docs/MEMORY.md`
Testes: `npm run test:smoke` ✅; `npm run test:e2e:auth` ✅ apos regenerar `setup-carlos` e `setup-jorge`; `npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager --grep "06"` ✅; `npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager` ✅ (`15` passaram).

## 🆕 Atualização de Sessão (04/06/2026) — New Roles Audit E2E
Bug corrigido: `e2e/completed/new-roles-audit.spec.ts` ainda esperava nomes antigos (`Robson`/`Pereira`) para as credenciais oficiais de Coordinator e Supervisor.
Causa raiz: spec desatualizada frente aos usuarios oficiais atuais (`Beatriz Lima` e `Camila Torres`) e seletor de badge de role amplo demais, casando topbar e sidebar. A spec tambem esperava indevidamente que Supervisor nao pudesse criar `Fleet Analyst`, embora a regra atual permita criar roles com rank inferior.
Correcao aplicada: nomes atualizados para `Beatriz Lima` e `Camila Torres`; badge de role validado dentro do `banner`; expectativa de hierarquia do Supervisor alinhada a `ROLE_RANK[candidate] < myRank`.
Arquivos modificados: `e2e/completed/new-roles-audit.spec.ts`, `docs/MEMORY.md`
Testes: `npx playwright test e2e/completed/new-roles-audit.spec.ts --project=chromium` ✅ (`37` passaram); `npm run test:e2e` ✅ (`130` passaram, `9` skipped).
