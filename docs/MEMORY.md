# MEMORY - Estado Atual do Projeto

Este arquivo registra o progresso atual, pendências e a visão de curto prazo para o desenvolvimento.

## 🟢 Estado Atual (Checklist de Progresso)

- [x] **Núcleo de Cadastros**: Veículos, Motoristas, Embarcadores e Unidades Operacionais estabilizados.
- [x] **Gestão de Manutenção**: Workflow de OS, cancelamento e orçamentos (OCR) funcional.
- [x] **Checklists**: Infraestrutura offline-first e versionamento de templates concluídos.
- [x] **Pneus**: Módulo completo com configuração de eixos e histórico de movimentação.
- [x] **Oficinas**: Novo modelo de parcerias multi-tenant e gestão de convites ativa.
- [x] **Performance**: Build otimizado (~8s) e cache de queries (React Query) configurado.

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
