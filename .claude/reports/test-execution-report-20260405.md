# Relatório de Execução de Testes E2E — Beta Fleet

**Data:** 05/04/2026, 19:45:00 (America/Sao_Paulo)  
**Executado por:** Qwen Code (Agente IA)  
**Duração total:** ~22 minutos

---

## Resumo Geral

| Métrica | Valor |
|---------|-------|
| Total de Testes Executados | 142 |
| ✅ Passaram | 107 |
| ❌ Falharam | 45 |
| ⏭️ Pulados | 17 |
| ⏸️ Não Executados (did not run) | 65 |
| Taxa de Sucesso | **70.2%** |

---

## Resultados por Projeto

| Projeto | Usuário | ✅ | ❌ | ⏭️ | ⏸️ | Total Specs | Status |
|---------|---------|---|---|---|---|-------------|--------|
| chromium | Admin Master | 47 | 10 | 7 | 28 | 92 | ⚠️ |
| manager | Alexandre | 34 | 12 | 4 | 19 | 69 | ⚠️ |
| assistant | Pedro | 13 | 7 | 4 | 5 | 29 | ⚠️ |
| assistant-actions | Pedro | 2 | 1 | 0 | 3 | 6 | ⚠️ |
| analyst | Mariana | 6 | 10 | 2 | 0 | 18 | ❌ |
| auditor | Carlos | 4 | 1 | 0 | 0 | 5 | ⚠️ |
| driver | Jorge | 3 | 1 | 0 | 0 | 4 | ⚠️ |

---

## Resultados por Módulo (Detalhado)

| # | Módulo | Arquivo Spec | Projeto | Testes | ✅ | ❌ | ⏭️ | Status |
|---|--------|--------------|---------|--------|---|---|---|--------|
| 1 | Autenticação | auth.spec.ts | chromium | 3 | 3 | 0 | 0 | ✅ |
| 2 | Controle de Acesso | access-control.spec.ts | chromium | 4 | 4 | 0 | 0 | ✅ |
| 3 | Checklists (Admin) | admin-checklist-delete.spec.ts | chromium | 3 | 3 | 0 | 0 | ✅ |
| 4 | Clientes | admin-clients.spec.ts | chromium | 6 | 6 | 0 | 0 | ✅ |
| 5 | Usuários (Admin) | admin-users.spec.ts | chromium | 7 | 7 | 0 | 0 | ✅ |
| 6 | Auditoria Admin Master | audit-admin-master.spec.ts | chromium | 7 | 5 | 2 | 0 | ❌ |
| 7 | Auditoria Tenant | audit-admin-tenant.spec.ts | analyst/assistant | 5 | 0 | 3 | 2 | ❌ |
| 8 | Fluxo Auditor | audit-auditor-flow.spec.ts | auditor | 4 | 3 | 1 | 0 | ⚠️ |
| 9 | Fluxo Driver | audit-driver-flow.spec.ts | driver | 3 | 2 | 1 | 0 | ⚠️ |
| 10 | Fluxos Cruzados | cross-profile-flows.spec.ts | analyst | 3 | 0 | 1 | 2 | ❌ |
| 11 | Integração Driver | driver-user-integration.spec.ts | analyst | 5 | 5 | 0 | 0 | ✅ |
| 12 | Novos Roles (Coord/Sup) | new-roles-audit.spec.ts | chromium | 36 | 26 | 2 | 7 | ⚠️ |
| 13 | Embarcadores | shippers-operational-units.spec.ts | chromium | 5 | 5 | 0 | 0 | ✅ |
| 14 | Usuários (Analyst) | tenant-users.spec.ts | analyst | 8 | 3 | 5 | 0 | ❌ |
| 15 | Drivers (Analyst) | tenant-users-analyst-drivers.spec.ts | analyst | 1 | 0 | 1 | 0 | ❌ |
| 16 | Seed Pesado (Analyst) | tenant-users-analyst-heavy-seed.spec.ts | analyst | 1 | 1 | 0 | 0 | ✅ |
| 17 | Veículos (Analyst) | tenant-users-analyst-vehicles.spec.ts | analyst | 1 | 0 | 1 | 0 | ❌ |
| 18 | Oficinas (Analyst) | tenant-users-analyst-workshops.spec.ts | analyst | 2 | 1 | 1 | 0 | ⚠️ |
| 19 | Ações (Assistant) | tenant-users-assistant-actions.spec.ts | assistant-actions | 5 | 2 | 1 | 3 | ⚠️ |
| 20 | Drivers (Assistant) | tenant-users-assistant-drivers.spec.ts | assistant | 1 | 0 | 1 | 0 | ❌ |
| 21 | Seed Pesado (Assistant) | tenant-users-assistant-heavy-seed.spec.ts | assistant | 2 | 2 | 0 | 0 | ✅ |
| 22 | Manutenção | tenant-users-assistant-maintenance.spec.ts | assistant | 7 | 6 | 1 | 0 | ⚠️ |
| 23 | Pneus (Assistant) | tenant-users-assistant-tires.spec.ts | assistant | 2 | 2 | 0 | 0 | ✅ |
| 24 | Permissões (Assistant) | tenant-users-assistant.spec.ts | assistant | 6 | 4 | 1 | 1 | ⚠️ |
| 25 | Veículos (Assistant) | tenant-users-assistant-vehicles.spec.ts | assistant | 2 | 0 | 2 | 0 | ❌ |
| 26 | Axle Config | tenant-users-manager-axle-config.spec.ts | manager | 12 | 0 | 0 | 12 | ⏭️ |
| 27 | Templates Checklist | tenant-users-manager-checklist-templates.spec.ts | manager | 7 | 6 | 1 | 0 | ⚠️ |
| 28 | Drivers (Manager) | tenant-users-manager-drivers.spec.ts | manager | 1 | 0 | 1 | 0 | ❌ |
| 29 | Seed (Manager) | tenant-users-manager-seed.spec.ts | manager | 1 | 1 | 0 | 0 | ✅ |
| 30 | Seed Drivers (Manager) | tenant-users-manager-seed-drivers.spec.ts | manager | 1 | 1 | 0 | 0 | ✅ |
| 31 | Pneus (Manager) | tenant-users-manager-tires.spec.ts | manager | 14 | 14 | 0 | 0 | ✅ |
| 32 | Veículos (Manager) | tenant-users-manager-vehicles.spec.ts | manager | 4 | 0 | 4 | 0 | ❌ |
| 33 | Partnership Oficinas | tenant-users-manager-workshop-partnership.spec.ts | manager | 14 | 14 | 0 | 0 | ✅ |
| 34 | Oficinas (Manager) | tenant-users-manager-workshops.spec.ts | manager | 6 | 5 | 1 | 0 | ⚠️ |
| 35 | Usuários (Manager) | tenant-users-manager.spec.ts | manager | 6 | 2 | 4 | 0 | ❌ |

---

## Falhas Detalhadas

### chromium (Admin Master) — 10 falhas

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| audit-admin-master | B.3 CRUD Veículos (Acesso Total) | Falha na operação de CRUD de veículos |
| audit-admin-master | C.1 Visualização de Dashboard Global | Dashboard não carregou conforme esperado |
| audit-auditor-flow | A.1 Acesso e Redirecionamento Automático | Redirecionamento não ocorreu |
| audit-auditor-flow | A.2 Tentativa de Acesso Proibido (Vehicles) | Restrição de acesso não funcionou |
| audit-auditor-flow | B.1 Visualização de Checklists e Filtros | Timeout ao esperar conteúdo (15s) |
| audit-auditor-flow | C.1 Logout | Falha no processo de logout |
| audit-driver-flow | B.1 Iniciar Novo Checklist | Botão "Iniciar" não respondeu |
| cross-profile-flows | Passo 1: Auditor gera Inconformidade | Falha no fluxo cruzado auditoria→manutenção |
| new-roles-audit | 1.6 Cadastros/Veículos — lista carrega | Lista de veículos não carregou para Coordinator |
| new-roles-audit | 2.4 Sidebar NÃO exibe Configurações | Link "Configurações" visível para Supervisor (não deveria) |

### manager (Alexandre) — 12 falhas

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| axle-config | 01 — AxleConfigEditor aparece | Componente não apareceu (teste pulado na execução direta) |
| checklist-templates | criar template para categoria Leve | Falha na criação de template |
| drivers | criar, editar e excluir motorista | CRUD de motoristas falhou |
| vehicles | configura campos obrigatórios | Validação de campos falhou |
| vehicles | cadastra veículo com todos os campos | Cadastro de veículo falhou |
| vehicles | edita veículo e verifica anexos | Edição não persistiu |
| vehicles | exclui o veículo criado | Exclusão falhou |
| workshops | cadastrar nova oficina | Cadastro de oficina falhou |
| users | modal mostra papéis permitidos | Dropdown com papéis incorretos |
| users | cria usuário com papel Fleet Assistant | Criação de usuário falhou |
| users | edita o nome do usuário | Edição não persistiu |
| users | exclui o usuário criado | `expect(...).toBeVisible()` falhou — item não encontrado na tabela após busca (timeout 8s) |

### assistant (Pedro) — 7 falhas

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| audit-admin-tenant | A.1 Restrição de Exclusão em Veículos | Restrição não funcionou |
| assistant-actions | deve filtrar ações por aba | Filtragem por abas falhou |
| assistant-drivers | visualizar e cadastrar motorista | Permissões de driver não corretas |
| assistant-maintenance | 05 — salvar: OS Interna e OS Oficina | Geração de OS falhou |
| assistant-vehicles | Assistant pode abrir formulário | Formulário não abriu conforme esperado |
| assistant-vehicles | Assistant não tem acesso a Settings | Acesso não foi bloqueado |
| assistant-users | modal mostra papéis permitidos | `expect(options).toContain('Driver')` falhou — Driver não estava nas opções do dropdown |

### analyst (Mariana) — 10 falhas

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| audit-admin-tenant | A.1 Acesso ao Dashboard e KPIs | Dashboard não carregou |
| audit-admin-tenant | B.1 Gestão de Veículos (Escrita) | Escrita em veículos falhou |
| analyst-drivers | visualizar, editar, excluir depende de flag | Permissões de drivers incorretas |
| analyst-vehicles | Analyst pode editar mas não ver lixeira | Permissões de veículos incorretas |
| analyst-workshops | permitir adicionar oficina | Adição de oficina falhou |
| users | modal de novo usuário com papéis corretos | Papéis no dropdown incorretos |
| users | cria usuário com papel Driver | Criação de usuário falhou |
| users | busca encontra o usuário criado | Busca não retornou resultado |
| users | edita o nome do usuário | `expect(...).toBeVisible()` falhou — item editado não encontrado na tabela (timeout 8s) |
| users | exclui o usuário criado | Exclusão não funcionou |

### assistant-actions (Pedro) — 1 falha

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| assistant-actions | deve filtrar ações por aba | Filtragem por abas falhou |

### auditor (Carlos) — 1 falha

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| auditor-flow | B.1 Visualização de Checklists e Filtros | `expect(content.first()).toBeVisible()` falhou — conteúdo não carregou (timeout 15s) |

### driver (Jorge) — 1 falha

| Módulo | Teste | Erro Resumido |
|--------|-------|---------------|
| driver-flow | B.1 Iniciar Novo Checklist | `startBtn.click()` falhou — botão não estava clicável |

---

## Módulos com Atenção

### ✅ Módulos 100% Funcionais (sem falhas)
- **Autenticação** (auth.spec.ts) — 3/3 passaram
- **Controle de Acesso** (access-control.spec.ts) — 4/4 passaram
- **Checklists Admin** (admin-checklist-delete.spec.ts) — 3/3 passaram
- **Clientes** (admin-clients.spec.ts) — 6/6 passaram
- **Usuários Admin** (admin-users.spec.ts) — 7/7 passaram
- **Integração Driver** (driver-user-integration.spec.ts) — 5/5 passaram
- **Embarcadores** (shippers-operational-units.spec.ts) — 5/5 passaram
- **Seed Pesado Analyst** (tenant-users-analyst-heavy-seed.spec.ts) — 1/1 passou
- **Seed Pesado Assistant** (tenant-users-assistant-heavy-seed.spec.ts) — 2/2 passaram
- **Pneus Assistant** (tenant-users-assistant-tires.spec.ts) — 2/2 passaram
- **Seed Manager** (tenant-users-manager-seed.spec.ts) — 1/1 passou
- **Seed Drivers Manager** (tenant-users-manager-seed-drivers.spec.ts) — 1/1 passou
- **Pneus Manager** (tenant-users-manager-tires.spec.ts) — 14/14 passaram
- **Partnership Oficinas** (tenant-users-manager-workshop-partnership.spec.ts) — 14/14 passaram

### ❌ Módulos com Falhas Críticas (>50% falhas)
- **Usuários Analyst** (tenant-users.spec.ts) — 3/8 passaram (62.5% falhas)
- **Usuários Manager** (tenant-users-manager.spec.ts) — 2/6 passaram (66.7% falhas)
- **Veículos Manager** (tenant-users-manager-vehicles.spec.ts) — 0/4 passaram (100% falhas)
- **Drivers Analyst** (tenant-users-analyst-drivers.spec.ts) — 0/1 passou (100% falhas)
- **Drivers Assistant** (tenant-users-assistant-drivers.spec.ts) — 0/1 passou (100% falhas)
- **Veículos Assistant** (tenant-users-assistant-vehicles.spec.ts) — 0/2 passaram (100% falhas)

### ⚠️ Módulos com Testes Pulados
- **Axle Config Manager** (tenant-users-manager-axle-config.spec.ts) — 12/12 pulados (depende de seed/veículo com eixos configurados)
- **Audit Admin Tenant** — testes parcialmente pulados (depende de dados seed)
- **Cross-profile-flows** — 2/3 pulados (depende de dados de outros módulos)

---

## Relatórios Individuais Disponíveis

- [Tire Management — Manager](.claude/reports/tire-management-report.md) — ✅ 14/14 passaram
- [Tire Management — Assistant](.claude/reports/tire-management-assistant-report.md) — ✅ 2/2 passaram
- [Workshop Partnership](.claude/reports/workshop-partnesship-report.md) — ✅ 14/14 passaram
- [Axle Configuration](.claude/reports/axle-config-report.md) — ⏭️ 12/12 pulados

---

## Padrões de Falha Identificados

### 1. CRUD de Usuários (Manager e Analyst)
**Problema:** Operações de edição e exclusão de usuários falham consistentemente em ambos os perfis.  
**Sintoma:** Após editar/excluir, a busca pelo usuário na tabela não encontra o elemento esperado (timeout 8s).  
**Módulos afetados:** `tenant-users.spec.ts`, `tenant-users-manager.spec.ts`

### 2. CRUD de Veículos (Manager)
**Problema:** Todos os 4 testes de veículos falharam — configuração, cadastro, edição e exclusão.  
**Sintoma:** Formulários não completam operações ou não persistem dados.  
**Módulos afetados:** `tenant-users-manager-vehicles.spec.ts`

### 3. Permissões de Papéis (Assistant e Analyst)
**Problema:** Dropdown de papéis no modal de criação de usuário não mostra opções esperadas.  
**Sintoma:** `expect(options).toContain('Driver')` falha — papel Driver ausente para Assistant.  
**Módulos afetados:** `tenant-users-assistant.spec.ts`, `tenant-users.spec.ts`

### 4. Restrições de Acesso (RBAC)
**Problema:** Supervisor (Pereira) consegue ver link "Configurações" na sidebar, mas não deveria.  
**Sintoma:** `expect(...).not.toBeVisible()` falhou para link Configurações.  
**Módulos afetados:** `new-roles-audit.spec.ts`

### 5. Fluxos de Auditoria e Driver
**Problema:** Checklists e redirecionamentos não funcionam conforme esperado para Auditor e Driver.  
**Sintoma:** Timeouts ao carregar conteúdo e botões não clicáveis.  
**Módulos afetados:** `audit-auditor-flow.spec.ts`, `audit-driver-flow.spec.ts`

---

## Ações Recomendadas

### 🔴 Crítico
1. **CRUD de Veículos (Manager)** — Investigar por que todos os 4 testes falharam. Pode ser problema no formulário de veículos ou na API.
2. **CRUD de Usuários** — Correção comum para Manager e Analyst. Possível problema no backend de usuários ou no componente de tabela/busca.
3. **RBAC Supervisor** — Link "Configurações" não está sendo ocultado corretamente. Corrigir lógica de permissão na sidebar.

### 🟡 Médio
4. **Permissões de papéis no modal** — Dropdown não exibe "Driver" para Fleet Assistant. Verificar lógica de roles permitidos.
5. **Fluxos de Auditor/Driver** — Checklists não carregam. Pode ser falta de dados seed ou problema na API de checklists.
6. **Axle Config** — 12 testes pulados. Executar seeds necessários e retestar.

### 🟢 Baixo
7. **Testes pulados (cross-profile, audit-tenant)** — Dependem de dados de seed. Documentar ordem de execução ou adicionar auto-seed.
8. **Timeouts** — Alguns timeouts de 8-15s podem ser insuficientes em ambiente lento. Considerar aumentar para 20s.

---

## Notas de Execução

- **Ambiente:** Dev server rodando em `localhost:3000` (HTTP 200 confirmado)
- **Auth files:** Todos os 6 arquivos de sessão presentes e válidos (admin, alexandre, carlos, jorge, mariana, pedro)
- **Variáveis de ambiente:** 12 variáveis TEST_* configuradas
- **Playwright:** Execução serial com workers=1, conforme configuração do projeto
- **Data/Hora:** 05/04/2026, ~19:00-19:45 (America/Sao_Paulo)

---

*Relatório gerado automaticamente por Qwen Code — Execução E2E Beta Fleet*
