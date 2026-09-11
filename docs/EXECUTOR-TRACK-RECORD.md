# EXECUTOR-TRACK-RECORD.md

**Propósito:** histórico empírico de desempenho de cada executor **neste projeto**, neste stack e neste formato de documento. Serve de parâmetro para a escolha de executor, complementando — e em combinações com amostra suficiente, superando — os benchmarks públicos do `docs/model-cache.md`.
**Idioma de operação:** Português do Brasil.
**Natureza:** append-only. Nunca reescrever registro passado; corrigir apenas por linha nova com nota.

---

## 1. Por que este arquivo supera o benchmark público

SWE-Bench mede issues genéricos de GitHub. Este arquivo mede o que realmente importa para a decisão: **este código, este stack, este formato de guardrail**.

E resolve um problema que o benchmark não resolve: modelos sem catalogação pública. `opencode/big-pickle` não aparece na Artificial Analysis nem na Vellum, mas pode acumular histórico real aqui.

---

## 2. Taxonomia — o que significa "tarefa semelhante"

Duas execuções são comparáveis quando têm **a mesma classe** e **a mesma forma**. Sem isso, "semelhante" vira achismo.

**Classe** (herdada da delegabilidade da etapa):
`Delegável` · `Supervisionado` · `Não delegável`

**Forma:**
`lógica pura` · `componente de UI` · `edição em arquivo existente` · `migration` · `integração externa` · `teste` · `configuração`

**Camada:**
`frontend` · `backend` · `database` · `infra`

Uma etapa pode ter mais de uma forma; registrar todas.

---

## 3. Métricas — só sinal objetivo

Nada de "% de efetividade" estimado. Só o que é auditável:

| Campo | Como se mede |
|---|---|
| `escopo_ok` | `git status --short` bate com o manifesto de arquivos do plano? sim/não |
| `portao_1a` | passou tsc + lint + testes + smoke na primeira tentativa? sim/não |
| `ciclos` | quantos `resume`/reexecuções até passar o portão |
| `regressoes` | testes que passavam antes e falharam depois |
| `lacunas` | quantas dependências ou ambiguidades o executor **auto-reportou** |
| `tokens` | consumo declarado pela ferramenta, quando disponível |

---

## 4. Atribuição de falha — a regra mais importante

Toda falha registrada **deve** ter atribuição explícita:

- **`falha do modelo`** — o executor tinha a informação e errou mesmo assim
- **`falha do plano`** — a especificação estava incompleta, ambígua ou errada
- **`ambiguidade genuína`** — nem o plano nem o modelo poderiam resolver sem consultar o usuário

**Sem essa separação o histórico se corrompe.** Um plano ruim faria todos os modelos parecerem fracos, e a conclusão seria "só modelo caro funciona" — exatamente o viés que este arquivo existe para eliminar.

**Lacuna auto-reportada conta a favor do executor**, não contra: significa que ele obedeceu ao guardrail em vez de inventar.

---

## 5. Condições da especificação — o confundidor

O mesmo modelo rende de formas diferentes conforme a qualidade do plano. Registrar sempre:

- `manifesto` — o plano trazia a lista exaustiva de arquivos autorizados? sim/não
- `testes_literais` — os casos de teste vieram como assertivas concretas (`entrada → saída esperada`)? sim/parcial/não
- `baseline` — os números pré-execução estavam gravados no plano? sim/não

Comparar dois modelos sob condições de spec diferentes é comparação inválida. Registrar a diferença é o que permite detectá-la depois.

---

## 6. Como consultar na hora de planejar

1. Identificar classe + forma da etapa
2. Buscar registros com a mesma combinação
3. **Se houver 4 ou mais registros:** o histórico manda. Sugerir o executor de menor custo marginal com melhor desempenho na combinação.
4. **Se houver menos de 4:** amostra insuficiente. Declarar isso explicitamente e decidir por benchmark (`model-cache.md`), citando os registros existentes como indício, não como prova.

Formato da recomendação apoiada em histórico:

> Etapa 6 é `Delegável` / `componente de UI`. Nessa combinação há N registros: `<modelo>` passou o portão de primeira em X de N, com Y ciclos de correção no restante. Custo marginal zero. Sugiro `<modelo>`.

---

## 7. Reabilitação — contra a profecia autorrealizável

Sem esta regra, um modelo que falhar uma vez nunca mais é testado e nunca se recupera, mesmo depois de atualizado.

Um executor com histórico ruim **volta ao pool** quando:

- muda de versão ou de slug; **ou**
- passam 10 registros da mesma combinação sem que ele tenha sido testado

Ao voltar, entra como experimento em etapa `Delegável` de baixo risco, com revisão dirigida obrigatória independentemente do tier.

---

## 8. Registros

Ordem cronológica, mais antigo primeiro.

---

### #001 — 2026-09-07 · Módulo Utilização MELI, Etapas 3-5

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | lógica pura + componente de UI + teste |
| **Camada** | frontend |
| **Ferramenta** | codex (`codex exec`, sandbox `workspace-write`) |
| **Modelo** | `gpt-5.6-sol`, reasoning effort `high` |
| **Custo marginal** | zero (assinatura ChatGPT) |
| **Escopo** | 12 arquivos novos, nenhum arquivo existente autorizado |

**Condições da especificação**

| | |
|---|---|
| `manifesto` | **sim** — 12 arquivos listados explicitamente no prompt |
| `testes_literais` | **parcial** — alguns casos concretos (`10 veículos, 4 com rota → { total: 10, used: 4, rate: 40 }`), outros vagos (`placa com formato sujo → casada corretamente`) |
| `baseline` | **não** — números estavam apenas no contexto do planejador, não gravados no plano |

**Resultado**

| Métrica | Valor |
|---|---|
| `escopo_ok` | **sim** — `git status` confirmou zero arquivos existentes modificados |
| `portao_1a` | **sim** |
| `ciclos` | **0** |
| `regressoes` | **0** |
| `lacunas` | **1** — auto-reportada |
| `tokens` | 108.264 |
| Duração | ~15 min |

**Números verificados independentemente pelo revisor** (não aceitos do relatório do executor):

| | Baseline | Depois |
|---|---|---|
| `tsc --noEmit` | 0 erros | 0 erros |
| `lint` | 0 erros / 262 warnings | 0 erros / 262 warnings |
| `test:unit` | 231 arq / 2.087 testes | 236 arq / 2.135 testes |
| `test:smoke` | 7/7 | 7/7 |

**Lacuna auto-reportada e atribuição**

O executor sinalizou: *"Como o contrato prescrito de `MeliUtilizationRow` não contém o status cadastral, a coluna Status usa o estado diário Disponível/Indisponível."*

**Atribuição: `falha do plano`.** A Etapa 5 especificava a coluna Status como "status do veículo vindo do BetaFleet", mas o tipo `MeliUtilizationRow` definido na Etapa 3 não incluía campo de status. O executor usou o único dado disponível no contrato e reportou a lacuna — comportamento correto sob o guardrail. **Não conta como falha do modelo.**

**Resolução (mesma data):** ao investigar a correção, verificou-se que `vehicles.status` é **dado morto** — 298 de 298 veículos da Deluna em DEV e 334 de 336 no banco inteiro estão em `'Available'`. A coluna que o plano pedia teria dito "Disponível" em toda linha e nunca dispararia a divergência solicitada pelo usuário.

**A escolha do executor era superior à especificação.** Derivar o status de `maintenance_orders` na data da rota é a única fonte que varia por dia, e é também a regra oficial de disponibilidade da `docs/SPEC.md`. O plano foi corrigido para descrever o comportamento que o executor já havia implementado; **nenhuma linha de código precisou mudar.**

Lição para o protocolo: a lacuna auto-reportada não só evitou um erro silencioso — ela expôs uma premissa errada do planejador que nenhum teste teria pego, porque o teste também teria sido escrito sobre a premissa errada.

**Observações**

- Criou dois tipos não previstos no plano (`MeliEligibleVehicle`, `BuildRowsInput`). Legítimo: o plano citava `BuildRowsInput` como parâmetro sem definir sua forma.
- `buildUtilizationRows` saiu com 84 linhas contra ~45 estimadas no plano. **Subestimativa do planejador**, não inflação do executor: são dois laços enxutos montando objetos literais de 18 campos cada.
- Efeito colateral da ferramenta: o `codex` materializou `.agents/skills/supabase-postgres-best-practices/` (~25 arquivos) na raiz do repositório. É andaime do Codex, não do modelo. Considerar `.gitignore`.

**Veredito:** aprovado sem correções.

**Revisão aplicada:** portão (conforme matriz: Delegável + Tier B). Não houve revisão dirigida — apenas uma das seis funções foi lida integralmente. Os 5 arquivos de teste **não** foram auditados linha a linha.

> ⚠️ **Limite conhecido deste registro:** os 48 testes foram escritos pelo próprio executor. Portão verde prova consistência interna, não correção semântica. Este é precisamente o risco que a exigência de `testes_literais` no plano existe para eliminar.

---

### #002 — 2026-09-07 · Módulo Utilização MELI, Etapas 1 e 2

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente + integração externa + teste |
| **Camada** | frontend + backend |
| **Ferramenta** | codex (`codex exec`, sandbox `workspace-write`) |
| **Modelo** | `gpt-5.6-sol`, reasoning effort `high` |
| **Custo marginal** | zero (assinatura ChatGPT) |
| **Escopo** | 8 arquivos a modificar, 2 a criar |

**Condições da especificação**

| | |
|---|---|
| `manifesto` | **sim** — 8 modificáveis + 2 criáveis, explícitos |
| `testes_literais` | **parcial** — os casos da Etapa 2 vieram literais (92 vs 93 dias); os da Etapa 1 vieram descritivos |
| `baseline` | **sim** — 236 arq / 2.135 testes / 262 warnings, gravados no prompt |

**Resultado**

| Métrica | Valor |
|---|---|
| `escopo_ok` | **sim** — os 10 arquivos do manifesto, nada fora |
| `alterou_teste_preexistente` | **não** — `+75/-0` e `+33/-0`, zero remoções |
| `portao_1a` | **não** — parou na 1ª tentativa; passou na 2ª |
| `ciclos` | **1** (`codex exec resume`) |
| `regressoes` | **0** |
| `lacunas` | **1** — auto-reportada, bloqueante |
| `tokens` | 59.563 (1ª, sem entrega) + 49.210 (2ª) = **108.773** |

**Verificação independente do revisor**

| | Baseline | Depois |
|---|---|---|
| `tsc --noEmit` | 0 erros | 0 erros |
| `lint` | 0 erros / 262 warnings | 0 erros / 262 warnings |
| `test:unit` | 236 arq / 2.135 | **237 arq / 2.150** |

A subida de 236 para 237 **arquivos** é a prova executável de que o teste novo em `supabase/functions/` foi de fato executado pelo vitest — sem ela, o teste existiria e nunca rodaria.

**Lacuna auto-reportada e atribuição**

Na 1ª tentativa o executor **parou sem tocar em nenhum arquivo**, reportando que `src/components/VehicleDetailModal.tsx` não possui seção "Logística", nem campo Embarcador, nem Unidade Operacional — ao contrário do que o plano afirmava.

**Atribuição: `falha do plano`.** O planejador descreveu a estrutura de `VehicleForm.tsx` (que tem a seção) ao especificar `VehicleDetailModal.tsx` (que não tem), sem abrir o segundo arquivo. O executor leu, constatou e parou — comportamento correto sob o guardrail. **Não conta como falha do modelo.**

Efeito colateral positivo: o bloqueio revelou uma lacuna pré-existente do produto — Embarcador e Unidade Operacional eram cadastráveis mas invisíveis no modal de detalhe. A correção do plano criou a seção completa, fechando a lacuna.

**Revisão aplicada:** linha a linha (matriz exigia dirigida; foi feita mais profunda). Diff completo dos 10 arquivos lido, incluindo auditoria adversarial dos testes novos — todas as asserções são reais (`onSave.mock.calls[0][0]` contra o payload, `checked` contra o estado, round-trip do mapper nos dois sentidos com default seguro). Nenhum teste vazio ou com mock que anula o alvo.

**Veredito:** aprovado sem correções.

**Nota operacional (custo de ferramenta, não do modelo):** entre as duas tentativas houve uma execução perdida por sintaxe errada de `codex exec resume` — ver `docs/EXECUTORS.md`. O wrapper do bash devolveu **exit 0** mesmo com o Codex tendo recusado o argumento, e a notificação de conclusão chegou como sucesso. Só o `git status` denunciou. Reforça a regra: código de saída não é evidência de execução.

---

### #003 — 2026-09-07 · Módulo Utilização MELI, Etapa 6a — **primeiro modelo gratuito**

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | componente de UI + teste |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** — não consome cota |
| **Escopo** | 2 arquivos novos, nenhum existente |

**Condições da especificação**

| | |
|---|---|
| `manifesto` | **sim** — 2 arquivos, e proibição explícita de tocar `App.tsx`/`Sidebar.tsx` |
| `testes_literais` | **sim** — fixture de 4 veículos com os números exatos de cada card |
| `baseline` | **sim** — 237 arq / 2.150 testes / 262 warnings |

**Resultado**

| Métrica | Valor |
|---|---|
| `escopo_ok` | **sim** |
| `alterou_teste_preexistente` | **não** |
| `portao_1a` | **sim** |
| `ciclos` | **0** |
| `regressoes` | **0** |
| `lacunas` | 0 |
| Duração | ~5 min |

**Verificação independente:** tsc 0 erros · lint 0 erros / 262 warnings · **238 arq / 2.156 testes** (+1 arquivo, +6 testes).

**Auditoria adversarial dos testes — ponto central deste registro.** Mockou apenas fronteiras externas (`supabase`, `meliUtilizationService`, `AuthContext`, `useMeliUtilizationAccess`) e manteve **reais** `buildUtilizationRows`, `filterRowsByUnit`, `calculateUtilizationKpis` e os três componentes de `src/components/meli/`. Se tivesse mockado a lib de regra, os percentuais viriam do próprio mock e o teste não provaria nada. Asserções literais conforme o plano: `'75,0%'`, `'50,0%'`, `'100,0%'`, `'2026-09-06'`, 4 linhas com 3 selos `Utilizado`.

Iniciativa correta não pedida: acrescentou `\b` à regex (`/\bUtilizado\b/g`) para que "Não utilizado" não fosse contado como "Utilizado". Percebeu a armadilha sozinho.

**Veredito:** aprovado sem correções.

**Leitura honesta deste registro.** É evidência de que um modelo **gratuito** resolve etapa `Delegável` **quando a spec traz manifesto fechado, casos literais e baseline** — as três condições do protocolo. Não é evidência de que resolve etapa mal especificada, nem etapa `Supervisionado`. A hipótese testada foi exatamente essa, e passou.

---

### #004 — 2026-09-07 · Módulo Utilização MELI, Etapa 6b

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente |
| **Camada** | frontend |
| **Ferramenta** | codex (`codex exec`, sandbox `workspace-write`) |
| **Modelo** | `gpt-5.6-sol`, reasoning effort `high` |
| **Custo marginal** | zero (assinatura ChatGPT) |
| **Escopo** | 2 arquivos a modificar (App.tsx, Sidebar.tsx) + 1 teste a estender |

**Condições da especificação**

| | |
|---|---|
| `manifesto` | **sim** — 3 arquivos, nenhum outro autorizado |
| `testes_literais` | **sim** — 4 cenários com UUID literal (tenant certo/errado, var vazia, papel Driver) |
| `baseline` | **sim** — 238 arq / 2.156 testes / 262 warnings |

**Resultado**

| Métrica | Valor |
|---|---|
| `escopo_ok` | **sim** — só os 3 arquivos do manifesto |
| `alterou_teste_preexistente` | **não** — `Sidebar.test.tsx` `+92/-0` |
| `portao_1a` | **sim** |
| `ciclos` | **0** |
| `regressoes` | **0** |
| `lacunas` | 0 |

**Verificação independente:** tsc 0 erros · lint 0 erros / 262 warnings · **238 arq / 2.160 testes** (+4) · smoke **7/7** (rodado à parte, porque `Sidebar.tsx` aparece em toda tela — era o risco real desta etapa).

**Iniciativa correta não especificada:** usou `lazy(() => import('./pages/MeliUtilization'))` no `App.tsx`, seguindo a convenção de todas as outras rotas do arquivo — o plano não tinha detalhado isso.

**Veredito:** aprovado sem correções.

---

### #005 — 2026-09-07 · Módulo Utilização MELI, melhorias — Etapa 1 (linhas/cabeçalhos de exportação)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | lógica pura + teste, só arquivos novos |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | zero absoluto |
| **Escopo** | 2 arquivos novos, nenhum existente |

**Condições da especificação:** manifesto sim (2 arquivos) · testes literais sim (2 linhas completas + contagem de headers) · baseline sim (238 arq / 2.160 testes / 262 warnings).

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** `npx vitest run src/lib/meliUtilizationExportRows.test.ts` — 3/3. Transcreveu literalmente as duas linhas de entrada/saída e o `MELI_UTILIZATION_EXPORT_HEADERS.length === 15` do plano, sem desvio.

**Veredito:** aprovado sem correções.

---

### #006 — 2026-09-07 · Módulo Utilização MELI, melhorias — Etapa 2 (provider XLSX)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | arquivo novo, cópia de padrão existente |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | zero absoluto |
| **Escopo** | 1 arquivo novo |

**Condições da especificação:** manifesto sim (1 arquivo) · testes literais N/A (etapa sem teste dedicado, decisão registrada no próprio plano) · baseline sim.

**Resultado:** escopo_ok sim (só criou `src/services/meliExport/xlsxMeliUtilizationProvider.ts`) · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** cópia estrutural fiel de `xlsxDriverProvider.ts`, só trocando os três campos de identificação e os imports de `meliUtilizationExportRows.ts`. `npx tsc --noEmit` só acusava o erro esperado (Etapa 5 ainda não integrada).

**Veredito:** aprovado sem correções.

---

### #007 — 2026-09-07 · Módulo Utilização MELI, melhorias — Etapa 3 (filtros puros + extração de formatação)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente (lógica pura + extração) |
| **Camada** | frontend |
| **Ferramenta** | codex (`codex exec`, sandbox `workspace-write`) |
| **Modelo** | `gpt-5.6-sol`, reasoning effort `high` |
| **Custo marginal** | zero (assinatura ChatGPT) |
| **Escopo** | 4 arquivos a modificar |

**Condições da especificação:** manifesto sim (4 arquivos) · testes literais sim (rowUsed/rowUnused + 4 casos por função) · baseline sim.

**Resultado:** escopo_ok sim — só os 4 arquivos do manifesto · alterou_teste_preexistente não (só adicionou casos novos) · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** `npx tsc --noEmit` 0 erros · `npx vitest run` nos dois arquivos afetados — 41/41. Diff conferido linha a linha: extração de `formatOdometerDistanceKm` idêntica em comportamento à função local removida de `MeliUtilizationTable.tsx`; nenhuma outra linha da tabela tocada; `normalizePlate` reutilizada, não recriada.

**Veredito:** aprovado sem correções.

---

### #008 — 2026-09-07 · Módulo Utilização MELI, melhorias — Etapa 4 (barra de filtros)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente (componente de apresentação) |
| **Camada** | frontend |
| **Ferramenta** | codex (`codex exec`, sandbox `workspace-write`) |
| **Modelo** | `gpt-5.6-sol`, reasoning effort `high` |
| **Custo marginal** | zero (assinatura ChatGPT) |
| **Escopo** | 1 arquivo a modificar |

**Condições da especificação:** manifesto sim (1 arquivo) · testes literais N/A (componente sem teste dedicado, decisão registrada no plano) · baseline sim.

**Resultado:** escopo_ok sim (só `MeliUtilizationFiltersBar.tsx`) · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** diff conferido linha a linha — os dois inputs de data e o `MultiSelectDropdown` de unidade permaneceram intocados; os dois campos novos foram inseridos exatamente na ordem especificada.

**Veredito:** aprovado sem correções.

---

### #009 — 2026-09-07 · Módulo Utilização MELI, melhorias — Etapa 5 (integração de página)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente (integração de página em produção) |
| **Camada** | frontend |
| **Ferramenta** | codex (`codex exec`, sandbox `workspace-write`) |
| **Modelo** | `gpt-5.6-sol`, reasoning effort `high` |
| **Custo marginal** | zero (assinatura ChatGPT) |
| **Escopo** | 2 arquivos a modificar |

**Condições da especificação:** manifesto sim (2 arquivos) · testes literais sim (6 cenários com fixture já existente no arquivo) · baseline sim.

**Resultado:** escopo_ok sim — só `MeliUtilization.tsx` e `MeliUtilization.test.tsx` · alterou_teste_preexistente não · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** `npx tsc --noEmit` 0 erros (zerou o erro esperado das etapas anteriores) · `npm run lint` 0 erros / 262 warnings (mesmo patamar) · `npm run test:unit` **239 arq / 2.173 testes** (+13 desde o baseline de 2.160) · `npm run test:smoke` 7/7. Revisão elevada para linha a linha (acima do mínimo de "revisão dirigida"): as três `useQuery`, `eligibleVehicles`, `maintenanceWindows`, `rows`, `unitOptions`, `handleUnitsChange`, o gate `canView` e o tratamento de erro de `historyQuery` foram conferidos como intocados.

**Veredito:** aprovado sem correções.

---

### #010 a #013 — 2026-09-08 · Usuários: inativação — Etapas 1 a 4 (migrations por transcrição)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado / transcrição (rebaixadas de `Não delegável` pelo Passo 4.1) |
| **Forma** | migration |
| **Camada** | database |
| **Ferramenta** | opencode (`opencode run`) |
| **Modelo** | `muse-spark-1.2-contributor-free` — **custo zero absoluto** |
| **Evidência de aptidão** | AA 57 por mapeamento de gêmeo pago (`muse-spark-1.2` a $1,25/$4,25 = linha do `model-cache.md`). Primeiro gratuito do parque a atingir o piso de `Supervisionado`. **Estreia neste projeto** |
| **Escopo** | 2 arquivos novos por etapa (migration + rollback), 8 no total |

**Condições da especificação:** manifesto sim · conteúdo literal e completo no plano · baseline sim.

**Resultado:** escopo_ok sim nas 4 · portão 1ª vez sim nas 4 · ciclos 0 · regressões 0.

**Verificação independente:** `scripts/verify-transcription.mjs` comparou byte a byte cada arquivo gerado com o bloco correspondente do prompt — **8/8 idênticos**. Conferido explicitamente que `SECURITY INVOKER` sobreviveu na Etapa 4 (a armadilha de falha silenciosa sinalizada no plano) e que os delimitadores `$$` e o `GET DIAGNOSTICS` da Etapa 3 ficaram intactos.

**Veredito:** aprovado sem correções. **Atribuição de falha: nenhuma.**

**Aprendizado:** transcrição de SQL literal é a forma mais segura de delegação identificada até agora — o verificador byte a byte elimina o julgamento da revisão. Vale generalizar: sempre que o plano contiver o artefato completo, gerar o prompt em blocos `=== ARQUIVO: caminho ===` para habilitar essa verificação.

---

### #014 — 2026-09-08 · Usuários: inativação — Etapa 7 (userService + testes)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | arquivo novo (lógica de serviço) + teste transcrito |
| **Camada** | backend |
| **Modelo** | `big-pickle` (opencode) — custo zero absoluto |
| **Escopo** | 2 arquivos novos |

**Condições da especificação:** manifesto sim · serviço literal, 5 casos de teste com entrada e saída literais · baseline sim.

**Resultado:** escopo_ok sim · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** serviço byte a byte idêntico. Testes lidos integralmente com olhar adversarial — nenhum mock anula o alvo, `toHaveBeenCalledTimes(1)` presente, cenário de erro usa `mockRejectedValueOnce` real. `npx vitest run` 5/5.

**Veredito:** aprovado sem correções. Quarto registro limpo de `big-pickle` — a combinação "Delegável / arquivo novo + teste" atinge agora os 4 registros que dão autoridade ao histórico sobre o benchmark.

---

### #015 — 2026-09-08 · Usuários: inativação — Etapa 8 (driverService)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente + substituição de testes pré-existentes |
| **Camada** | backend |
| **Modelo** | `muse-spark-1.2-contributor-free` — custo zero absoluto |
| **Escopo** | 2 arquivos a modificar |

**Condições da especificação:** manifesto sim · função nova transcrita por inteiro, 5 casos literais, lista explícita do que preservar · baseline sim.

**Resultado:** escopo_ok sim · portão 1ª vez sim · ciclos 0 · regressões 0.

**Verificação independente:** diff conferido linha a linha. Substituiu exatamente os 3 testes do `describe('toggleDriverActive')` e preservou byte a byte o `beforeEach` e o `describe('resetDriverPassword')`. `npx vitest run` 13/13 (5 novos + 8 pré-existentes).

**Veredito:** aprovado sem correções.

---

### #016 — 2026-09-08 · Usuários: inativação — Etapa 9 (tela Usuários)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente (integração de página em produção, 928 linhas) |
| **Camada** | frontend |
| **Ferramenta** | codex (`codex exec`) |
| **Modelo** | `gpt-5.6-luna`, reasoning effort **`medium`** — substituindo `gpt-5.6-sol`/`high` por restrição de janela |
| **Evidência de aptidão** | SWE-Bench 93,0% (`model-cache.md`), contra 96,2% do Sol, com output $1,20 vs $20-30. **Estreia neste projeto** |
| **Escopo** | 3 arquivos a modificar |

**Condições da especificação:** manifesto sim · 7 mudanças descritas literalmente, incluindo JSX · 14 assertivas literais · baseline sim.

**Resultado:** escopo_ok sim · portão 1ª vez **não** (2 warnings de `import/order`, corrigidos por `eslint --fix`) · ciclos 0 · regressões 0.

**Verificação independente:** diff conferido linha a linha. As 7 mudanças aplicadas exatamente como especificadas; nenhum dos componentes e helpers da lista de preservação foi tocado; não introduziu `colSpan` inexistente.

**Veredito:** aprovado com 1 correção do revisor. **Atribuição de falha: falha do plano** — a especificação mandava colocar o botão "Mostrar inativos" dentro do container `max-w-xs` da busca, o que espremeria o campo em 320px. O executor obedeceu literalmente, comportamento correto. Corrigido pelo revisor reestruturando o container.

**Conclusão sobre o modelo:** `gpt-5.6-luna` com effort `medium` entregou integração de página em arquivo de 928 linhas sem nenhuma falha de modelo, com uma fração da queima de janela do Sol. Indício forte de que Sol era overkill para etapa de transcrição.

---

### #017 — 2026-09-08 · Usuários: inativação — Etapa 10 (E2E)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | teste (arquivo novo) |
| **Camada** | frontend + backend |
| **Modelo previsto** | `grok-code` — **não executou** |
| **Modelo efetivo** | `muse-spark-1.2-contributor-free` (fallback) |
| **Escopo** | 1 arquivo novo |

**Resultado:** ciclos 2 · escopo_ok sim · portão 1ª vez sim (na 3ª tentativa) · regressões 0.

**Tentativa 1 e 2 — `grok-code`:** ambas retornaram `{"type":"error","name":"UnknownError","message":"Unexpected server error"}` do provedor, sem o modelo chegar a processar o prompt. **Atribuição: indisponibilidade de provedor, NÃO falha do modelo.** Pela regra de queima do Passo 4.2, isto **não** conta contra o `grok-code`, que segue sem nenhum registro de desempenho e pode ser estreado em sessão futura.

**Tentativa 3 — `muse-spark`:** terminou sem produzir o arquivo. O log mostrou `permission requested: read (.env.local); auto-rejecting`, seguido de encerramento. **Atribuição: falha do plano** — o prompt referenciava variáveis de ambiente sem dizer que elas são apenas referenciadas em código, nunca lidas em disco. Corrigido no prompt com proibição explícita de ler arquivos de ambiente e com a frase "sua única entrega é escrever o arquivo".

**Tentativa 4 — `muse-spark`, após a correção do prompt:** 317 linhas, 8 cenários, gating correto, toda variável ausente gerando `test.skip` com mensagem — nenhum teste que passa em silêncio.

**Verificação independente:** leitura integral com olhar adversarial. **Uma lacuna encontrada:** o cenário "autoinativação é recusada sem tocar no Auth" afirmava no nome e no comentário que o Auth ficava intacto, mas só verificava o status 403 — asserção que confirma a si mesma. Corrigido pelo revisor com checagem de `banned_until` via `auth.admin.getUserById`. **Atribuição: falha do plano** — a especificação do cenário 6 descrevia a verificação em prosa mas não a transformou em assertiva literal.

**Veredito:** aprovado com 1 correção do revisor.

---

### #018 — 2026-09-09 · Agendamentos: modal de detalhe — Etapa 1 (módulo de apresentação)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | lógica pura + teste, só arquivos novos |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** — não consome cota |
| **Escopo** | 3 arquivos novos, nenhum existente |

**Condições da especificação:** `manifesto` sim (3 arquivos) · `testes_literais` sim (17 assertivas `entrada → saída`, incluindo a URL do Google Maps já percent-encoded) · `baseline` sim (241 arq / 2.195 testes / 263 warnings).

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **não** · ciclos 0 · regressões 0 · lacunas 0.

**Por que o portão reprovou:** 1 warning novo de `import/order` em `workshopScheduleMappers.test.ts` (import de valor depois de import de tipo). Resolvido pelo revisor com `npx eslint --fix`, voltando ao patamar de 263. **Atribuição: nenhuma** — mesma classe do rodapé do registro #016; não é falha de modelo nem de plano, é ruído de ordenação que a ferramenta corrige sozinha.

**Verificação independente:** leitura integral. `formatScheduleDate` é byte a byte equivalente ao `formatDate` privado que substitui; os seis valores de rótulo e classe de badge foram transcritos sem alteração. Auditoria adversarial dos testes: nenhum mock, as três funções sob teste rodam de verdade, e nenhum valor esperado é derivado da própria função.

**Veredito:** aprovado com 1 correção mecânica do revisor.

---

### #019 — 2026-09-09 · Agendamentos: modal de detalhe — Etapa 2 (`ScheduleDetailModal`)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | componente de UI + teste, só arquivos novos |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** |
| **Escopo** | 2 arquivos novos, nenhum existente |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (fixture completo + 6 cenários) · `baseline` sim. A Etapa 2 do plano trazia a árvore JSX inteira, classe por classe.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 2 (ambas do plano).

**Verificação independente — duas lacunas, as duas de origem no plano:**

1. A assertiva `expect(container.textContent).toContain('Agendado')` **confirmava a si mesma**: a string `'Agendado'` também é prefixo de `'Agendado para 10h...'`, o texto de observações do fixture. O teste passaria com o badge de status ausente. Corrigido pelo revisor para `expect(container.querySelector('.rounded-full')?.textContent).toBe('Agendado')`. **Atribuição: falha do plano** — o caso literal fui eu que escrevi, e escrevi um que não discrimina.
2. O botão "Fechar" do rodapé ficou sem cobertura: o caso literal do plano apontava o seletor `[aria-label="Fechar"]`, que é o X do cabeçalho. O executor transcreveu corretamente o que estava escrito. Corrigido pelo revisor com um sétimo cenário. **Atribuição: falha do plano.**

**Veredito:** aprovado com 2 correções do revisor, nenhuma atribuível ao modelo.

---

### #020 — 2026-09-09 · Agendamentos: modal de detalhe — Etapa 3 (integração de página)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente (integração de página em produção, 785 linhas) |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** — não consome janela de assinatura nenhuma |
| **Escopo** | 1 arquivo existente, nenhum novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` n/a (a etapa proíbe escrever teste de propósito — a cobertura é a Etapa 4, por outro executor) · `baseline` sim. O plano listava **nove** mudanças numeradas, com o JSX literal de cada botão e a lista do que permanece intocado.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** diff completo linha a linha (54 inserções / 39 remoções). As nove mudanças aplicadas exatamente como especificadas. Conferido item a item: o botão de olho é o primeiro filho da coluna de ações e está **fora** de todo condicional de permissão (`canWriteSchedules`, `canDelete`, `isScheduled`); nenhuma consulta ao Supabase foi tocada; `hydrateWorkshopScheduleRows` intacta; `detailSchedule` **não** usa `sessionStorage`, ao contrário de `isFormOpen`/`editingSchedule` no mesmo componente; a violação pré-existente de `react-hooks/rules-of-hooks` em `DriverView` não foi "corrigida"; as 7 referências às constantes removidas foram todas repontadas.

**Veredito:** aprovado **sem nenhuma correção**. **Atribuição de falha: nenhuma.**

**Conclusão sobre o modelo:** segundo registro de `muse-spark-1.2-contributor-free` em edição de página em produção, ambos sem falha de modelo. Confirma o modelo gratuito como opção real para `Supervisionado` quando a spec enumera as mudanças em vez de descrevê-las.

---

### #021 — 2026-09-09 · Agendamentos: modal de detalhe — Etapa 4 (teste de integração de página)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | teste (arquivo novo, com mock de página) |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** |
| **Escopo** | 1 arquivo novo, nenhum existente |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (dados literais das 4 tabelas + 3 cenários) · `baseline` sim.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 1 (do plano).

**Iniciativa correta não pedida:** acrescentou `buildLastKmDisplayParts` ao mock de `vehicleOdometerService`. Não é escopo excedido — `vi.mock` substitui o módulo inteiro, e `LastKmLabel` (renderizado pela linha da tabela) importa essa função. Sem isso o teste quebraria. O plano não previu.

**Verificação independente — uma lacuna, do plano:** o cenário 3 afirmava a ausência de controles de edição sem antes provar que o modal havia aberto; passaria mesmo se o clique não tivesse efeito. Corrigido pelo revisor com uma âncora de presença antes das duas asserções de ausência. **Atribuição: falha do plano** — mesmo padrão do registro #017.

**Controle negativo executado pelo revisor.** Para provar que o teste não é vacuoso, o botão de olho foi temporariamente envolvido em `{canWriteSchedules && ...}` na página: **os 3 cenários falharam**. Revertido em seguida, com a suíte voltando a 3/3. É a evidência de que o teste captura o requisito central da sessão, e não apenas a renderização da tela.

**Veredito:** aprovado com 1 correção do revisor.

---

### #022 — 2026-09-09 · Agendamentos: ações no modal — Etapa 2 (módulo puro de disponibilidade)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | lógica pura + teste, só arquivos novos |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** |
| **Escopo** | 2 arquivos novos, nenhum existente |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (7 cenários, 5 ações × 3 status, mais as 3 mensagens completas) · `baseline` sim (245 arq / 2.222 testes / 263 warnings). O plano trazia o módulo inteiro transcrito, mais uma tabela de fidelidade mapeando cada condição do JSX antigo na função nova.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **não** (1 warning `import/order`) · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** tsc 0 · lint 0 erros/263 warnings após `eslint --fix` · 246 arq / 2.229 testes (+7). Auditoria adversarial: nenhum mock (função pura), todas as asserções `toBe(true/false)` ou string exata, nenhuma auto-confirmação. Os 7 cenários do plano estão todos presentes com os valores literais.

**Veredito:** aprovado. **Atribuição de falha: nenhuma** — `import/order` é ruído mecânico resolvido por `--fix`, mesmo padrão dos registros #018 e #020.

---

### #023 — 2026-09-09 · Agendamentos: ações no modal — Etapa 1 (`LastKmLabel`, componente compartilhado)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente + teste |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** |
| **Escopo** | 2 arquivos existentes, nenhum novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (2 casos com valores exatos) · `baseline` sim. O plano trazia o corpo novo do componente inteiro e o ajuste literal da função `render` do teste.

**Resultado:** escopo_ok sim · alterou_teste_preexistente **não** (`+18/-3`; os 3 testes antigos intocados, só a assinatura do helper mudou) · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Risco real desta etapa e como foi coberto:** `LastKmLabel` é renderizado por 5 telas (Veículos, Checklists, Chamados, SOS, Agendamentos). A prop entrou **aditiva com default `false`**, e a suíte inteira (2.231 testes) passou — é a prova de que as outras 4 telas não mudaram.

**Veredito:** aprovado **sem nenhuma correção**. **Atribuição de falha: nenhuma.**

---

### #024 — 2026-09-09 · Agendamentos: ações no modal — Etapa 3 (rodapé de ações do `ScheduleDetailModal`)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente + teste novo |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** |
| **Escopo** | 1 arquivo existente + 1 novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (8 cenários com listas de rótulos exatas) · `baseline` sim. O plano numerava **cinco** mudanças e trazia a árvore JSX inteira do rodapé.

**Resultado:** escopo_ok sim · alterou_teste_preexistente **não** · portão_1a **não** (1 warning `tailwindcss/classnames-order`) · ciclos 0 · regressões 0 · **lacunas 2, as duas do plano**.

**Verificação independente — duas lacunas, ambas de origem no plano:**

1. O warning de ordem de classes Tailwind estava **no JSX que o próprio plano ditou**, linha por linha. O executor transcreveu fielmente um erro meu. Resolvido por `eslint --fix`. **Atribuição: falha do plano.**
2. **Nenhum cenário provava que o botão "Excluir" chama `onDelete`.** "Excluir" não existe em status `scheduled`, e o único cenário que o mencionava (`o botão Fechar não dispara nenhuma ação`) afirmava justamente sua **ausência**. Uma fiação trocada — `onDelete` apontando para `onCancel` — passaria por todos os 8 cenários. O revisor acrescentou um nono caso em status `completed`. **Atribuição: falha do plano.**

**Auditoria adversarial dos testes:** `isScheduleActionAvailable` é usada **real**, não mockada — se o executor a tivesse mockado, o teste provaria apenas que o mock funciona. `buttonLabels()` filtra strings vazias, isolando o X do cabeçalho (que não tem texto) das asserções de rótulo. Os dois arquivos de teste protegidos pelo plano continuam intactos e passando.

**Veredito:** aprovado com 2 correções do revisor, **nenhuma atribuível ao modelo**.

---

### #025 — 2026-09-09 · Agendamentos: ações no modal — Etapa 4 (integração de página em produção)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente (integração de página em produção, 785 linhas) |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** |
| **Escopo** | 1 arquivo existente, nenhum novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` **n/a — a etapa PROÍBE escrever teste** (cobertura é a Etapa 5, por outro disparo) · `baseline` sim. O plano listava **nove** mudanças numeradas mais uma lista item a item do que permanece intocado.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** diff completo linha a linha, **+50/-90** — a tela encolheu 40 linhas. As nove mudanças aplicadas exatamente como especificadas. Conferido item a item: nenhuma das três `useQuery`, nenhuma das três mutations e `hydrateWorkshopScheduleRows` foram tocadas; `MapPin`, `formatWorkshopAddress` e `buildGoogleMapsUrl` continuam importados porque a `DriverView` os usa (remover teria sido o erro óbvio); o `<tr>` clicável não ganhou `role`/`tabIndex`; a violação pré-existente de `react-hooks/rules-of-hooks` em `DriverView` **não** foi "corrigida"; e o `if (!window.confirm(...)) return;` vem **antes** do `setDetailSchedule(null)` nos três handlers irreversíveis, que é o que mantém o modal aberto quando o usuário recusa.

**Veredito:** aprovado **sem nenhuma correção**. **Atribuição de falha: nenhuma.**

**Conclusão sobre o modelo:** **segundo plano consecutivo** em que este modelo faz a integração de página deste mesmo arquivo sem uma única correção, evitando as duas vezes a armadilha do `rules-of-hooks`. Reforça o achado do #020: o modelo gratuito entrega essa forma quando a spec **enumera** as mudanças em vez de descrevê-las.

---

### #026 — 2026-09-09 · Agendamentos: ações no modal — Etapa 5 (teste de integração de página)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | teste (arquivo novo, com mock de página) |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** |
| **Escopo** | 1 arquivo novo, nenhum existente |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (fixture de 2 linhas com status distintos, 8 cenários, mensagens de confirmação por extenso) · `baseline` sim.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **não** (8 warnings) · ciclos 0 · regressões 0 · lacunas 1 (do plano).

**Verificação independente — 8 warnings de `no-explicit-any`/`no-unsafe-member-access`** vindos de `as any` em duas asserções sobre `updateSpy.mock.calls[0][0]`. Causa: o plano especificou o mock como `vi.fn(() => ...)`, **sem tipar o parâmetro**, então o executor não tinha tipo para acessar e recorreu a `any`. O revisor tipou o espião (`vi.fn((_payload: Record<string, unknown>) => ...)`) e removeu os quatro `as any`. **Atribuição: falha do plano.**

**Auditoria adversarial:** só fronteiras externas mockadas (`supabase`, `AuthContext`, `vehicleOdometerService`); `ScheduleDetailModal`, `workshopScheduleActions` e `LastKmLabel` permanecem **reais**. Toda asserção de ausência tem âncora de presença — a lacuna que reprovou o #017 e o #021 **não se repetiu**, porque desta vez o plano especificou as âncoras explicitamente.

**Dois controles negativos executados pelo revisor.** (1) Um botão de ação foi devolvido à linha da tabela: o cenário 1 **falhou**. (2) A guarda `if (!window.confirm(...)) return;` foi removida do cancelamento: o cenário 5 **falhou**. Ambos revertidos, com a suíte voltando a 8/8 e o arquivo de página voltando ao `+50/-90` aprovado. É a evidência de que o teste captura tanto o requisito de UI quanto o requisito de segurança da sessão.

**Veredito:** aprovado com 1 correção do revisor, **não atribuível ao modelo**.

---

### #027 — 2026-09-09 · Agendamentos: ações no modal — Etapa 6 (atualização de E2E)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado / transcrição |
| **Forma** | edição em arquivo existente (teste E2E) |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** |
| **Escopo** | 1 arquivo existente, nenhum novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` n/a (edição de teste existente; o plano trazia o antes e o depois de cada substituição) · `baseline` sim. **Primeira execução registrada da forma "edição de E2E" com qualquer modelo — amostra insuficiente declarada no plano**, mitigada por revisão linha a linha.

**Resultado:** escopo_ok sim · alterou_teste_preexistente **sim, por especificação** (é o objeto da etapa) · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** exatamente as cinco substituições, nada além. Todas as asserções de destino preservadas (`toHaveURL('/manutencao')`, `'Nova Manutenção'`, os `inputValue()` de prefill, `'Preventiva'`, `'Aguardando orçamento'`, `'Será gerada automaticamente'`). `e2e/completed/role-operations-manager.spec.ts:164` — que estava **fora** do manifesto — não foi tocado, e continua correto: o Gestor de Operações não vê o botão nem na linha nem no modal.

**⚠️ Validação de execução BLOQUEADA — não confundir com aprovado.** O arquivo vive em `e2e/pending` e exige DEV autenticado com dados operacionais reais. **Não foi executado.** Risco introduzido e não verificado empiricamente: antes, `.first()` incidia sobre a lista de *botões* "Gerar OS", pulando naturalmente as linhas canceladas; agora incide sobre a lista de *linhas*, e uma primeira linha cancelada faria o botão não existir no modal. Na prática o teste 01 da suíte serial cria um agendamento com data futura, que fica no topo da ordenação decrescente — mas isso é inferência, não medição.

**Veredito:** aprovado na revisão de código; **execução pendente**. **Atribuição de falha: nenhuma.**

---

### #028 — 2026-09-11 · Financeiro/Pagamentos: rótulo "Lançado no sistema" — Etapa 1 (módulo de labels)

| Campo | Valor |
|---|---|
| **Classe** | Delegável |
| **Forma** | arquivo novo (lógica pura) + teste transcrito |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** |
| **Escopo** | 2 arquivos novos, nenhum existente |

**Condições da especificação:** `manifesto` sim · `testes_literais` sim (2 cenários com `toEqual` sobre o mapa inteiro, entrada/saída literais) · `baseline` sim (248 arq / 2.248 testes / 263 warnings).

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** os dois arquivos criados são byte a byte idênticos ao conteúdo literal do plano — conferido por leitura direta, sem diff necessário (arquivos novos). `npx vitest run src/lib/paymentStatusDisplay.test.ts` 2/2. `tsc` 0 erros.

**Veredito:** aprovado sem correções. Quinto registro limpo de `big-pickle` na combinação "Delegável / arquivo novo + teste".

---

### #029 — 2026-09-11 · Financeiro/Pagamentos: rótulo "Lançado no sistema" — Etapa 2 (4 componentes de Financeiro)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado |
| **Forma** | edição em arquivo existente |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/muse-spark-1.2-contributor-free` |
| **Custo** | **zero absoluto** |
| **Escopo** | 4 arquivos existentes, nenhum novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` n/a (edição de componente por trocas literais especificadas antes/depois, sem teste novo nesta etapa — justificado no plano) · `baseline` sim.

**Resultado:** escopo_ok sim · alterou_teste_preexistente não · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** diff completo dos 4 arquivos lido linha a linha. Todas as 18 trocas especificadas (imports, remoção das 4 constantes `STATUS_LABELS` duplicadas, 2 arrays `STATUS_OPTIONS` reescritos, 2 badges, botão de ação em massa com template literal, aviso, card "Lançados no sistema", 3 `ReadField` de auditoria) aplicadas exatamente como no plano. `STATUS_BADGE`, `CATEGORY_LABELS`, `CATEGORY_OPTIONS`, `SOURCE_LABELS`, `SOURCE_OPTIONS` e o rótulo "Pagamento" (distinto de "Pago em") permaneceram intocados, como exigido pelas restrições absolutas.

**Veredito:** aprovado sem correções. Quarto registro limpo de `muse-spark-1.2-contributor-free` na combinação "Supervisionado / edição em arquivo existente / frontend" — consolida a preferência sobre `gpt-5.6-luna` para esta forma quando a spec vem fechada.

---

### #030 — 2026-09-11 · Financeiro/Pagamentos: rótulo "Lançado no sistema" — Etapa 3 (E2E pendentes)

| Campo | Valor |
|---|---|
| **Classe** | Supervisionado / transcrição |
| **Forma** | edição em arquivo existente (teste E2E) |
| **Camada** | frontend |
| **Ferramenta** | opencode (`opencode run --format json`) |
| **Modelo** | `opencode/big-pickle` |
| **Custo** | **zero absoluto** |
| **Escopo** | 2 arquivos existentes, nenhum novo |

**Condições da especificação:** `manifesto` sim · `testes_literais` n/a (edição de teste existente; o plano trazia o antes e o depois literal de cada substituição) · `baseline` sim. Segunda execução registrada da forma "edição de E2E" — agora 2 registros (#027, #030), ainda amostra insuficiente formalmente, mas consistente: `big-pickle` limpo nas duas.

**Resultado:** escopo_ok sim · alterou_teste_preexistente **sim, por especificação** (é o objeto da etapa) · portão_1a **sim** · ciclos 0 · regressões 0 · lacunas 0.

**Verificação independente:** exatamente as 4 substituições especificadas nos 2 arquivos, nada além — nomes de teste preservados intactos. Confirmado por checagem visual real na tela (Playwright ad-hoc autenticado como Admin Master em `http://localhost:3000/financeiro`): o filtro de status mostra "Lançado no sistema" nas duas abas, Pagamentos e Pagamentos Extras.

**⚠️ Validação de execução das specs BLOQUEADA — não confundir com aprovado.** Os dois arquivos vivem em `e2e/pending` e exigem `TEST_FINANCEIRO_EMAIL`/`PASSWORD` (e `TEST_WORKSHOP_EMAIL`/`PASSWORD` para o cenário 08 da mesma suíte), não confirmados como disponíveis nesta sessão. **Não foram executados via Playwright.** A verificação desta etapa foi estática (grep + diff) mais checagem visual manual da tela real, não a execução das duas specs.

**Veredito:** aprovado na revisão de código; **execução das specs pendente**. **Atribuição de falha: nenhuma.**

---

## 9. Sumário por combinação

Atualizar a cada registro novo.

| Classe | Forma | Ferramenta / Modelo | N | portão 1ª vez | ciclos médios | Falhas do modelo |
|---|---|---|---|---|---|---|
| Delegável | lógica pura + UI + teste | codex / `gpt-5.6-sol` (high) | 1 | 1/1 | 0 | 0 |
| Delegável | componente de UI + teste | opencode / `big-pickle` **(gratuito)** | 2 | 2/2 | 0 | 0 |
| Delegável | lógica pura + teste, só arquivos novos | opencode / `big-pickle` **(gratuito)** | 3 | 2/3³ | 0 | 0 |
| Delegável | arquivo novo, cópia de padrão existente | opencode / `big-pickle` **(gratuito)** | 1 | 1/1 | 0 | 0 |
| Supervisionado | edição em arquivo existente + integração | codex / `gpt-5.6-sol` (high) | 2 | 1/2 | 0,5 | 0 |
| Supervisionado | edição em arquivo existente | codex / `gpt-5.6-sol` (high) | 3 | 3/3 | 0 | 0 |
| Supervisionado / transcrição | migration (SQL literal) | opencode / `muse-spark-1.2-contributor-free` **(gratuito)** | 4 | 4/4 | 0 | 0 |
| Delegável | arquivo novo + teste | opencode / `big-pickle` **(gratuito)** | 4 | 4/4 | 0 | 0 |
| Supervisionado | edição em arquivo existente | opencode / `muse-spark-1.2-contributor-free` **(gratuito)** | **5** | 4/5⁴ | 0 | 0 |
| Supervisionado | integração de página | codex / `gpt-5.6-luna` (medium) | 1 | 0/1¹ | 0 | 0 |
| Supervisionado | teste (arquivo novo) | opencode / `muse-spark-1.2-contributor-free` **(gratuito)** | 1 | 1/1 | 2² | 0 |
| Delegável | teste (arquivo novo, mock de página) | opencode / `muse-spark-1.2-contributor-free` **(gratuito)** | 2 | 1/2⁵ | 0 | 0 |
| Supervisionado / transcrição | edição de teste E2E | opencode / `big-pickle` **(gratuito)** | 1 | 1/1 | 0 | 0 |

¹ Reprovou o portão por 2 warnings de `import/order`, resolvidos por `eslint --fix`; nenhuma falha de modelo.
² Os 2 ciclos foram indisponibilidade de provedor (`grok-code`) e falha do plano, não do modelo.
³ A única reprovação foi 1 warning de `import/order` resolvido por `eslint --fix` (registro #018); nenhuma falha de modelo.
⁴ As duas reprovações foram 1 warning de `import/order` e 1 de `classnames-order`, ambos resolvidos por `eslint --fix`; o segundo estava no JSX ditado literalmente pelo plano. Nenhuma falha de modelo.
⁵ A reprovação foram 8 warnings de `no-explicit-any` decorrentes de o plano não ter tipado o espião do mock (registro #026); nenhuma falha de modelo.

**Estado atual (2026-09-09): três combinações atingiram autoridade estatística.** "Supervisionado / edição em arquivo existente" com `muse-spark-1.2-contributor-free` chegou a **5 registros** — nessa combinação o histórico manda e o benchmark é ignorado. Ela inclui duas integrações de página em produção no mesmo arquivo (`WorkshopSchedules.tsx`, registros #020 e #025), ambas **sem uma única correção**.

**Estado anterior (2026-09-08): duas combinações atingiram autoridade estatística.** "Supervisionado / transcrição de migration" com `muse-spark-1.2-contributor-free` e "Delegável / arquivo novo + teste" com `big-pickle` chegaram aos **4 registros** exigidos pela Seção 6 — nessas duas, o histórico agora manda e o benchmark é ignorado. "Supervisionado / edição em arquivo existente" com `gpt-5.6-sol` segue em 3, mas foi **superada na prática**: `gpt-5.6-luna` (effort `medium`) e `muse-spark` gratuito entregaram a mesma forma sem falha de modelo, com fração da queima de janela.

**Executores sem nenhum registro:** `grok-code` (duas tentativas abortadas por erro do provedor, sem chegar a processar — não conta como falha e pode ser estreado de novo).

**Padrão confirmado (N=12, atualizado em 2026-09-09, segunda sessão do dia):** as doze falhas registradas até hoje foram **todas do plano**, nenhuma do modelo. As quatro mais recentes: um JSX que o plano ditou já com a ordem de classes Tailwind errada (o executor transcreveu fielmente um erro do planejador); um mock especificado sem tipo de parâmetro, que forçou o executor a `as any`; e — a mais séria — **um cenário de teste que o plano simplesmente não previu**: nenhuma asserção provava que o botão "Excluir" chama `onDelete`, porque a ação não existe no status usado pelos demais cenários. Uma fiação trocada teria passado por todos os 8 casos. **Lição nova:** revisar a matriz de cobertura por *ação × estado*, não por contagem de cenários — um plano com oito casos pode deixar uma ação inteira sem prova positiva.

**Padrão anterior (N=8):** as oito falhas registradas até então foram **todas do plano**, nenhuma do modelo. As três de 2026-09-09 repetiram o padrão em sua forma mais pura: uma assertiva que confirmava a si mesma (`toContain('Agendado')` casando com o texto de observações), um caso literal apontando o seletor errado, e uma asserção de ausência sem âncora de presença. Nenhuma delas era detectável por comando de verificação — só por leitura adversarial. O gargalo de qualidade deste fluxo é a especificação, não a capacidade do executor. As três de 2026-09-08 foram do mesmo tipo — o planejador descreveu em prosa algo que precisava ser literal (o container do botão, a assertiva de `banned_until`) ou omitiu uma premissa do ambiente (variáveis de ambiente são referenciadas, não lidas em disco).

**Consequência prática:** vale investir mais em fechar a especificação do que em subir o tier do executor. Um modelo gratuito com spec fechada superou, nesta sessão, o histórico do `gpt-5.6-sol` com spec parcial.
