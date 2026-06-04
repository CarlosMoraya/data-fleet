# Triage do baseline E2E - 2026-06-03

## Contexto de execucao

- Data/hora de triagem: 2026-06-03
- Workspace: `/home/cmoraya/Documentos/Projetos/Beta-fleet`
- Observacao de ambiente:
  - `curl http://localhost:3000` dentro do sandbox do agente retornou `000`
  - `curl http://localhost:3000` fora do sandbox retornou `200`
  - Toda validacao Playwright usada neste relatorio foi executada fora do sandbox

## Comandos executados

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
npm run test:smoke
npx playwright test e2e/completed/auth-storage-state.spec.ts --project=chromium
npx playwright test e2e/completed/new-roles-audit.spec.ts --project=chromium
npx playwright test --list
npm run test:e2e:pending -- --list
npm run test:e2e
```

## Resumo bruto

### Baseline informado antes da correcao

- `npm run test:e2e`: `102 passed`, `36 failed`, `27 skipped`, `122 did not run`

### Validacao minima desta sessao

- `curl` no contexto valido do Playwright: `200`
- `npm run test:smoke`: `6 passed`
- `npm run test:e2e:auth`: `6 passed`

### Baseline apos a correcao operacional

- `npm run test:e2e`: `85 passed`, `3 failed`, `9 skipped`, `42 did not run`
- `npx playwright test --list`: `139 tests in 23 files`
- `npm run test:e2e:pending -- --list`: `161 tests in 32 files`

## Tabela de falhas reproduzidas

| arquivo | pasta | projeto | status | erro principal | classificacao preliminar |
| --- | --- | --- | --- | --- | --- |
| `e2e/completed/new-roles-audit.spec.ts` | `completed` | `chromium` | falhou | `Missing required E2E credential env: TEST_COORDINATOR_EMAIL` | `auth-storage` |
| `e2e/completed/new-roles-audit.spec.ts` | `completed` | `chromium` | falhou | `Missing required E2E credential env: TEST_SUPERVISOR_EMAIL` | `auth-storage` |
| `e2e/completed/tenant-users-manager-tires.spec.ts` | `completed` | `manager` | falhou | `locator.selectOption`: opcao de posicao nao habilitada em cadastro de pneu individual | `fixture-dados` |

## Evidencias de classificacao

- `auth-storage`
  - Antes da correcao, `new-roles-audit` usava `robson@gmail.com`, `pereira@gmail.com` e senha `123456`, com snapshots de `Invalid login credentials`.
  - Depois da correcao, a spec falha imediatamente com erro explicito de variavel ausente, sem tentar login legacy.
- `ambiente`
  - O host local responde em `http://localhost:3000`, mas o sandbox do agente nao alcança a mesma porta.
  - Isso confirma que rodar Playwright no sandbox gera falso negativo de conectividade.
- `fixture-dados`
  - `tenant-users-manager-tires.spec.ts` falhou ao selecionar uma opcao de posicao desabilitada no modal de pneu individual.
  - A falha ocorreu depois da separacao de `pending`, entao nao e poluicao de suite; o proximo passo precisa isolar se o bloqueio vem de estado do veiculo/dados seed ou da propria spec.

## Falhas que bloqueiam o baseline `completed`

1. `e2e/completed/new-roles-audit.spec.ts`
   - Bloqueio atual: faltam `TEST_COORDINATOR_EMAIL`, `TEST_COORDINATOR_PASSWORD`, `TEST_SUPERVISOR_EMAIL`, `TEST_SUPERVISOR_PASSWORD`
   - Status: spec corrigida para comportamento diagnostico; depende de credenciais oficiais
2. `e2e/completed/tenant-users-manager-tires.spec.ts`
   - Bloqueio atual: cadastro individual depende de opcao de posicao habilitada
   - Status: candidato a `fixture-dados`; nao corrigido neste plano

## Itens removidos do baseline por serem `pending-nao-baseline`

- Toda a arvore `e2e/pending/**` foi removida de `npm run test:e2e`
- Confirmacao objetiva:
  - `npx playwright test --list` lista apenas `completed`, `smoke` e `setup`
  - `npm run test:e2e:pending -- --list` lista apenas `pending`

## Comparacao antes/depois

| aspecto | antes | depois |
| --- | --- | --- |
| Suite padrao | misturava `completed` e `pending` | executa apenas baseline aceito |
| Triagem de `pending` | embutida no mesmo comando | script dedicado `npm run test:e2e:pending` |
| Falha de roles | `Invalid login credentials` com fallback legado | falha diagnostica por env oficial ausente |
| Sinal operacional | `36 failed` nao acionavel | `3 failed` classificados |

## Conclusao operacional

- A causa sistemica principal foi reduzida para tres grupos distintos:
  - diferenca de rede entre sandbox e host
  - governanca da suite (`pending` no baseline)
  - spec `completed` com credenciais legadas
- O baseline agora e reproduzivel e acionavel.
- Qualquer proxima correcao deve sair deste plano e atacar separadamente:
  - provisionamento de credenciais oficiais de Coordinator/Supervisor
  - triagem de `tenant-users-manager-tires.spec.ts` como possivel `fixture-dados` ou bug real de produto
