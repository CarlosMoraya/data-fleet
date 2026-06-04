# IMPLEMENTATION_FIXBUG.md
Gerado em: 2026-06-03 20:13:08 -03
Sessao: correcao de bug — abas de Cadastros travam para usuario especifico em producao
Tipo de bug: Tipo D — Bug de regressao/intermitente condicionado a sessao de usuario
Causa raiz confirmada: nao — o bug nao reproduziu em localhost nem com outro usuario no deploy; a causa provavel depende de estado de sessao/cache do usuario Beatriz Lima ou de evento de autenticacao em producao
Baseado em: docs/MEMORY.md atualizado em 03/06/2026

## GUARDRAIL — leia antes de qualquer acao

Este documento e a especificacao fechada desta correcao. O agente de codigo que executar este plano:

- NAO modifica arquivos alem dos listados aqui
- NAO refatora codigo nao relacionado ao bug
- NAO altera regras de permissao, ranks de roles ou RLS
- NAO instala dependencias novas
- NAO altera testes para faze-los passar — corrige o codigo quando a causa for confirmada
- SE a reproducao com Beatriz Lima nao confirmar o bug: para, informa o usuario e nao altera codigo de produto
- SE encontrar causa diferente das hipoteses abaixo: para, informa o usuario e aguarda instrucao

## Contexto necessario

Antes de implementar, leia:

- agent/AGENT.md — regras universais do projeto
- agent/AGENT-FRONTEND.md — padroes de React, rotas e interface
- agent/AGENT-INFRA.md — diferencas entre desenvolvimento e deploy
- docs/MEMORY.md — baseline recente e falhas conhecidas
- docs/DESIGN.md — comportamento visual esperado das abas
- docs/SPEC.md — arquitetura SPA com React Router e Supabase
- src/App.tsx — declaracao das rotas aninhadas de `/cadastros`
- src/pages/Cadastros.tsx — renderizacao das abas com `NavLink`
- src/context/AuthContext.tsx — estado de sessao, usuario e cliente ativo
- src/components/Layout.tsx — guards de rota autenticada
- src/lib/rolePermissions.ts — regras de acesso por role

## O bug

**Comportamento atual:** no deploy (`https://app.betafleet.com.br`), para a usuaria Beatriz Lima (`Coordinator`), as abas de `Cadastros` param de responder poucos segundos apos refresh. O clique muda a URL ou aplica foco/borda na aba clicada, mas a tela continua renderizando o conteudo anterior, como `Usuarios`.

**Comportamento esperado:** ao clicar em `Veiculos`, `Motoristas`, `Oficinas`, `Embarcadores`, `Unid. Operacionais`, `Usuarios` ou `Pneus`, a URL, a aba ativa e o conteudo renderizado devem mudar juntos.

**Condicoes de reproducao conhecidas:**

1. Login no deploy com Beatriz Lima (`Coordinator`).
2. Acessar `/cadastros/usuarios` ou outra rota de cadastro.
3. Dar refresh; as abas funcionam por alguns segundos.
4. Depois clicar em outra aba, por exemplo `Unid. Operacionais`.
5. A URL muda, mas a aba ativa/conteudo permanecem na tela anterior.

**Condicao negativa ja observada:** com Marcos Teixeira (`Manager`), no mesmo tenant BetaFleet, as abas funcionaram corretamente no deploy.

**Impacto:** usuarios afetados ficam presos em uma subpagina de cadastro e precisam dar refresh ou trocar de sessao para continuar. Severidade media-alta por afetar operacao em producao, mas escopo ainda parece condicionado a sessao/usuario.

## Analise dos prints

Estou vendo a tela de `Cadastros` com sidebar, topbar, abas horizontais e uma tabela renderizada. Nos prints do problema, a URL aponta para uma rota clicada, mas a tela continua mostrando `Usuarios`; em um print, `Unid. Operacionais` recebe borda de foco enquanto `Usuarios` permanece ativo. No print novo, com Marcos Teixeira (`Manager`), a URL `/cadastros/motoristas`, a aba `Motoristas` e o conteudo `Motoristas` estao sincronizados.

O comportamento esperado segundo `Cadastros.tsx` e `App.tsx` e que `NavLink` atualize a rota do React Router e o `<Outlet />` renderize o componente filho correspondente. A divergencia e que, para Beatriz, o browser aparenta receber o clique, mas a arvore React nao acompanha a rota de forma consistente.

Hipoteses em ordem de probabilidade:

1. Estado de autenticacao/localStorage compartilhado ou obsoleto no navegador da Beatriz causa divergencia entre sessao Supabase, usuario exibido e estado interno do React Router.
2. Evento de autenticacao Supabase (`SIGNED_IN`, `TOKEN_REFRESHED` ou sessao entre abas) reprocessa `AuthContext` alguns segundos apos refresh e deixa `currentClient`/`user` em estado inconsistente para aquele perfil.
3. Bundle/cache de producao carregado no navegador da Beatriz esta obsoleto, embora nao haja service worker no codigo.
4. Bug real em `Cadastros.tsx`/React Router, mas condicionado a timing de producao; esta hipotese e menos provavel porque localhost e Marcos no deploy funcionaram.

## Causa raiz identificada

Causa raiz ainda nao confirmada. O diagnostico atual aponta para estado de sessao/cache do usuario Beatriz Lima em producao, nao para permissao de banco:

- Beatriz Lima: `role = Coordinator`, `client_id = BetaFleet`
- Marcos Teixeira: `role = Manager`, `client_id = BetaFleet`
- Ambos pertencem ao mesmo cliente, e os roles estao autorizados em `Cadastros.tsx`
- `npm run build`, `npm run lint` e `npm run test:unit` passam localmente
- Navegacao local com Playwright usando estado autenticado atualizou corretamente URL e conteudo entre `Usuarios`, `Unidades Operacionais` e `Veiculos`

Antes de qualquer alteracao de codigo, a reproducao deve capturar:

- console errors no navegador no momento em que a aba trava
- valor de `window.location.pathname`
- textos dos `h1` dentro de `main`
- role/nome/cliente ativo expostos pela UI
- se existe mais de uma aba do app aberta com usuarios diferentes

## Estado dos testes antes da correcao — baseline

- Testes de fumaca: nao existe checklist formal em `docs/MEMORY.md`; foi usado o E2E mais proximo (`e2e/completed/new-roles-audit.spec.ts`) e ele falhou antes do fluxo de abas por login dos usuarios de auditoria.
- Smoke direcionado de abas em localhost: passou via Playwright manual. Resultado: `/cadastros/usuarios` renderizou `Usuarios`; clique em `Unid. Operacionais` renderizou `Unidades Operacionais`; clique em `Veiculos` renderizou `Veiculos`.
- Suite completa E2E: iniciada com `npm run test:e2e`; baseline parcial mostrou falhas pre-existentes em `e2e/completed/new-roles-audit.spec.ts`, `e2e/pending/audit-admin-master.spec.ts` e `e2e/pending/cross-profile-flows.spec.ts`. Essas falhas nao apontam para o bug das abas.
- Suite unitária: `npm run test:unit` passou com 14 arquivos e 130 testes.
- Typecheck/lint: `npm run lint` passou; neste projeto o script de lint e `tsc --noEmit`.
- Build: `npm run build` passou; houve apenas warning de chunk grande.

## Dependencias mapeadas

`src/pages/Cadastros.tsx` e usado somente pela rota pai `/cadastros` em `src/App.tsx`. Ele controla apenas a tab bar e o `<Outlet />` das paginas de cadastro. Alterar esse arquivo pode afetar todas as abas de cadastro.

`src/App.tsx` declara todas as sub-rotas de cadastro. Alterar esse arquivo pode afetar toda a navegacao protegida do sistema. Nao tocar neste arquivo a menos que a reproducao prove que a arvore de rotas esta incorreta.

`src/context/AuthContext.tsx` e compartilhado por toda a aplicacao. Alterar esse arquivo e risco medio porque afeta login, logout, cliente ativo, usuarios Workshop, Admin Master, Manager e Coordinator. Qualquer mudanca aqui deve ser minima e verificada com testes de autenticacao e navegacao.

`src/components/Layout.tsx` aplica guard de usuario autenticado e restricao para `Operations Manager`. Nao ha evidencia de que Beatriz esteja sendo tratada como `Operations Manager`; nao tocar neste arquivo sem prova.

## O que NAO fazer — restricoes absolutas

- Nao alterar `ROLE_RANK`, `ROLES_WITH_ACCESS` ou `canAccessRoute` sem prova de falha de permissao.
- Nao alterar RLS ou dados no Supabase para Beatriz ou Marcos.
- Nao trocar `BrowserRouter` por outro roteador sem reproducao confirmada em ambiente controlado.
- Nao adicionar reload forcado ao clicar nas abas; isso mascara o bug e degrada a SPA.
- Nao limpar cache/localStorage automaticamente para todos os usuarios sem criterio; isso pode encerrar sessoes validas.
- Nao mexer nas paginas filhas (`Vehicles.tsx`, `Drivers.tsx`, `Users.tsx`, etc.) ate confirmar que alguma delas dispara erro no momento da navegacao.

## Correcao

### Passo 1 — Reproduzir o bug com Beatriz em contexto limpo

**Arquivo:** nenhum arquivo de produto.

**Causa que justifica este passo:** a causa raiz ainda nao esta confirmada e o bug nao reproduz para Manager nem em localhost.

**O que fazer:**

1. Abrir uma janela anonima ou contexto Playwright limpo.
2. Logar como Beatriz Lima no deploy.
3. Acessar `/cadastros/usuarios`.
4. Esperar 10 segundos.
5. Clicar em `Motoristas`, `Unid. Operacionais` e `Veiculos`.
6. Registrar console errors e comparar URL, aba ativa e `main h1`.
7. Repetir no mesmo navegador apos limpar `localStorage`, `sessionStorage` e cookies do dominio `app.betafleet.com.br`.

**O que NAO mudar neste passo:** nao editar codigo, nao alterar dados e nao aplicar workaround no navegador alem de limpeza controlada para teste.

**Impacto em dependencias:** nenhum, e uma verificacao.

**Como verificar este passo:**

```bash
npm run build
npm run lint
npm run test:unit
```

Resultado esperado: comandos continuam passando. A reproducao deve confirmar se o bug depende de estado local/sessao ou se ocorre em contexto limpo.

### Passo 2 — Adicionar teste de regressao para abas de Cadastros

**Arquivo:** `e2e/completed/cadastros-tab-navigation.spec.ts`

**Causa que justifica tocar neste arquivo:** hoje nao existe teste especifico cobrindo clique real nas abas de `Cadastros` validando que URL, aba ativa e conteudo sincronizam apos a sessao estar carregada.

**O que mudar:**

Criar um teste E2E pequeno que:

1. Use `storageState` autenticado existente de perfil com acesso a cadastros.
2. Acesse `/cadastros/usuarios`.
3. Aguarde o `h1` `Usuarios`.
4. Clique em `Unid. Operacionais` e espere URL `/cadastros/unidades-operacionais` e `h1` `Unidades Operacionais`.
5. Clique em `Motoristas` e espere URL `/cadastros/motoristas` e `h1` `Motoristas`.
6. Clique em `Veiculos` e espere URL `/cadastros/veiculos` e `h1` `Veiculos`.

**O que NAO mudar neste arquivo:** nao testar CRUD, nao criar dados, nao depender de texto de tabelas ou registros.

**Impacto em dependencias:** baixo; teste novo apenas protege o roteamento das abas.

**Como verificar este passo:**

```bash
npx playwright test e2e/completed/cadastros-tab-navigation.spec.ts --project=chromium
```

Resultado esperado: teste passa em localhost antes e depois da correcao. Se falhar em localhost, investigar `Cadastros.tsx` antes de qualquer outro arquivo.

### Passo 3 — Corrigir somente se a reproducao confirmar drift de sessao

**Arquivo:** `src/context/AuthContext.tsx`

**Causa que justifica tocar neste arquivo:** se o bug aparecer apenas alguns segundos apos refresh, com console sem erro de pagina filha, a causa mais provavel e atualizacao assincrona da sessao/usuario/cliente ativo interferindo no estado da SPA.

**O que mudar:**

Aplicar uma mudanca minima para tornar a transicao de sessao deterministica:

1. Extrair uma funcao local pequena para limpar estado de tenant antes de carregar um novo perfil: `setCurrentClient(null)`, `setAllClients([])`, `setWorkshopAccount(null)`, `setWorkshopPartnerships([])`, `setActiveWorkshopId(null)`.
2. No handler de `SIGNED_IN`, antes de `fetchProfile`, chamar essa limpeza.
3. Tratar `USER_UPDATED` e `TOKEN_REFRESHED` sem limpar navegacao e sem chamar logout; se houver `session.user`, atualizar o perfil de forma segura, preservando a rota atual.
4. Manter `SIGNED_OUT` com a limpeza atual.
5. Nao chamar `navigate`, `window.location`, `history` ou reload neste arquivo.

**O que NAO mudar neste arquivo:** nao mudar contratos do contexto, nao alterar tipos publicos, nao mudar logica de Workshop partnerships, nao mudar persistencia `adminMasterActiveClient` exceto se a reproducao mostrar chave corrompida.

**Impacto em dependencias:** medio. `AuthContext` afeta todo o app. A mudanca deve ser restrita aos eventos de autenticacao para evitar estado parcial quando uma sessao muda ou e atualizada.

**Como verificar este passo:**

```bash
npm run lint
npm run test:unit
npx playwright test e2e/completed/auth-storage-state.spec.ts --project=chromium
npx playwright test e2e/completed/cadastros-tab-navigation.spec.ts --project=chromium
```

Resultado esperado: typecheck/unit passam; auth storage state continua autenticado; abas de cadastros continuam sincronizadas.

### Passo 4 — Corrigir somente se a reproducao confirmar divergencia entre URL e React Router

**Arquivo:** `src/pages/Cadastros.tsx`

**Causa que justifica tocar neste arquivo:** se a URL mudar mas `NavLink` e `<Outlet />` continuarem lendo uma localizacao antiga sem evento de sessao, o problema esta no componente pai de cadastros.

**O que mudar:**

Aplicar uma correcao minima e observavel:

1. Importar `useLocation` de `react-router-dom`.
2. Ler `const location = useLocation();`.
3. Adicionar `key={location.pathname}` somente no wrapper direto do `<Outlet />`, preservando a tab bar.
4. Nao alterar os `to` das abas e nao transformar `NavLink` em botoes.

**O que NAO mudar neste arquivo:** nao alterar roles, estilos, ordem das abas, nomes visiveis ou rotas.

**Impacto em dependencias:** baixo a medio. Forcar remount apenas do conteudo filho em mudanca de pathname pode resetar estado local das paginas filhas ao trocar abas, que ja e comportamento aceitavel para navegacao entre paginas distintas.

**Como verificar este passo:**

```bash
npm run lint
npm run test:unit
npx playwright test e2e/completed/cadastros-tab-navigation.spec.ts --project=chromium
```

Resultado esperado: URL, aba ativa e `h1` sempre sincronizam apos cada clique.

## Testes novos a escrever

- `e2e/completed/cadastros-tab-navigation.spec.ts`: valida regressao principal de navegacao entre abas de cadastros.
- Cenario 1: iniciar em `/cadastros/usuarios` e clicar em `Unid. Operacionais`.
- Cenario 2: clicar em `Motoristas`.
- Cenario 3: clicar em `Veiculos`.
- Cada cenario deve validar URL e `main h1`, nao dados da tabela.

## Verificacao final

Depois dos passos confirmados:

1. Rode o teste especifico do bug:

```bash
npx playwright test e2e/completed/cadastros-tab-navigation.spec.ts --project=chromium
```

Resultado esperado: todas as navegacoes entre abas atualizam URL e titulo da pagina.

2. Rode a suite unitária e typecheck:

```bash
npm run lint
npm run test:unit
```

Resultado esperado: `npm run lint` sem erros e pelo menos 130 testes unitarios passando.

3. Rode smoke E2E de autenticacao/cadastros que estiver estavel:

```bash
npx playwright test e2e/completed/auth-storage-state.spec.ts --project=chromium
npx playwright test e2e/completed/cadastros-tab-navigation.spec.ts --project=chromium
```

Resultado esperado: ambos passam.

4. Validacao manual no deploy:

```text
Login como Beatriz Lima -> /cadastros/usuarios -> aguardar 10 segundos -> clicar Motoristas, Unid. Operacionais, Veiculos.
```

Resultado esperado: a URL, a aba ativa e o conteudo mudam juntos em todos os cliques.

Se qualquer verificacao falhar: pare, informe o usuario com o resultado exato e aguarde instrucao. Nao tente corrigir uma causa diferente sem atualizar este plano.

## Observacoes para sessoes futuras

Identifiquei que a suite E2E completa mistura testes `completed` e `pending`, e falhas em specs pendentes dificultam usar `npm run test:e2e` como sinal limpo de regressao. Isso nao e o bug atual, mas deve ser tratado em uma sessao futura de estabilizacao de testes.

Identifiquei que `docs/MEMORY.md` nao contem uma lista executavel de testes de fumaca, embora o prompt exija "testes de fumaca do docs/MEMORY.md". Isso deve ser normalizado em uma sessao futura.

## Registro para o docs/MEMORY.md

Após a correção confirmada, adicione ao docs/MEMORY.md:

```text
Bug corrigido: abas de Cadastros travavam para usuario especifico em producao.
Causa raiz: [preencher com causa confirmada: drift de sessao Supabase, cache local ou divergencia React Router].
Correcao aplicada: [preencher com a mudanca exata aplicada].
Arquivos modificados: [lista final].
Testes adicionados: e2e/completed/cadastros-tab-navigation.spec.ts
```

## Sugestao de commit

Quando todos os criterios de conclusao estiverem atendidos e o bug estiver confirmado como corrigido:

```bash
git add src/context/AuthContext.tsx src/pages/Cadastros.tsx e2e/completed/cadastros-tab-navigation.spec.ts docs/MEMORY.md
git commit -m "fix: estabiliza navegacao das abas de cadastros"
```

Adicione apenas os arquivos realmente modificados. Se `AuthContext.tsx` ou `Cadastros.tsx` nao forem tocados, nao inclua no `git add`.
