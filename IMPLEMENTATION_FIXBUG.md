# IMPLEMENTATION_FIXBUG.md
Gerado em: 2026-06-01 15:55 America/Sao_Paulo
Sessao: correcao de bug - Admin Master nao ve manutencoes em "Todos os Clientes"
Tipo de bug: Tipo A - Bug isolado
Causa raiz confirmada: sim
Baseado em: docs/MEMORY.md (estado atual lido em 2026-06-01)

## GUARDRAIL - leia antes de qualquer acao

Este documento e a especificacao completa e fechada desta correcao. O agente de codigo que executar este plano:

- NAO modifica arquivos alem dos listados aqui
- NAO refatora codigo nao relacionado ao bug
- NAO "melhora" codigo que nao esta causando o problema
- NAO instala dependencias novas
- NAO altera testes para faze-los passar - corrige o codigo
- SE encontrar algo que parece errado mas nao esta neste documento: registra como observacao no MEMORY.md e continua sem corrigir
- SE encontrar ambiguidade em qualquer passo: para, informa o usuario e aguarda instrucao

## Contexto necessario

Antes de implementar, leia:

- `agent/AGENT.md` - regras universais do projeto
- `agent/AGENT-FRONTEND.md` - padroes React e React Query
- `agent/AGENT-DATABASE.md` - regra critica de Admin Master com `client_id = NULL`
- `docs/MEMORY.md` - baseline recente do projeto
- `docs/SPEC.md` - arquitetura Supabase/RLS

## O bug

**Comportamento atual:** na tela `/manutencao`, o Admin Master ve dados quando seleciona um cliente especifico, mas ve lista vazia quando seleciona "Todos os Clientes".

**Comportamento esperado:** quando o Admin Master seleciona "Todos os Clientes", a tela deve buscar e exibir todas as ordens de manutencao permitidas pela RLS, sem aplicar filtro de `client_id` no frontend.

**Condicoes de reproducao:**

1. Entrar como usuario `Admin Master`.
2. Abrir `/manutencao`.
3. No seletor do topo, escolher um cliente especifico, por exemplo `BetaFleet`.
4. Confirmar que existem OS na tabela.
5. Alterar o seletor para `Todos os Clientes`.
6. Observar que os cards ficam zerados e a tabela mostra "Nenhuma ordem de servico encontrada".

**Impacto:** o Admin Master perde a visao consolidada de manutencoes cross-tenant nessa tela. A selecao por cliente continua funcionando.

## Causa raiz identificada

A causa esta em `src/pages/Maintenance.tsx`, linhas 134-171.

O `Topbar` representa a opcao "Todos os Clientes" com `value=""`, chamando `switchClient('')`. Em `src/context/AuthContext.tsx`, linhas 251-257, isso define `currentClient` como `null`, que e o comportamento correto para uma visao global.

Na query de manutencao, o filtro tambem esta correto: em `src/pages/Maintenance.tsx`, linhas 161-163, o frontend so aplica `.eq('client_id', currentClient.id)` quando existe cliente selecionado. Portanto, para Admin Master em "Todos os Clientes", a query deveria rodar sem filtro de cliente.

O problema esta na opcao `enabled` do `useQuery`, linha 171:

```ts
: !!currentClient?.id,
```

Para usuarios que nao sao oficina, essa condicao exige sempre um `currentClient.id`. Como Admin Master em "Todos os Clientes" tem `currentClient = null`, o React Query nao executa a consulta. O resultado padrao fica `orders = []`, zerando cards e tabela.

## Estado dos testes antes da correcao - baseline

- Testes de fumaca: nao existe lista formal de testes de fumaca no `docs/MEMORY.md`. A disponibilidade HTTP foi validada em `http://localhost:3001/` com `HTTP/1.1 200 OK` apos iniciar o Vite, porque a porta 3000 estava ocupada.
- Suite unitária: `npm run test:unit` passou com 11 arquivos e 111 testes.
- Typecheck/lint: `npm run lint` passou sem erros. Neste projeto, lint e `tsc --noEmit` sao o mesmo script.
- Build: `npm run build` passou. Aviso existente: alguns chunks maiores que 500 kB.
- Suite E2E: `npm run test:e2e` falhou no baseline com 33 passed, 24 failed, 10 skipped, 207 did not run. As falhas principais sao de autenticacao/setup e dados de ambiente, nao deste bug:
  - setups de Jorge, Carlos, Alexandre, Pedro e Mariana permanecem em `/login`;
  - `driver-checklist-visibility` falha por `vehicles.renavam` not-null;
  - varios testes dependentes de storage state ou sessao falham por redirecionamento para `/login`;
  - `audit-admin-master` B.3 falha por modal de veiculo nao fechar.
- Testes falhando relacionados ao bug: nenhum teste automatizado existente cobre explicitamente Admin Master em `/manutencao` com `Todos os Clientes`.
- Testes falhando nao relacionados ao bug: os 24 E2E acima devem permanecer como baseline e nao sao escopo desta correcao.

## Dependencias mapeadas

Arquivo a modificar:

- `src/pages/Maintenance.tsx`

Dependencias e usos relevantes:

- Usa `useAuth()` para ler `currentClient`, `user`, `activeWorkshopId` e `workshopPartnerships`.
- Usa React Query com chave `['maintenanceOrders', currentClient?.id, activeWorkshopId]`.
- Usa Supabase diretamente para consultar `maintenance_orders`.
- Usa `MaintenanceForm`, `MaintenanceDetailModal`, `maintenanceFromRow`, `saveMaintenanceOrder`, `updateMaintenanceStatus` e `cancelMaintenanceOrder`.
- Invalida queries de manutencao apos salvar, cancelar e concluir.

A correcao afeta apenas quando `profile.role === 'Admin Master'`, `isWorkshopUser === false` e `currentClient` esta vazio. Nao altera:

- filtro por cliente quando um cliente especifico esta selecionado;
- regra de oficina mono ou multi-transportadora;
- RLS do Supabase;
- criacao, edicao, cancelamento ou conclusao de OS;
- mappers de manutencao;
- `Topbar` e `AuthContext`.

## O que NAO fazer - restricoes absolutas

- Nao modificar `src/context/AuthContext.tsx`: ele ja representa "Todos os Clientes" corretamente como `currentClient = null`.
- Nao modificar `src/components/Topbar.tsx`: o `<option value="">Todos os Clientes</option>` esta correto.
- Nao modificar policies RLS ou migrations: a falha confirmada e a query desabilitada no frontend, nao permissao de banco.
- Nao modificar `src/services/maintenanceService.ts`: salvar nova OS ainda exige `currentClientId`; criacao em modo global nao e o bug relatado.
- Nao refatorar a query de manutencao para outro arquivo nesta correcao.
- Nao alterar testes E2E falhando para faze-los passar.

## Correcao

### Passo 1 - Permitir query global para Admin Master

**Arquivo:** `src/pages/Maintenance.tsx`

**Causa que justifica tocar neste arquivo:** o bloqueio esta na condicao `enabled` do `useQuery` da propria tela de manutencao.

**O que mudar:**

1. Dentro do componente `Maintenance`, logo apos:

```ts
const isWorkshopUser = profile?.role === 'Workshop';
```

adicione:

```ts
const isAdminMaster = profile?.role === 'Admin Master';
```

2. No `useQuery` de manutencoes, trocar somente o ramo de `enabled` para usuarios que nao sao oficina:

De:

```ts
enabled: isWorkshopUser
  ? (isMultiWorkshop || !!(activeWorkshopId ?? profile?.workshopId))
  : !!currentClient?.id,
```

Para:

```ts
enabled: isWorkshopUser
  ? (isMultiWorkshop || !!(activeWorkshopId ?? profile?.workshopId))
  : isAdminMaster || !!currentClient?.id,
```

3. Ajustar a `queryKey` para diferenciar explicitamente a visao global do Admin Master da visao sem cliente de outros perfis:

De:

```ts
queryKey: ['maintenanceOrders', currentClient?.id, activeWorkshopId],
```

Para:

```ts
queryKey: ['maintenanceOrders', currentClient?.id ?? 'all-clients', activeWorkshopId, profile?.role],
```

**O que NAO mudar neste arquivo:**

- Nao mudar a construcao do filtro `.eq('client_id', currentClient.id)` nas linhas 161-163.
- Nao mudar a logica de oficina nas linhas 149-160.
- Nao mudar os mutations de salvar, cancelar ou concluir.
- Nao mudar textos, layout, cards, tabs ou busca.

**Impacto em dependencias:** a query sem filtro so passa a executar para Admin Master. Para perfis tenant comuns, se `currentClient` estiver ausente, a query continua desabilitada. Para oficina, a condicao existente permanece igual.

**Como verificar este passo:**

```bash
npm run lint
npm run test:unit
npm run build
```

Resultado esperado: todos continuam passando como no baseline.

## Testes novos a escrever

Criar pelo menos um teste de regressao que proteja a regra de habilitacao da consulta.

### Teste unitario recomendado

**Arquivo:** `tests/unit/maintenance-query-scope.test.ts`

**Ajuste minimo necessario para viabilizar o teste:** extrair de `Maintenance.tsx` uma funcao pura exportada, sem alterar comportamento:

```ts
export function shouldEnableMaintenanceOrdersQuery(params: {
  isWorkshopUser: boolean;
  isMultiWorkshop: boolean;
  activeWorkshopId?: string | null;
  workshopId?: string | null;
  currentClientId?: string | null;
  role?: string | null;
}) {
  return params.isWorkshopUser
    ? (params.isMultiWorkshop || !!(params.activeWorkshopId ?? params.workshopId))
    : params.role === 'Admin Master' || !!params.currentClientId;
}
```

Usar essa funcao no `enabled` do `useQuery`.

**Cenarios obrigatorios:**

- Admin Master com `currentClientId = null` retorna `true`.
- Admin Master com `currentClientId` preenchido retorna `true`.
- usuario comum nao-oficina com `currentClientId = null` retorna `false`.
- usuario comum nao-oficina com `currentClientId` preenchido retorna `true`.
- oficina multi-transportadora retorna `true` mesmo sem cliente selecionado.
- oficina mono com `activeWorkshopId` retorna `true`.
- oficina mono sem `activeWorkshopId` e sem `workshopId` retorna `false`.

**Comando:**

```bash
npm run test:unit -- tests/unit/maintenance-query-scope.test.ts
```

Resultado esperado: todos os cenarios passam.

### Validacao manual guiada

Como este bug depende de sessao autenticada e dados reais:

1. Abrir `/manutencao` como Admin Master.
2. Selecionar `BetaFleet` no topo.
3. Confirmar que aparecem 2 OS, conforme print de referencia.
4. Selecionar `Todos os Clientes`.
5. Confirmar que as OS continuam aparecendo na lista consolidada e que os cards nao ficam zerados indevidamente.
6. Selecionar novamente `BetaFleet`.
7. Confirmar que a lista volta a filtrar apenas aquele cliente.

## Verificacao final

Depois da correcao:

1. Rode o teste especifico do bug:

```bash
npm run test:unit -- tests/unit/maintenance-query-scope.test.ts
```

Resultado esperado: todos os cenarios passam.

2. Rode a suite unitária completa:

```bash
npm run test:unit
```

Resultado esperado: pelo menos os 111 testes do baseline continuam passando, alem do novo teste.

3. Rode typecheck/lint:

```bash
npm run lint
```

Resultado esperado: sem erros.

4. Rode build:

```bash
npm run build
```

Resultado esperado: build passa. O aviso de chunk grande pode permanecer como baseline.

5. Rode E2E se o ambiente de autenticacao estiver normalizado:

```bash
npm run test:e2e
```

Resultado esperado: nenhuma falha nova relacionada a `/manutencao`. As falhas de baseline listadas neste documento nao sao responsabilidade desta correcao, mas nao devem piorar.

6. Execute a validacao manual guiada acima para confirmar o comportamento visual.

Se qualquer verificacao falhar de forma nova, pare, informe o usuario com o resultado exato e aguarde instrucao.

## Observacoes para sessoes futuras

- `docs/MEMORY.md` nao possui lista objetiva de testes de fumaca. Criar uma secao formal de smoke tests reduziria ambiguidade nas proximas sessoes de bugfix.
- A tela ainda permite abrir `Nova Manutencao` enquanto Admin Master esta em "Todos os Clientes"; salvar sem cliente selecionado tende a falhar por `client_id e obrigatorio`. Isso nao e o bug atual e nao deve ser corrigido nesta sessao.
- A suite E2E esta com falhas de ambiente/autenticacao e dados obrigatorios (`renavam`) que precisam de uma sessao separada de estabilizacao.

## Registro para o docs/MEMORY.md

Apos a correcao confirmada, adicione ao `docs/MEMORY.md`:

```text
Bug corrigido: Admin Master nao via ordens de manutencao ao selecionar "Todos os Clientes".
Causa raiz: `useQuery` em `src/pages/Maintenance.tsx` ficava desabilitado para usuarios nao-oficina quando `currentClient` era `null`; para Admin Master, `currentClient = null` representa a visao global.
Correcao aplicada: query de manutencao passa a ser habilitada quando o perfil e `Admin Master`, mesmo sem cliente selecionado, preservando o filtro por `client_id` quando um cliente especifico existe.
Arquivos modificados: `src/pages/Maintenance.tsx`, `tests/unit/maintenance-query-scope.test.ts`, `docs/MEMORY.md`
Testes adicionados: `tests/unit/maintenance-query-scope.test.ts`
```

## Sugestao de commit

Quando todos os criterios de conclusao estiverem atendidos:

```bash
git add src/pages/Maintenance.tsx tests/unit/maintenance-query-scope.test.ts docs/MEMORY.md IMPLEMENTATION_FIXBUG.md
git commit -m "fix: exibe manutencoes globais para admin master"
git push
```
