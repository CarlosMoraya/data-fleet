# IMPLEMENTATION.md
Gerado em: 2026-06-01
Sessão: Novo perfil Gestor de Operações com escopo por embarcador e base
Tipo de mudança: Tipo 2 — Nova regra de acesso + alteração de dados + ajuste de navegação
Baseado em: `prompts/Evolucao.md`, `agent/AGENT.md`, `agent/AGENT-BACKEND.md`, `agent/AGENT-DATABASE.md`, `agent/AGENT-FRONTEND.md`, `docs/MEMORY.md`, `docs/PRD.md`, `docs/SPEC.md`

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação fechada da implementação. O agente de código que executar este plano:

- NÃO deve implementar comportamento que não esteja descrito aqui.
- NÃO deve tratar filtro de embarcador/base apenas no frontend; a proteção real deve existir também no banco.
- NÃO deve permitir que o novo perfil ganhe permissões implícitas por hierarquia de rank.
- NÃO deve expor o novo perfil em menus, botões, formulários ou rotas além do que está especificado aqui.
- NÃO deve reaproveitar `Fleet Assistant`, `Supervisor` ou outro papel existente como atalho para o novo comportamento.
- NÃO deve deixar cadastros do novo perfil sem ao menos 1 embarcador e 1 base operacional.
- NÃO deve permitir associação de bases que não pertençam a um dos embarcadores selecionados.
- NÃO deve alterar comportamento funcional de outros perfis além do estritamente necessário para suportar o novo perfil.
- SE encontrar divergência entre arrays/listas de roles espalhados pelo código, deve alinhar todos os pontos tocados nesta implementação; não pode deixar metade atualizada.

## Resultado Esperado

Criar um novo perfil chamado **Gestor de Operações** com as regras abaixo:

- O identificador técnico do papel será `Operations Manager`.
- O rótulo exibido ao usuário será `Gestor de Operações`.
- O perfil pertence a um único `client_id`, como os demais perfis tenant-scoped.
- No cadastro e na edição, o perfil deve ser associado obrigatoriamente a:
  - 1 ou mais `shippers` do cliente.
  - 1 ou mais `operational_units` pertencentes a esses `shippers`.
- Apenas usuários com papel `Coordinator` ou `Manager` podem criar e editar esse perfil na tela tenant de usuários.
- O Gestor de Operações deve ver na sidebar apenas:
  - `Agendamentos`
  - `Manutenção`
- O acesso a essas duas telas é somente leitura.
- O Gestor de Operações deve enxergar apenas registros ligados aos embarcadores e bases operacionais associados a ele.

## Premissas de Negócio Assumidas

- “Embarcadores” significa `shippers` do cliente do BetaFleet.
- “Bases” significa `operational_units`.
- O perfil não deve acessar nenhum outro módulo, nem por menu nem por URL direta.
- A visibilidade deve ser restrita pelos dados do veículo associado ao registro:
  - `vehicles.shipper_id`
  - `vehicles.operational_unit_id`
- Se um registro de agendamento ou manutenção estiver ligado a veículo sem `shipper_id` ou `operational_unit_id`, ele NÃO deve aparecer para `Operations Manager`.
- O novo perfil é de leitura total dentro do seu escopo; não há restrições adicionais além de embarcador/base e dos dois módulos permitidos.

## Estado das Verificações Antes do Plano

### Verificação 1 — Testes de fumaça

O `docs/MEMORY.md` não define uma lista explícita de smoke tests.

Validação executada no ambiente disponível:

- `curl -I http://localhost:3000/login`: falhou a partir deste sandbox com `curl: (7) Failed to connect`.
- `npx playwright test e2e/completed/auth.spec.ts e2e/completed/access-control.spec.ts --project=chromium`: não executou porque `config.webServer` não conseguiu subir neste ambiente.

Registro obrigatório do que não foi possível validar:

- O que não foi validado: smoke visual do app em navegador a partir deste ambiente.
- Por que não foi validado: o sandbox não conseguiu acessar `localhost:3000` por HTTP, embora o usuário tenha confirmado o app aberto; além disso, o Playwright depende do `webServer` local do próprio sandbox.
- Risco de seguir sem isso: um fluxo visual pode falhar mesmo com typecheck e testes unitários saudáveis.
- Como validar depois: rodar os testes E2E/visuais no ambiente do usuário ou em ambiente onde Playwright e a porta 3000 estejam visíveis.

### Verificação 2 — `MEMORY.md` longo demais

- `docs/MEMORY.md` tem 83 linhas.
- Não há bloqueio; não é necessário arquivar antes desta mudança.

### Verificação 3 — `SPEC.md` desatualizado

- `docs/SPEC.md` está resumido e não cobre a complexidade atual de roles, RLS e novos fluxos.
- Não há contradição textual bloqueante com `docs/MEMORY.md`, mas esta implementação DEVE atualizar `docs/MEMORY.md` ao final.

### Verificação 4 — arquivos `agent/*` longos demais

- Os arquivos lidos estão abaixo do limite operacional; nenhuma limpeza é necessária.

### Verificação 5 — testes automatizados

Executado:

- `npm run test:unit` -> **118 testes passando**, **0 falhando**.

Executado parcialmente:

- `npm run test:e2e` iniciou com **274 testes** e falhou antes de concluir.
- Primeira falha observada: `[setup-jorge] e2e/setup/jorge.setup.ts` esperava redirecionamento para `/checklists`, mas permaneceu em `/login`.

Impacto:

- Existe falha E2E pré-existente na base antes desta mudança.
- A implementação deve incluir uma etapa inicial de estabilização ou, no mínimo, registrar que o aceite E2E final desta feature depende da correção desse problema prévio.

### Verificação 6 — typecheck

Executado:

- `npm run lint` -> passou.

Observação:

- No projeto atual, `lint` é na prática `tsc --noEmit`.

### Verificação 7 — lint

- Não há lint separado configurado (ex.: ESLint).
- O script `lint` existente é apenas typecheck (`tsc --noEmit`).
- Essa ausência deve ser registrada, não tratada como erro.

### Verificação 8 — mapa de cobertura existente para esta mudança

Cobertura existente relevante:

- Unitário:
  - `src/pages/Maintenance.query-scope.test.ts`
    - cobre apenas a função `shouldEnableMaintenanceOrdersQuery`.
- E2E concluído:
  - `e2e/completed/auth.spec.ts`
  - `e2e/completed/access-control.spec.ts`
  - `e2e/completed/new-roles-audit.spec.ts`
  - `e2e/completed/admin-users.spec.ts`
  - `e2e/completed/driver-user-integration.spec.ts`

O que essa cobertura atende hoje:

- login e proteção básica de rotas sem autenticação;
- sidebar e permissões de perfis já existentes;
- modal de criação de usuários e algumas regras de hierarquia;
- habilitação de query em `Maintenance` para casos já existentes.

O que NÃO está coberto hoje:

- novo role `Operations Manager`;
- associação obrigatória de usuário a embarcadores e bases;
- edição dessas associações;
- filtro de agendamentos e manutenções por escopo do perfil;
- garantia de read-only nas telas `Agendamentos` e `Manutenção`;
- bloqueio de URL direta para rotas não permitidas ao novo perfil;
- RLS das novas tabelas de associação;
- payload novo do `create-user`.

Conclusão:

- O projeto não tem cobertura automatizada suficiente para este fluxo.
- Esta implementação DEVE incluir testes novos.

### Verificação 9 — obrigação de especificar teste novo

Obrigatório nesta implementação:

- pelo menos 1 teste unitário novo;
- pelo menos 1 teste de integração/fluxo de UI novo;
- pelo menos 1 validação E2E ou validação manual guiada específica do novo perfil.

### Verificação 10 — registro consolidado do que não foi possível validar

- Não foi possível validar smoke visual completo a partir do sandbox.
- Não foi possível obter resultado final da suíte E2E completa como base confiável de regressão por existir falha prévia já no setup.
- O aceite desta feature deve ser considerado parcial até a validação final em ambiente funcional de navegador.

## Conflitos e Armadilhas Já Detectados

1. A definição de roles está duplicada em muitos pontos do projeto.

Arquivos já confirmados com listas/hierarquias próprias:

- `src/types/role.ts`
- `src/lib/rolePermissions.ts`
- `src/pages/Users.tsx`
- `src/pages/AdminUsers.tsx`
- `src/components/Sidebar.tsx`
- `src/pages/WorkshopSchedules.tsx`
- `src/pages/BudgetApprovals.tsx`
- `src/components/ActionPlanModal.tsx`
- `supabase/functions/create-user/index.ts`
- `supabase/functions/delete-user/index.ts`

2. O projeto usa hoje rank para várias permissões, mas este novo perfil NÃO pode herdar poderes de gerenciamento só por estar abaixo de `Coordinator` e `Manager`.

3. `Maintenance.tsx` hoje não tem um guard explícito por allowlist como `WorkshopSchedules.tsx`; para o novo perfil, o bloqueio de URL direta precisa ser tratado conscientemente.

4. O `supabase/schema.sql` contém histórico de hierarquia que não deve ser tratado como verdade única de runtime. Para esta implementação, a referência prática deve ser o runtime atual do app e das edge functions tocadas.

## Arquivos a Criar ou Modificar

### Criar

- `supabase/migrations/20260601000000_add_operations_manager_role_and_scope.sql`
- `src/lib/operationsManagerScope.ts`
- `src/lib/operationsManagerScope.test.ts`
- `e2e/pending/operations-manager-readonly-scope.spec.ts`

### Modificar

- `src/types/role.ts`
- `src/types/user.ts`
- `src/lib/rolePermissions.ts`
- `src/context/AuthContext.tsx`
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/pages/Users.tsx`
- `src/pages/AdminUsers.tsx`
- `src/pages/WorkshopSchedules.tsx`
- `src/pages/Maintenance.tsx`
- `src/pages/Maintenance.query-scope.test.ts`
- `supabase/functions/create-user/index.ts`
- `supabase/functions/delete-user/index.ts`
- `docs/MEMORY.md`

### Modificar apenas se necessário para suportar UI read-only corretamente

- `src/components/MaintenanceDetailModal.tsx`
- `src/components/MaintenanceForm.tsx`
- `src/components/ScheduleForm.tsx`
- `src/types/workshop.ts`
- `src/types/maintenance.ts`
- `e2e/completed/new-roles-audit.spec.ts`

### Não modificar nesta implementação

- `src/pages/AdminClients.tsx`
- módulos de pneus
- módulos de checklists
- qualquer workflow de oficina além do necessário para não expor ações ao novo perfil

## Decisões Técnicas Obrigatórias

### 1. Papel canônico

- Valor persistido em banco e usado no código: `Operations Manager`
- Label exibida em UI: `Gestor de Operações`

Não usar `Gestor de Operações` como valor salvo no banco.

### 2. Hierarquia

Definir `Operations Manager` com rank **5**, empatado conceitualmente com `Supervisor` para ordenação visual, mas SEM herdar permissões de gestão.

Regras obrigatórias:

- `Fleet Analyst` e abaixo NÃO podem criar nem editar `Operations Manager`.
- `Supervisor` NÃO pode criar nem editar `Operations Manager`.
- `Coordinator` e `Manager` PODEM criar e editar `Operations Manager`.
- `Director` e `Admin Master` NÃO devem ganhar essa ação na UI tenant de usuários nesta entrega.

Por isso, a criação de roles não pode continuar sendo calculada apenas por `ROLE_RANK < myRank` para este caso.

### 3. Modelo de dados do escopo

Criar duas tabelas de associação:

1. `profile_shipper_scopes`
   - `profile_id uuid not null references public.profiles(id) on delete cascade`
   - `shipper_id uuid not null references public.shippers(id) on delete cascade`
   - `client_id uuid not null references public.clients(id) on delete cascade`
   - `created_at timestamptz not null default now()`
   - `created_by uuid null references public.profiles(id)`
   - chave primária composta: `(profile_id, shipper_id)`

2. `profile_operational_unit_scopes`
   - `profile_id uuid not null references public.profiles(id) on delete cascade`
   - `operational_unit_id uuid not null references public.operational_units(id) on delete cascade`
   - `client_id uuid not null references public.clients(id) on delete cascade`
   - `created_at timestamptz not null default now()`
   - `created_by uuid null references public.profiles(id)`
   - chave primária composta: `(profile_id, operational_unit_id)`

Índices obrigatórios:

- por `client_id`
- por `profile_id`
- por `shipper_id` na tabela de shipper scopes
- por `operational_unit_id` na tabela de unit scopes

### 4. Integridade obrigatória

A implementação DEVE garantir:

- somente perfis com `role = 'Operations Manager'` podem ter registros nessas tabelas;
- todas as associações devem pertencer ao mesmo `client_id` do perfil;
- toda `operational_unit` associada deve pertencer a um `shipper` que também esteja associado ao perfil.

Forma obrigatória de garantir isso:

- validar no fluxo de criação/edição no backend;
- validar novamente no frontend para UX;
- se necessário, usar trigger SQL ou `check via function` na migration para impedir inconsistência fora do app.

Se optar por trigger, ela deve ser criada na mesma migration.

### 5. Segurança real dos dados

O escopo do Gestor de Operações deve ser protegido em RLS, não só nas queries do frontend.

Adicionar políticas ou funções auxiliares para permitir `SELECT` restrito ao novo perfil nas tabelas abaixo:

- `shippers`
- `operational_units`
- `vehicles`
- `workshop_schedules`
- `maintenance_orders`

Regras:

- `Operations Manager` só pode ler `shippers` explicitamente associados.
- `Operations Manager` só pode ler `operational_units` explicitamente associadas.
- `Operations Manager` só pode ler `vehicles` cujo `shipper_id` e `operational_unit_id` estejam ambos dentro do escopo permitido.
- `Operations Manager` só pode ler `workshop_schedules` e `maintenance_orders` quando o `vehicle_id` apontar para um veículo visível por essa regra.
- Não criar políticas de `INSERT`, `UPDATE` ou `DELETE` para `Operations Manager` nessas tabelas operacionais.

### 6. Navegação e rotas

O novo perfil deve conseguir acessar somente:

- `/agendamentos`
- `/manutencao`

Comportamento obrigatório:

- ao fazer login e ir para `/`, redirecionar para `/agendamentos`;
- se tentar abrir qualquer outra rota protegida por URL direta, redirecionar para `/agendamentos`;
- a sidebar deve exibir apenas os dois links permitidos.

### 7. Read-only obrigatório

#### Em `Agendamentos`

O Gestor de Operações pode:

- listar registros;
- buscar/filtrar o que já existir na página;
- abrir detalhes somente se o fluxo atual já suportar leitura sem edição.

O Gestor de Operações não pode:

- criar agendamento;
- editar agendamento;
- concluir agendamento;
- cancelar agendamento;
- excluir agendamento;
- gerar OS de manutenção a partir do agendamento.

#### Em `Manutenção`

O Gestor de Operações pode:

- listar ordens;
- pesquisar;
- filtrar por status;
- abrir detalhes em leitura.

O Gestor de Operações não pode:

- criar manutenção;
- editar OS;
- anexar orçamento;
- alterar status;
- aprovar/reprovar;
- cancelar OS;
- excluir qualquer coisa.

## Sequência de Implementação Obrigatória

### Etapa 0 — estabilização mínima prévia

Antes do aceite final da feature:

- registrar em comentário técnico ou `docs/MEMORY.md` que a suíte E2E já falhava no setup de `Jorge` antes desta mudança;
- não usar o estado atual da suíte E2E como prova de regressão da feature;
- se houver tempo dentro da execução da feature, corrigir a falha do setup de `Jorge`;
- se não houver, manter a correção da feature separada dessa falha preexistente e validar a feature com testes direcionados + validação manual guiada.

### Etapa 1 — banco e RLS

Criar a migration `20260601000000_add_operations_manager_role_and_scope.sql` com:

1. atualização da constraint/check de `profiles.role` para incluir `Operations Manager`;
2. criação das tabelas:
   - `profile_shipper_scopes`
   - `profile_operational_unit_scopes`
3. índices das duas tabelas;
4. RLS habilitado nas duas tabelas;
5. policies para:
   - `Coordinator` e `Manager` lerem e administrarem scopes do próprio `client_id`;
   - `Operations Manager` ler apenas seus próprios scopes;
   - `Admin Master`, `Director`, `Supervisor`, `Fleet Analyst`, `Fleet Assistant` não ganharem escrita nessas tabelas por padrão;
6. funções auxiliares SQL para checar escopo do `Operations Manager`;
7. ajuste das policies de `shippers`, `operational_units`, `vehicles`, `workshop_schedules` e `maintenance_orders` para suportar leitura restrita do novo papel.

Observações obrigatórias:

- não remover políticas existentes de outros perfis sem reintroduzir a lógica atual;
- preservar o comportamento especial de `Admin Master`;
- validar se nested selects com `vehicles(...)` continuam funcionando sob as novas policies;
- se `workshops(name, ...)` vier `null` nas telas visíveis ao novo perfil por causa de RLS, adicionar policy de leitura somente para oficinas referenciadas por registros visíveis.

### Etapa 2 — tipagem e fonte de verdade do papel

Atualizar:

- `src/types/role.ts`
- `src/lib/rolePermissions.ts`
- qualquer helper tipado necessário em `src/types/user.ts`

Adicionar ao `src/lib/rolePermissions.ts`:

- rank do `Operations Manager`;
- label amigável `Gestor de Operações`;
- helper `isOperationsManager(role)`;
- helper para `canManageOperationsManagerScope(role)`;
- helper para `getCreatableRoles(role)` substituindo a lógica puramente baseada em rank para a tela de usuários;
- helper para `canAccessOperationsReadonlyModules(role)`.

Obrigatório:

- nos arquivos tocados nesta implementação, parar de hardcodear listas divergentes quando houver helper central disponível.

### Etapa 3 — criação e edição de usuários

#### `src/pages/Users.tsx`

Implementar:

1. O dropdown de cargos deve incluir `Gestor de Operações` somente quando o usuário logado for `Coordinator` ou `Manager`.
2. Ao selecionar `Gestor de Operações`, exibir seção obrigatória:
   - multiselect de embarcadores;
   - multiselect de bases operacionais;
   - bases devem ser filtradas pelos embarcadores marcados;
   - ao remover um embarcador, remover da seleção qualquer base que não pertença mais a ele.
3. Tornar obrigatórios:
   - pelo menos 1 embarcador;
   - pelo menos 1 base.
4. Para esse papel, ocultar ou desabilitar no formulário:
   - permissões de exclusão;
   - limite de aprovação.
5. Forçar payload de criação:
   - `budget_approval_limit = 0`
   - `can_delete_vehicles = false`
   - `can_delete_drivers = false`
   - `can_delete_workshops = false`
   - `shipper_ids`
   - `operational_unit_ids`
6. Na edição:
   - manter o cargo não editável como já é hoje;
   - se o usuário editado for `Operations Manager`, carregar e permitir editar embarcadores/bases;
   - se não for `Operations Manager`, manter fluxo atual.

Obrigatório:

- o save de escopo não pode ser parcial; a sincronização deve substituir o conjunto completo de associações daquele perfil.

#### `src/pages/AdminUsers.tsx`

Obrigatório:

- permitir exibir o badge/label do novo role caso ele exista;
- NÃO expor criação/edição de `Operations Manager` nessa tela nesta entrega.

Forma prática:

- remover `Operations Manager` das opções de create/edit em `AdminUsers`;
- manter renderização correta se um registro desse role aparecer listado.

### Etapa 4 — backend de criação/edição do escopo

#### `supabase/functions/create-user/index.ts`

Estender o payload para aceitar, quando `role === 'Operations Manager'`:

- `shipper_ids: string[]`
- `operational_unit_ids: string[]`

Regras obrigatórias no backend:

1. rejeitar criação se arrays estiverem ausentes ou vazios;
2. validar que caller é `Coordinator` ou `Manager`;
3. validar que todos os IDs pertencem ao mesmo `client_id` do caller;
4. validar que todas as `operational_units` pertencem a `shipper_ids` informados;
5. criar `auth.user`;
6. criar `profile`;
7. inserir os registros de scope;
8. em caso de falha após criação do auth user, fazer rollback completo possível:
   - apagar profile;
   - apagar auth user recém-criado.

Também obrigatoriamente:

- impedir que `Operations Manager` use a função para criar qualquer usuário, mesmo que seu rank numérico permita em algum lugar;
- impedir que `Director` e `Admin Master` criem `Operations Manager` por esta rota nesta entrega.

#### Edição do escopo

Implementar edição por uma destas duas abordagens, escolhendo a de menor impacto:

1. estender `create-user` com `action: 'sync_operations_scope'`; ou
2. criar uma nova edge function dedicada, por exemplo `update-user-scope`.

Independente da abordagem, o comportamento deve ser:

- disponível só para `Coordinator` e `Manager`;
- recebe `target_user_id`, `shipper_ids`, `operational_unit_ids`;
- valida o role do usuário-alvo;
- sincroniza as duas tabelas em modo replace-all;
- impede deixar o perfil sem escopo válido.

### Etapa 5 — autenticação, redirect e navegação

Atualizar:

- `src/App.tsx`
- `src/context/AuthContext.tsx`
- `src/components/Sidebar.tsx`

Obrigatório:

1. `HomeRedirect`:
   - `Operations Manager` -> `/agendamentos`
2. Sidebar:
   - mostrar somente `Agendamentos` e `Manutenção`
3. Guard de rotas:
   - se `Operations Manager` tentar abrir qualquer rota diferente dessas duas, redirecionar para `/agendamentos`
4. `AuthContext`:
   - não conceder troca de cliente a esse perfil;
   - manter `currentClient` baseado no `profile.client_id`.

Preferência técnica:

- implementar um helper central de autorização por rota em vez de espalhar `if` soltos.
- se isso ficar grande demais, ao menos garantir o guard em `App.tsx` para bloquear URL direta.

### Etapa 6 — tela de Agendamentos

Atualizar `src/pages/WorkshopSchedules.tsx`.

Obrigatório:

1. incluir `Operations Manager` na allowlist de acesso;
2. não tratá-lo como `Driver`;
3. criar uma flag explícita:
   - `isOperationsManager`
   - `canWriteSchedules = false` para esse perfil
4. manter consulta apenas de leitura;
5. garantir que os botões abaixo não apareçam para esse perfil:
   - `Novo Agendamento`
   - editar
   - concluir
   - cancelar
   - excluir
   - `Gerar OS de Manutenção`
6. se o componente de card receber callbacks de ação, não passar callbacks para esse perfil;
7. confirmar que a tela continua funcionando quando a lista vier vazia após o filtro de escopo.

Filtro obrigatório:

- o frontend pode continuar consultando `workshop_schedules` normalmente pelo cliente, mas a query deve assumir que a restrição final virá de RLS;
- não duplicar filtros inconsistentes no frontend se o RLS já resolver o recorte.

### Etapa 7 — tela de Manutenção

Atualizar `src/pages/Maintenance.tsx`.

Obrigatório:

1. criar guard explícito de acesso:
   - `Workshop`
   - perfis de frota já permitidos hoje
   - `Operations Manager`
2. `Operations Manager` deve cair na visão de listagem e detalhe, nunca de edição;
3. criar flag:
   - `isOperationsManager`
   - `canWriteMaintenance = false`
4. esconder para esse perfil:
   - `Nova Manutenção`
   - editar OS
   - anexar orçamento
   - botões de transição de status
   - cancelamento
5. se o componente de detalhe mostrar ações, escondê-las;
6. impedir abertura do formulário por estado residual de `sessionStorage` ou navegação indireta.

Importante:

- a função `shouldEnableMaintenanceOrdersQuery` deve continuar correta com o novo perfil;
- para `Operations Manager`, a query deve habilitar quando houver `currentClient.id`, como qualquer perfil tenant normal;
- o recorte por embarcador/base deve acontecer no banco.

### Etapa 8 — helper de escopo

Criar `src/lib/operationsManagerScope.ts` com helpers puros para:

- validar arrays de shipper/base;
- remover bases que não pertençam aos embarcadores selecionados;
- comparar scope atual x novo scope;
- normalizar payloads.

Esses helpers devem ser usados no formulário e ter testes unitários dedicados.

### Etapa 9 — documentação operacional

Atualizar `docs/MEMORY.md` ao final da implementação com:

- resumo da feature;
- migration criada;
- arquivos alterados;
- testes adicionados;
- limitação remanescente da suíte E2E, se continuar falhando.

## Regras de Implementação que NÃO podem ser omitidas

1. O novo role deve aparecer corretamente em badges/listagens, mas o texto exibido ao usuário deve ser `Gestor de Operações`.
2. O novo role não deve aparecer em `Cadastros`, `Dashboard`, `Checklists`, `Plano de Ação`, `Templates`, `Configurações`, `Aprovação de Orçamentos` nem páginas administrativas.
3. O novo role não pode ter permissão de deletar veículos, motoristas ou oficinas.
4. O novo role não pode ter limite de aprovação maior que zero.
5. O novo role não pode criar, editar ou excluir usuários.
6. Ao editar o escopo, o sistema deve substituir integralmente o conjunto anterior; não misturar update incremental sem limpeza controlada.
7. Se um usuário deixar de ser `Operations Manager` no banco futuramente, os registros nas tabelas de escopo devem ser removidos na mesma transação ou por cleanup explícito.

## Testes Novos Obrigatórios

### Unitários

Criar `src/lib/operationsManagerScope.test.ts` cobrindo no mínimo:

- remoção de bases fora dos embarcadores selecionados;
- validação de payload vazio;
- normalização determinística do escopo;
- comparação entre scope antigo e novo.

Atualizar `src/pages/Maintenance.query-scope.test.ts` para incluir:

- `Operations Manager` com `currentClientId` definido -> `true`
- `Operations Manager` sem `currentClientId` -> `false`

### Integração/UI local

Adicionar testes para `src/pages/Users.tsx` cobrindo no mínimo:

- `Coordinator` ou `Manager` vê a opção `Gestor de Operações`;
- `Supervisor` e `Fleet Analyst` não veem essa opção;
- selecionar o novo role exibe selects obrigatórios de embarcador/base;
- o save é bloqueado sem embarcador ou sem base;
- ao remover um embarcador, bases órfãs saem da seleção.

Se o projeto não tiver infraestrutura de teste de componente pronta para essa página, documentar isso e cobrir esse fluxo via E2E/validação manual guiada.

### E2E ou validação manual guiada

Criar `e2e/pending/operations-manager-readonly-scope.spec.ts` ou documento equivalente com o roteiro abaixo:

1. login como `Coordinator` ou `Manager`;
2. criar usuário `Operations Manager` com 2 embarcadores e 2 bases;
3. logout;
4. login como esse novo usuário;
5. confirmar que a sidebar mostra apenas `Agendamentos` e `Manutenção`;
6. tentar abrir `/`, `/cadastros/usuarios`, `/checklists`, `/settings` e confirmar redirect para `/agendamentos`;
7. abrir `Agendamentos` e verificar:
   - lista carrega;
   - só há registros dentro do escopo;
   - não existe botão de criação/edição/exclusão/geração de OS;
8. abrir `Manutenção` e verificar:
   - lista carrega;
   - só há registros dentro do escopo;
   - não existe botão de criação/edição/cancelamento/aprovação;
9. editar o usuário como `Coordinator` ou `Manager`, trocar escopo e confirmar que a visibilidade muda.

## Validação Manual Obrigatória Pós-Implementação

Mesmo que testes automatizados passem, executar este checklist:

1. Criar um `Operations Manager` por `Coordinator`.
2. Criar outro por `Manager`.
3. Confirmar que `Fleet Analyst` e `Supervisor` não conseguem criar esse papel.
4. Confirmar que `AdminUsers` não oferece esse papel para criação.
5. Confirmar que login do novo perfil cai em `/agendamentos`.
6. Confirmar que URL direta para páginas proibidas redireciona.
7. Confirmar que as duas telas permitidas não exibem ações mutáveis.
8. Confirmar que o usuário vê apenas dados de embarcadores/bases associados.
9. Confirmar que registros sem `shipper_id` ou `operational_unit_id` não vazam para esse perfil.
10. Confirmar que editar o escopo do usuário reflete imediatamente nas consultas após refresh.

## Critérios de Aceite

A implementação só está pronta quando todos os pontos abaixo forem verdadeiros:

1. Existe o role `Operations Manager` persistindo corretamente em `profiles`.
2. `Coordinator` e `Manager` conseguem criar/editar esse perfil com embarcadores e bases obrigatórios.
3. Nenhum outro papel tenant consegue fazer isso.
4. A sidebar do novo perfil mostra apenas `Agendamentos` e `Manutenção`.
5. O novo perfil não consegue acessar outras rotas por URL direta.
6. As telas permitidas são estritamente read-only.
7. O filtro por embarcador e base funciona em `workshop_schedules` e `maintenance_orders`.
8. O recorte está protegido por RLS, não apenas por frontend.
9. Os testes novos definidos neste documento foram implementados ou, se algum não for viável, a impossibilidade foi documentada com risco explícito.
10. `docs/MEMORY.md` foi atualizado.

## Fora de Escopo

- criar dashboard específico para o novo perfil;
- permitir troca de cliente ao novo perfil;
- permitir criação desse perfil pelo `Admin Master`;
- expor esse perfil no fluxo global de `AdminUsers`;
- filtrar outros módulos além de `Agendamentos` e `Manutenção`;
- qualquer alteração em OCR, pneus, checklist offline ou módulo de oficinas fora do necessário para não mostrar ações indevidas.
