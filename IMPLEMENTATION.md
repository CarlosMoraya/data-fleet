# IMPLEMENTATION.md

## Objetivo

Formalizar um protocolo oficial de testes de fumaça para o BetaFleet e ajustar os documentos operacionais para que agentes futuros não improvisem quais testes executar.

Este plano deve resolver a ambiguidade atual em que `prompts/Evolucao.md` e `prompts/Fixbugs.md` exigem "testes de fumaça", mas o projeto não possui um comando oficial `npm run test:smoke` nem uma definição única em `docs/MEMORY.md`.

## Classificação

Tipo 3 - alteração de processo existente.

Risco médio. A mudança não altera fluxo de produto em `src/**`, mas altera o protocolo obrigatório seguido por agentes, a documentação viva e a suíte de validação mínima. O risco principal é criar um smoke test amplo demais, lento demais ou dependente de estado frágil.

## Guardrails

- Não alterar comportamento de produto em `src/**`.
- Não criar migrações Supabase.
- Não alterar políticas RLS, Edge Functions ou seeds.
- Não renomear specs existentes em `e2e/completed/**`.
- Não transformar smoke em regressão completa.
- Não mascarar falhas de E2E completas como falhas de smoke.
- Não remover histórico de `docs/MEMORY.md` sem copiar antes para `docs/MEMORY-HISTORY.md`.
- Não commitar automaticamente. Commit/push só se o usuário pedir depois.

## Contexto Atual

- `package.json` possui `test:unit` e `test:e2e`, mas não possui `test:smoke`.
- `agent/AGENT.md` lista comandos rápidos, mas não define smoke oficial.
- `docs/MEMORY.md` registra histórico e limitações, mas não contém um protocolo operacional objetivo para smoke.
- `prompts/Evolucao.md` e `prompts/Fixbugs.md` exigem validações de fumaça, mas deixam margem para escolha manual de specs.
- A regressão recente dos seletores de Cadastros mostrou que a aplicação pode passar em localhost e falhar em deploy/sessões específicas. O smoke deve cobrir pelo menos navegação autenticada básica e a tela de Cadastros.

Baseline observado antes deste plano:

- `npm run lint` passou.
- `npm run test:unit` passou.
- `npx playwright test e2e/completed/auth-storage-state.spec.ts e2e/completed/cadastros-tab-navigation.spec.ts --project=chromium` passou.

## Produto da Implementação

Criar um protocolo oficial com estes artefatos:

- Script `npm run test:smoke`.
- Spec dedicada de smoke em `e2e/smoke/app-smoke.spec.ts`.
- Seção oficial em `docs/MEMORY.md`.
- Ajustes em `prompts/Evolucao.md` e `prompts/Fixbugs.md` para obrigar o uso do comando oficial.
- Atualização de `agent/AGENT.md` com o novo comando.
- Opcional controlado: arquivar excesso histórico de `docs/MEMORY.md` em `docs/MEMORY-HISTORY.md`, preservando conteúdo.

## Escopo do Smoke Oficial

O smoke deve responder: "a aplicação sobe, autentica, protege rotas e mantém a navegação crítica funcionando?"

Cobrir:

- Tela pública de login renderiza.
- Rota protegida redireciona usuário anônimo para login.
- Sessão autenticada chega ao dashboard ou rota inicial protegida.
- Shell de Cadastros renderiza.
- Abas críticas de Cadastros mudam rota e conteúdo.
- Usuário Coordinator consegue navegar nas abas de Cadastros, cobrindo a regressão recente.

Não cobrir:

- CRUD completo.
- OCR.
- Upload/importação.
- Fluxos destrutivos.
- Todos os papéis do sistema.
- Todos os módulos do menu.
- Specs em `e2e/pending/**`.
- Matriz completa de permissões.

Meta de tempo local: até 90 segundos.

## Pré-condições

Para executar `npm run test:smoke`, o ambiente local deve ter:

- Dependências instaladas.
- `.env.local` válido.
- `VITE_SUPABASE_URL`.
- `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- Dados demo mínimos já existentes para `admin@demo.betafleet.local` e `coordinator@demo.betafleet.local`.

O Playwright deve usar o `webServer` já existente para subir ou reutilizar `http://localhost:3000`. Não exigir sessão manual logada para o smoke automatizado.

## Arquivos a Modificar

Criar:

- `e2e/smoke/app-smoke.spec.ts`

Modificar:

- `package.json`
- `docs/MEMORY.md`
- `prompts/Evolucao.md`
- `prompts/Fixbugs.md`
- `agent/AGENT.md`

Modificar somente se necessário para reduzir tamanho e preservar histórico:

- `docs/MEMORY-HISTORY.md`

Não modificar:

- `src/**`
- `supabase/**`
- `playwright.config.ts`, salvo se a spec dedicada não puder usar a configuração atual por limitação concreta.

## Padrões a Reutilizar

Reaproveitar padrões já existentes em:

- `e2e/completed/auth.spec.ts`
- `e2e/completed/access-control.spec.ts`
- `e2e/completed/auth-storage-state.spec.ts`
- `e2e/completed/cadastros-tab-navigation.spec.ts`

Não importar testes existentes diretamente. Criar uma spec curta e explícita para o smoke oficial, evitando que mudanças futuras em specs completas alterem o escopo do smoke sem intenção.

## Plano de Implementação

### 1. Criar spec oficial de smoke

Criar `e2e/smoke/app-smoke.spec.ts`.

Estrutura sugerida:

- Helper `createSessionStorageValue(email: string): Promise<string>`.
- Helper `installSupabaseSession(page: Page, storageValue: string): Promise<void>`.
- Helper `expectProtectedRoute(page: Page, path: string, expectedHeading: string | RegExp): Promise<void>`.
- Teste `login screen renders`.
- Teste `protected route redirects anonymous user`.
- Teste `authenticated admin reaches protected shell`.
- Teste `cadastros tabs navigate for authenticated admin`.
- Teste `coordinator cadastros tabs stay responsive`.

Detalhes importantes:

- Para Coordinator, usar geração de magic link via Supabase Admin, seguindo o padrão já validado em `cadastros-tab-navigation.spec.ts`.
- Evitar dependência em arquivos `.auth/*.json` pré-existentes para Coordinator.
- Usar seletores acessíveis quando existirem: links por texto, headings e URLs.
- Validar URL e conteúdo após clique de aba.
- Incluir uma pequena espera controlada antes de repetir cliques nas abas de Cadastros para capturar regressões que aparecem segundos depois do refresh.
- Não usar sleeps longos. Preferir `expect(...).toHaveURL(...)` e `expect(...).toBeVisible(...)`.

### 2. Adicionar script oficial

Editar `package.json`:

```json
"test:smoke": "playwright test e2e/smoke/app-smoke.spec.ts --project=chromium"
```

Não alterar `test:e2e`.

### 3. Atualizar documentação viva

Editar `docs/MEMORY.md` e adicionar uma seção curta chamada `Protocolo oficial de smoke`.

Conteúdo obrigatório:

- Comando oficial: `npm run test:smoke`.
- Objetivo do smoke.
- Pré-condições ambientais.
- Escopo incluído.
- Escopo excluído.
- Conduta em falha: parar, registrar teste falho e corrigir antes de prosseguir.
- Observação: `npm run test:e2e` continua sendo regressão completa, não substitui smoke.

Se `docs/MEMORY.md` continuar longo demais, mover entradas históricas detalhadas para `docs/MEMORY-HISTORY.md` e deixar no MEMORY apenas:

- Estado atual.
- Decisões vigentes.
- Smoke oficial.
- Últimas limitações relevantes.
- Link textual para o histórico.

### 4. Atualizar prompts operacionais

Editar `prompts/Evolucao.md`.

Alterações obrigatórias:

- Onde o prompt exigir "testes de fumaça", substituir ou complementar com `npm run test:smoke`.
- Instruir que o agente não deve escolher specs manualmente quando `test:smoke` existir.
- Se `test:smoke` não existir em projeto futuro, o agente deve propor criação do protocolo antes de tratar smoke como requisito atendido.
- Em falha de smoke, o agente deve parar e reportar teste, erro e evidência.

Editar `prompts/Fixbugs.md`.

Alterações obrigatórias:

- Manter os quatro pré-requisitos de bugfix, mas trocar a ambiguidade de smoke por comando oficial.
- Definir que bugfix deve executar `npm run test:smoke` antes da reprodução quando o projeto estiver localmente operacional.
- Definir que `npm run test:e2e` não é substituto automático para smoke.
- Definir que falha no smoke bloqueia a correção salvo autorização explícita do usuário para corrigir primeiro o ambiente/smoke.

### 5. Atualizar guia do agente

Editar `agent/AGENT.md`.

Adicionar em comandos rápidos:

```bash
npm run test:smoke
```

Descrição curta: valida o contrato mínimo de aplicação viva, autenticação, rotas protegidas e navegação crítica de Cadastros.

### 6. Validar

Executar:

```bash
npm run lint
npm run test:unit
npm run test:smoke
npm run build
```

Critério:

- Todos devem passar.
- Se `npm run test:smoke` falhar por dado demo ausente, não adaptar o teste para ignorar a falha. Reportar a dependência ausente e corrigir seed/ambiente somente com autorização explícita.
- Não exigir `npm run test:e2e` como gate desta mudança. A regressão completa pode ter falhas conhecidas e não deve ser confundida com smoke.

## Tratamento de Erros

Se `SUPABASE_SERVICE_ROLE_KEY` estiver ausente:

- O smoke deve falhar com mensagem clara.
- Não deve cair em erro genérico de timeout.

Se o usuário demo Coordinator não existir:

- O smoke deve falhar indicando o e-mail esperado.
- Não criar usuário automaticamente dentro do smoke.

Se uma aba de Cadastros recebe foco visual, mas não muda rota/conteúdo:

- Falha válida.
- Manter asserções de URL e heading/conteúdo para capturar exatamente esse tipo de regressão.

Se localhost já estiver ocupado:

- Deixar Playwright seguir a configuração atual de `reuseExistingServer`.
- Não matar processos automaticamente.

## Critérios de Aceite

- `package.json` contém `test:smoke`.
- `npm run test:smoke` executa uma spec dedicada em `e2e/smoke/app-smoke.spec.ts`.
- `docs/MEMORY.md` define o smoke oficial e não depende de interpretação.
- `prompts/Evolucao.md` manda usar `npm run test:smoke`.
- `prompts/Fixbugs.md` manda usar `npm run test:smoke`.
- `agent/AGENT.md` lista o comando.
- `npm run lint` passa.
- `npm run test:unit` passa.
- `npm run test:smoke` passa.
- `npm run build` passa.

## Decisões Técnicas

- Smoke oficial será uma spec dedicada, não uma lista solta de specs existentes.
- Smoke não substitui regressão completa.
- Regressão completa não substitui smoke.
- A tela de Cadastros entra no smoke porque já houve regressão real de navegação travada após alguns segundos.
- Coordinator entra no smoke porque o problema observado era dependente de usuário/perfil.
- O smoke não deve criar massa automaticamente. Ele valida que o ambiente demo mínimo está saudável.

## Pós-Implementação

Ao concluir:

- Registrar em `docs/MEMORY.md` a data e o resultado dos comandos.
- Não commitar sem pedido explícito.
- Informar ao usuário se houve falha por ambiente, dado demo ou bug real.
- Se tudo passar, sugerir commit separado apenas para protocolo de smoke e prompts.

## Sugestão Melhor que Mandar Outro Agente Executar

Pode mandar outro agente executar este plano. A alternativa mais segura é pedir para o próximo agente executar primeiro só as etapas 1 a 5 e parar antes de qualquer ajuste de ambiente/dados. Depois ele roda a validação e reporta falhas sem tentar "consertar" dados demo automaticamente.

Isso evita que o agente transforme um problema de contrato de smoke em mudanças silenciosas de seed, auth ou permissões.
