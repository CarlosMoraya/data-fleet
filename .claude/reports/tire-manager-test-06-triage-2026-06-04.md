# Triagem Fixbug — tenant-users-manager-tires teste 06

Data: 2026-06-04

## Escopo

- Arquivo: `e2e/completed/tenant-users-manager-tires.spec.ts`
- Projeto: `manager`
- Teste principal: `06 — TireForm: cadastrar pneu individual com sucesso`
- Erro observado: `locator.selectOption` tentava selecionar opcao de posicao desabilitada.

## Classificacao Final

`spec-desatualizada`.

Nao houve evidencia de bug real de produto. O modal de cadastro individual exibiu corretamente posicoes ocupadas como desabilitadas e posicoes livres como selecionaveis.

## Evidencias

Reproducao isolada antes da correcao:

```bash
npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager --grep "06"
```

Resultado: falhou em `positionSelect.selectOption(val)` com `option being selected is not enabled`.

Snapshot do Playwright:

- modal `Novo Pneu` aberto para `BTF1A01`;
- posicao `E1IN` desabilitada e ocupada;
- posicoes seguintes livres (`E1M`, `E1EX`, `D1IN`, etc.);
- botao `Cadastrar Pneu` desabilitado enquanto nenhuma posicao livre estava selecionada.

Causa confirmada: o spec lia `getAttribute('disabled')` e usava `if (!isDisabled)`. Para atributo booleano HTML, `disabled=""` retorna string vazia; portanto o teste tratava opcao desabilitada como habilitada.

## Correcao Aplicada

Arquivo alterado:

- `e2e/completed/tenant-users-manager-tires.spec.ts`

Mudancas:

- a verificacao de posicao livre passou a exigir ausencia do atributo `disabled` (`isDisabled === null`);
- o teste agora falha explicitamente se nao houver posicao livre para cadastro individual;
- durante `npm run test:e2e`, foi encontrada e corrigida uma segunda falha de seletor no teste 10 do mesmo arquivo: `text=De`/`text=Para` foram trocados por headers exatos via role.

## Validacoes

- `npm run test:smoke`: passou, 6/6.
- `npm run test:e2e:auth`: falhou inicialmente porque `e2e/.auth/carlos.json` estava expirado; apos `npx playwright test --project=setup-carlos --project=setup-jorge`, passou, 6/6.
- `npx playwright test e2e/completed/new-roles-audit.spec.ts --project=chromium`: falhou fora do escopo por expectativas de nomes antigos `Robson` e `Pereira`.
- `npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager --grep "06"`: passou.
- `npx playwright test e2e/completed/tenant-users-manager-tires.spec.ts --project=manager`: passou, 15/15.
- `npm run test:e2e`: executado apos todas as correcoes em pneus; resultado final 96 passed, 2 failed, 9 skipped, 32 did not run. As falhas remanescentes sao somente `new-roles-audit` por nomes antigos.

## Pendencias Fora do Escopo

`e2e/completed/new-roles-audit.spec.ts` ainda usa assercoes de nome antigo:

- `getByText(/robson/i)` para Coordinator;
- `getByText(/pereira/i)` para Supervisor.

Essas falhas nao foram alteradas por guardrail de escopo.
