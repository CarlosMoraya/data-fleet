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

## 9. Sumário por combinação

Atualizar a cada registro novo.

| Classe | Forma | Ferramenta / Modelo | N | portão 1ª vez | ciclos médios | Falhas do modelo |
|---|---|---|---|---|---|---|
| Delegável | lógica pura + UI + teste | codex / `gpt-5.6-sol` (high) | 1 | 1/1 | 0 | 0 |
| Delegável | componente de UI + teste | opencode / `big-pickle` **(gratuito)** | 1 | 1/1 | 0 | 0 |
| Supervisionado | edição em arquivo existente + integração | codex / `gpt-5.6-sol` (high) | 1 | 0/1 | 1 | 0 |
| Supervisionado | edição em arquivo existente | codex / `gpt-5.6-sol` (high) | 1 | 1/1 | 0 | 0 |

**Estado atual: amostra insuficiente em todas as combinações.** Nenhuma atingiu os 4 registros exigidos pela Seção 6. Até lá, a escolha de executor segue por benchmark (`model-cache.md`), citando estes registros como indício.

**Padrão emergente, ainda sem valor estatístico (N=2):** as duas únicas falhas até aqui foram **do plano**, nenhuma do modelo. Ambas do mesmo tipo — o planejador especificou um contrato sem abrir o arquivo ou a config que precisaria suportá-lo. Se o padrão se confirmar, o gargalo de qualidade deste fluxo é a verificação de premissas na etapa de planejamento, não a capacidade do executor.
