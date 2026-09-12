# EXECUTORS.md

**Última atualização:** 2026-09-12
**Propósito:** parque real de agentes de código disponíveis nesta máquina, com o comando exato de invocação de cada um. É a fonte única que traduz **tier** (usado nos planos) em **ferramenta + modelo + comando**.
**Idioma de operação:** Português do Brasil.

---

## 1. Por que este arquivo existe

Planos (`IMPLEMENTATION.md` / `IMPLEMENTATION_FIXBUG.md`) **nunca** citam nome de modelo. Citam apenas o **tier**. O mapeamento tier → ferramenta vive só aqui.

Motivo: nome de modelo apodrece. Em 2026-09-07 o `docs/model-cache.md` (de 22/08) já desconhecia o `gpt-6-astra`, que já estava disponível na conta do usuário. Um plano escrito com nome fixo já nasceria defasado. Com tier, trocar de ferramenta é editar **este** arquivo, e todos os planos continuam válidos.

---

## 2. Custo marginal — o que realmente importa aqui

**O usuário não paga por token em nenhuma das ferramentas.** Todas são assinatura fixa ou gratuitas. Portanto o preço `$/M` publicado nos leaderboards **não é critério de orçamento**.

**Ressalva acrescentada em 2026-09-08:** ele continua útil por outra via. Dentro de uma mesma assinatura, o preço é o **melhor proxy disponível da velocidade com que o modelo queima a janela de uso**. Trocar um modelo de output $20-30 por um de $1,20 na mesma ferramenta muda quanto da janela sobra para as etapas seguintes. Usar preço para isso é legítimo; usar preço como se fosse dinheiro saindo do bolso, não.

O recurso escasso real, em ordem de escassez:

1. **Tokens do agente planejador/revisor** (Claude Code) — consumidos na especificação e na revisão.
2. **Janela de uso de 5h das assinaturas** — `codex`/ChatGPT e `opencode` pago têm limite por janela deslizante. **Corrigido em 2026-09-08:** a versão anterior dizia "raramente atingida em uma sessão". É falso. O usuário reportou as duas janelas apertadas ao mesmo tempo, e **quanto mais forte o modelo, mais rápido a janela queima** — duas etapas com modelo de topo podem travar a sessão inteira.
3. **Tempo do usuário** — supervisão interativa e retrabalho.

Consequência prática dessa correção: ao distribuir um plano com 3 ou mais etapas delegadas, **pergunte ao usuário qual janela está apertada antes de montar a tabela**. A resposta muda a distribuição inteira. E, dentro da mesma janela, prefira sempre o modelo mais barato que atenda à aptidão — o preço `$/M` não é orçamento, mas é o melhor proxy disponível de velocidade de queima.

Há duas categorias distintas de "zero", e a diferença importa quando a cota aperta:

- **Custo marginal zero** — assinatura fixa já paga (codex, claude, modelos pagos do opencode). Consome cota.
- **Custo zero absoluto** — os 7 modelos gratuitos reais do opencode (verificado por `opencode models` em 2026-09-11), a `freebuff` e o `ollama` local. **Não consomem cota nenhuma.**

Consequência prática: **executor com custo zero absoluto é sempre a primeira escolha, desde que atenda à aptidão mínima da classe da etapa.** Um executor que falha não é barato — o retrabalho cai no recurso nº 1.

---

## 3. Tiers

| Tier | Quando usar | Aptidão exigida |
|---|---|---|
| **A — máxima** | Etapas `Supervisionado` de alto risco (grau S3): fronteira de tenant/auth, contrato de API, arquivo compartilhado grande | **AAII ≥ 45** |
| **B — forte** | Etapas `Supervisionado` comuns (graus S1 e S2) | **AAII ≥ 35** (S1) · **AAII ≥ 38** (S2) |
| **C — econômico** | Etapas `Delegável` (graus D1 e D2): arquivos novos, lógica pura, componentes de apresentação, testes transcritos | **AAII ≥ 23** (D1) · **AAII ≥ 30** (D2) |

Etapas `Não delegável` (migration com dado real, correção de dado em produção) não têm tier — são escritas pelo agente planejador.

---

## 4. O parque — comandos verificados em 2026-09-07

Todos os comandos abaixo foram verificados nesta máquina.

> ⚠️ **Modelo de execução vigente desde 2026-09-08 — ver `agent/AGENT.md` §4.** O usuário **não executa código nem dispara agentes**. Todo executor é acionado pelo agente planejador via Bash. Consequência direta: **`acionável: NÃO` passa a significar inutilizável neste projeto**, não "o usuário roda". A `freebuff` (§4.5) sai do parque efetivo por esse motivo.

### 4.1 codex — OpenAI Codex CLI

```
Binário:        /home/cmoraya/.npm-global/bin/codex   (v0.153.4)
Autenticação:   ChatGPT (assinatura)
Custo marginal: zero (dentro da cota)
Acionável:      SIM — modo `exec` não-interativo
Tier:           A / B
```

Modelos disponíveis (de `~/.codex/models_cache.json`, 2026-09-07):

| Slug | Observação |
|---|---|
| `gpt-6-astra` | **AAII 53 — a fronteira do índice**, output $50. Reservar para fronteira de segurança e dado de produção |
| `gpt-5.6-sol` | **AAII 47**, output $10-30. **default do `config.toml`**; usado com sucesso em 2026-09-07. Alcança S3. **Queima janela rápido — não é o default recomendado para `Supervisionado` comum** |
| `gpt-5.6-terra` | **AAII 42**, output $12. Alcança S2 |
| **`gpt-5.6-luna`** | **AAII 38, output $1,20.** Alcança S2 — no limite exato do piso. Melhor relação aptidão/queima do parque codex para S1 e S2 com spec fechada |
| `gpt-5.5` | AAII —, output $30 |
| `gpt-5.4-mini` | o mais leve da família; output $4,50 |

Comando canônico (prompt por stdin, para não sofrer com aspas):

```bash
codex exec -s workspace-write -m gpt-5.6-luna \
  -c model_reasoning_effort="medium" \
  --skip-git-repo-check - < session/codex-prompt.txt \
  > session/codex-run.log 2>&1
```

> O comando canônico passou a explicitar modelo e effort em 2026-09-08. Sem `-m`, o `codex` usa o `gpt-5.6-sol` do `config.toml` — que é a escolha cara. Subir para `-m gpt-5.6-sol` ou `-m gpt-6-astra` e `effort high` exige razão citada na justificativa do plano.

Notas operacionais:
- `-m <slug>` sobrepõe o modelo; sem ele usa o default do `config.toml` (`gpt-5.6-sol`).
- `-c model_reasoning_effort=` aceita `low|medium|high|xhigh|max|ultra` **sem** alterar o `config.toml`. O default do usuário é `medium`. **Corrigido em 2026-09-08:** a regra anterior — "para etapas `Supervisionado` usar `high` ou acima" — ignorava que raciocínio é justamente onde a janela de 5h queima. Passa a valer: `medium` é o padrão para `Supervisionado` com especificação fechada (manifesto, código transcrito, assertivas literais); `high` só para arquivo grande em produção ou contrato consumido por outro módulo. Ver `docs/MODEL_SELECTION.md`, Passo 4.
- **Modelo importa tanto quanto o effort para o consumo de janela.** `gpt-5.6-luna` ($0,20/$1,20, **AAII 38**) queima uma fração do `gpt-5.6-sol` ($2/$10, **AAII 47**) — nove pontos de índice por uma ordem de grandeza a menos de queima. **Atenção à releitura de 2026-09-11:** a justificativa anterior desta linha usava SWE-Bench e fazia a diferença parecer pequena (3 pontos); no índice único ela é grande. A conclusão prática **não muda** — para transcrever especificação fechada, Luna basta e Sol é desperdício —, mas Luna fica **no limite exato do piso de S2 (38)**, então em S2 ele exige revisão dirigida e nunca é a escolha para S3. Reserve Sol e `gpt-6-astra` para fronteira de segurança e dado de produção. <!-- aposentado-ok -->
- `-s workspace-write` limita a escrita ao diretório de trabalho e `/tmp`. **Nunca usar** `--dangerously-bypass-approvals-and-sandbox`.
- `--skip-git-repo-check` evita o prompt de confiança. O `config.toml` marca como confiável `/home/cmoraya/Documentos/Projetos/Beta-fleet` (maiúsculas), que **não** corresponde ao caminho real minúsculo em Linux.
- Rodar sempre em segundo plano com log em arquivo: a execução passa dos 10 minutos.

**Retomar uma sessão (ciclo de correção)** — sintaxe verificada em 2026-09-07:

```bash
codex exec -s workspace-write --skip-git-repo-check \
  resume <SESSION_ID> -c model_reasoning_effort="high" - < session/correcao.txt \
  > session/codex-run-2.log 2>&1
```

⚠️ **As opções de `exec` vêm ANTES do subcomando `resume`.** Escrever `codex exec resume --last -s workspace-write ...` falha com `error: unexpected argument '-s' found` e **nada é executado**. O `resume` aceita apenas `[SESSION_ID]`, `[PROMPT]`, `-c`, `--last` e `--all`.

O `SESSION_ID` sai do cabeçalho do log da execução original (`session id: <uuid>`). Preferir o id explícito a `--last`, que pode apanhar outra sessão se houver execuções concorrentes.

⚠️ **Código de saída não é evidência de execução.** Num caso real, o Codex recusou o argumento e saiu, mas o wrapper do bash devolveu `exit 0` e a notificação de conclusão chegou como sucesso. Só o `git status` revelou que nada havia sido feito. **Sempre confirmar por `git status` e pelo cabeçalho do log** antes de revisar ou reportar resultado.

### 4.2 opencode

```
Binário:        /home/cmoraya/.npm-global/bin/opencode
Autenticação:   assinatura (Opencode Zen / Opencode Go)
Custo marginal: zero
Acionável:      SIM — subcomando `run`
Tier:           A / B / C — cobre todos, conforme o modelo escolhido
```

**530 modelos disponíveis** (`opencode models`), incluindo família Claude, GPT, Gemini, DeepSeek, GLM e modelos próprios do Zen.

Comando canônico:

```bash
opencode run -m opencode/<modelo> --format json "<prompt>" > session/opencode-run.log 2>&1
```

Notas operacionais:
- `-c` / `--session <id>` retoma sessão; `--fork` bifurca antes de continuar.
- `--format json` produz eventos crus, mais fáceis de auditar que a saída formatada.
- `--agent` seleciona agente configurado; `--pure` roda sem plugins externos.
- `opencode models` lista o catálogo completo; `opencode stats` mostra consumo.

#### Modelos GRATUITOS — custo zero absoluto

> ⚠️ **Corrigido em 2026-09-11.** Este documento afirmava que o provider expunha **31 modelos gratuitos**, número lido de `~/.cache/opencode/models.json`. Esse arquivo está **defasado**. O comando `opencode models`, que é a fonte de verdade sobre existência, lista **7**. Vinte e quatro dos modelos antes documentados — incluindo `deepseek-v4-flash-free`, `minimax-m3-free` e `grok-code` — **não existem mais**. Recomendar qualquer um deles produz um disparo que falha.

São o **Tier C canônico**: custo zero absoluto, não apenas marginal. Todos suportam `tool_call`.

| Slug | Saída máx. | AAII | Grau máximo | Origem da nota |
|---|---|---|---|---|
| **`muse-spark-1.3-contributor-free`** | 131.072 | **48** | **S3** | Linha "Muse Spark 1.3" no AA. O único gratuito que alcança S3 |
| **`muse-spark-1.2-contributor-free`** | 131.072 | — | por histórico | **Disponível no parque** (`opencode models`, 2026-09-12). O que falta é a **nota**: ausente do índice do AA desde a coleta de 11/09. Tem o maior histórico de campo do parque |
| `nemotron-3-ultra-free` | 128.000 | **23** | **D1** | Linha "Nemotron 3 Ultra" no AA. Só transcrição pura |
| `nemotron-3.5-lightning-free` | 65.536 | **14** | — | Abaixo de D1. **Não elegível a etapa nenhuma** |
| `ling-3.0-flash-fin-free` | 32.768 | — | — | O AA publica `Ling 3.0 Flash` (25); a variante `-fin` é outro modelo. Não confirmado |
| `mimo-v2.5-free` | 32.000 | — | — | O AA publica `MiMo V2.5` (22); o slug gratuito não foi confirmado como o mesmo modelo |
| **`big-pickle`** | **32.000** | — | por histórico | Sem nota pública em fonte alguma. **Único com histórico longo neste projeto** |

> ⚠️ **O par Muse Spark exige atenção.** A `1.2` é quem tem o histórico (dezenas de registros neste projeto); a `1.3` é quem tem a nota (48). Pela ordem de consulta do `MODEL_SELECTION.md`, **a camada 1 vence**: em combinação com 4+ registros, use a `1.2` e justifique pelo histórico. A `1.3` é a escolha quando o histórico não resolver, ou quando a etapa for S2/S3 e for preciso um número para sustentá-la.

> ⚠️ **Limite de saída importa mais do que parece.** `big-pickle` e `mimo-v2.5-free` têm teto de **32k**. Para etapas que criam muitos arquivos de uma vez, preferir `muse-spark-1.2`/`1.3` (131k) ou `nemotron-3-ultra-free` (128k). A regra do teto de saída tem precedência sobre piso **e** sobre histórico.

> ⚠️ **"Ausente do índice" ≠ "ausente do parque". Não confundir — já aconteceu.**
> **Ausente do índice**: o AA não publica nota para o modelo. Ele **existe e pode ser disparado**; entra por histórico ou por estreia disciplinada. Fonte: `docs/model-cache.md`.
> **Ausente do parque**: `opencode models` não lista o modelo. Ele **não existe para este projeto** e recomendá-lo produz um disparo que falha. Fonte: o comando, nunca o cache local.
> As duas colunas de "indisponível" que este documento trazia até 2026-09-12 falavam da **nota** e foram lidas como se falassem do **modelo** — a confusão chegou a ser registrada como erro factual na observação do #047, que também foi corrigida. Ao escrever "indisponível", diga sempre *o que* está indisponível.

**Modelo sem nota no AAII** entra por dois caminhos apenas — histórico ou estreia disciplinada em D1/D2. Procedimento completo em `docs/MODEL_SELECTION.md`, Passo 4. **Nunca estimar por proximidade de nome ou de família:** `muse-spark-1.2` e `1.3` custam exatamente o mesmo ($1,25/$4,25) e ainda assim só uma delas tem nota.

**Evidência disponível por modelo:**

> As duas colunas abaixo respondem perguntas **diferentes**. "Nota AAII" diz se o Artificial Analysis publica um número para o modelo. "No parque" diz se o modelo existe e pode ser disparado. Um modelo pode estar no parque sem ter nota — é o caso dos dois primeiros.

| Modelo | Nota AAII | No parque (`opencode models`, 2026-09-12) | Experiência de campo |
|---|---|---|---|
| `big-pickle` | **sem nota publicada** | **sim** | **sim** — uso recorrente, registros no track record |
| `muse-spark-1.2-contributor-free` | **sem nota desde a coleta de 11/09** | **sim** | **sim** — registros no track record |
| `muse-spark-1.3-contributor-free` | 48 | **sim** | 1 registro (#047, estreia em 2026-09-12) |
| demais 4 gratuitos | 2 com nota, 2 sem | **sim** | nenhuma |

#### Modelos pagos do catálogo (assinatura, custo marginal zero)

| Modelo | Tier | Evidência |
|---|---|---|
| `opencode/claude-opus-5` | A | **AAII 51** (`model-cache.md`, coleta de 11/09) |
| `opencode/claude-fable-5` | A/B | **AAII 50** — alcança S3 |
| `opencode/deepseek-v4-pro` | B/C | licença MIT; **sem linha própria no AA nesta coleta** |

### 4.3 claude — Claude Code

```
Binário:        /home/cmoraya/.npm-global/bin/claude
Autenticação:   assinatura
Custo marginal: zero (dentro da cota)
Acionável:      SIM — `-p/--print`
Tier:           A / B
```

```bash
claude -p --model <modelo> --output-format stream-json "<prompt>"
```

Notas:
- É a ferramenta onde o agente planejador roda. Usar `-p` para executor separado, ou a ferramenta `Agent` para subagentes no mesmo processo.
- Subagentes internos só rodam modelos Anthropic. Para executar em modelo OpenAI, usar `codex` ou `opencode`.

### 4.4 pi

```
Binário:        /home/cmoraya/.npm-global/bin/pi
Acionável:      SIM — `-p/--print`
Tier:           C (também alcança A/B, via provider)
```

Configuração ativa em `~/.pi/agent/settings.json` (2026-09-07):

```json
{ "defaultModel": "big-pickle", "defaultProvider": "opencode", "defaultThinkingLevel": "high" }
```

Providers autenticados (`~/.pi/agent/auth.json`):
`opencode` · `opencode-go` · `openai-codex` · `openrouter` · `anthropic` · `google`

```bash
pi -p --provider opencode --model big-pickle "<prompt>"
```

Notas:
- **O `pi` já roda por padrão o `big-pickle` do opencode com thinking `high`.** Ou seja, é uma segunda porta para o mesmo Tier C gratuito — útil quando se quer um executor com sessão e sistema de prompt separados do `opencode run`.
- Tem ferramentas de `read`, `bash`, `edit` e `write` — qualifica como executor de verdade, não só chat.
- `--append-system-prompt` aceita **caminho de arquivo**: é a forma canônica de injetar o guardrail sem inflar o prompt principal.
- Aceita `--mode text|json|rpc`, `--continue`, `--resume`, `--session <path|id>`.
- Atenção: existe um `~/.pi/config.json` legado apontando para `ollama/deepseek-coder:6.7b`. As configurações efetivas do agente estão em `~/.pi/agent/settings.json`.

### 4.6 ollama — modelos locais

```
Binário:        /usr/local/bin/ollama
Custo marginal: zero absoluto (computação local, sem rede)
Acionável:      SIM — via `pi --provider ollama`
Tier:           abaixo de C — não recomendado como executor
```

Modelos presentes (2026-09-07): `qwen3.5` (6,6 GB), `bonsai-27b:Q1_0` (4,4 GB), `glm-ocr` (2,2 GB), `lfm2.5-thinking` (731 MB), mais três apontadores `:cloud` (`minimax-m2.5`, `minimax-m2.7`, `glm-5.1`) que **não** são locais.

**Não usar como executor de plano.** Os modelos locais aqui são pequenos demais para seguir um guardrail com manifesto de arquivos e transcrever casos de teste sem desvio — o retrabalho recairia sobre o agente revisor, que é o recurso escasso. Registrado apenas para completude do parque. Se algum dia for testado, entra pela regra de reabilitação do track record, em etapa `Delegável` de risco mínimo.

### 4.5 freebuff

```
Binário:        /home/cmoraya/.npm-global/bin/freebuff
Custo marginal: zero (gratuita)
Acionável:      NÃO — sem modo não-interativo
Tier:           C — execução manual pelo usuário
```

O `--help` expõe apenas `login`, `--continue [id]`, `--cwd <dir>` e `--version`. Não há flag de prompt por argumento nem modo de impressão.

> ⛔ **FORA DE USO desde 2026-09-08.** O fluxo desta ferramenta exigia o usuário rodando o comando no terminal, e o modelo de execução vigente (`agent/AGENT.md` §4) determina que o usuário não executa nada. Sem modo não-interativo, ela não pode ser acionada pelo agente orquestrador. **Não recomendar em plano nenhum** enquanto não expuser um modo de prompt por argumento ou stdin. Registro mantido apenas para completude do parque e para o caso de uma versão futura resolver isso.

---

## 5. Tabela de decisão

> **Quem dispara é sempre o agente planejador** (`agent/AGENT.md` §4). A coluna permanece na tabela para tornar a regra visível, não porque exista alternativa.

| Grau da etapa | Piso AAII | Tier | Ferramenta preferida | Quem dispara |
|---|---|---|---|---|
| **D1** — transcrição pura, entrega pequena (≤ 5 arquivos) | 23 | C | `opencode run -m opencode/big-pickle` | agente planejador |
| **D1/D2** — entrega volumosa (> 5 arquivos) | 23 / 30 | C | `opencode run -m opencode/muse-spark-1.2-contributor-free` — teto 131k, escolha por histórico | agente planejador |
| **D1/D2** — alternativa com sessão própria | 23 / 30 | C | `pi -p --provider opencode --model big-pickle` | agente planejador |
| **S1** — transcrição supervisionada | 35 | B | `codex exec -m gpt-5.6-luna -c model_reasoning_effort="medium"` | agente planejador |
| **S2** — supervisionado comum, janela folgada | 38 | B | `codex exec -m gpt-5.6-luna -c model_reasoning_effort="medium"` — AAII 38, **no limite exato do piso** | agente planejador |
| **S2** — supervisionado comum, **janela apertada** | 38 | B/C | `opencode run -m opencode/muse-spark-1.2-contributor-free` (histórico) ou `.../muse-spark-1.3-contributor-free` (AAII 48) | agente planejador |
| **S3** — alto risco | 45 | A | `codex exec -m gpt-6-astra` (53), `codex exec -m gpt-5.6-sol` (47) ou `opencode run -m opencode/claude-opus-5` (51) | agente planejador |
| **N** — não delegável | sem piso | — | — | agente planejador escreve |

> **Sobre `gpt-5.6-sol`:** era o default recomendado para `Supervisionado` até 2026-09-08. Saiu do papel de default porque queima janela desproporcionalmente ao ganho em etapa de transcrição. Com AAII 47, é uma das opções legítimas de **S3**. Continua disponível via `codex exec` sem `-m` (é o default do `config.toml`) — em S1/S2, use-o apenas com razão citada na justificativa.

> ⚠️ **Não existe mais "Supervisionado sem gratuito apto".** Com o parque atual, `muse-spark-1.3-contributor-free` (AAII 48) alcança **todos** os graus, inclusive S3. A linha antiga que autorizava "qualquer gratuito com teto suficiente, com revisão linha a linha" **foi removida** em 2026-09-11: ela era um atalho para usar modelo abaixo da barra, e hoje é desnecessária. Modelo abaixo do piso do grau não entra, ponto.

**Critério de desempate dentro do Tier C:** vale a ordem de consulta do `MODEL_SELECTION.md` — **histórico primeiro**. Com 4+ registros na combinação, preferir `big-pickle` ou `muse-spark-1.2-contributor-free`, que são os dois com evidência real neste projeto, e justificar pelo registro. Sem histórico suficiente, decidir pelo AAII, o que hoje aponta para `muse-spark-1.3-contributor-free` (48). Acima de 5 arquivos, o teto de 32k do `big-pickle` é risco concreto — subir para um de 131k.

**Regra de economia — reescrita em 2026-09-08.** A versão anterior dizia que, em regime, o usuário rodava as etapas `Delegável` com o comando pronto e chamava o agente só na revisão. **Isso não vale mais:** o usuário não executa nada (`agent/AGENT.md` §4), e o custo de orquestração deixou de ser opcional — cada etapa delegada consome tokens do agente no disparo, na leitura do log e na revisão, além da janela do executor.

A economia migra para outro lugar: **fechar a especificação até o ponto em que um ciclo baste.** Manifesto exaustivo, código transcrito e assertivas literais não são burocracia — são o que evita o segundo disparo, que é onde o custo de orquestração dobra. Etapa delegada com spec frouxa é hoje o arranjo mais caro do projeto, porque soma a janela do executor ao retrabalho do orquestrador.

---

## 6. Profundidade de revisão obrigatória

| | Tier A/B | Tier C |
|---|---|---|
| **Delegável** | Portão | Revisão dirigida |
| **Supervisionado** | Revisão dirigida | Linha a linha |
| **Não delegável** | — | — |

**Portão** — reexecutar `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run test:smoke` e comparar com o baseline gravado no plano; conferir `git status --short` contra o manifesto de arquivos.

**Revisão dirigida** — portão + leitura integral de **todos os testes novos**, com olhar adversarial (mock que anula o alvo? asserção que passa sozinha? caso do plano ausente?) + leitura dos arquivos criados.

**Linha a linha** — portão + diff completo de tudo que mudou.

**Regra absoluta em qualquer célula:** nunca aceitar o relatório do executor como evidência. Sempre reexecutar.

---

## 7. `plan-runner` — a parte mecânica da execução

`scripts/plan-runner.mjs` (criado e validado em 2026-09-08) executa e verifica uma etapa **sem gastar tokens do agente orquestrador**. É script, não modelo: `git status` e contagem de teste são determinísticos, e um modelo resumindo log pode reportar sucesso onde houve falha — inclusive o caso real registrado em §4.1, do codex devolvendo `exit 0` sem ter executado nada.

```bash
node scripts/plan-runner.mjs snapshot        # UMA VEZ, antes da primeira etapa
node scripts/plan-runner.mjs run <etapa>     # dispara, destila log, escopo, portão, veredito
node scripts/plan-runner.mjs run <etapa> --skip-executor   # etapa escrita à mão
node scripts/plan-runner.mjs gate            # só o portão
node scripts/plan-runner.mjs scope <etapa>   # só o escopo
```

Config por sessão em `scripts/plan-runner.config.json`: baseline numérico +, por etapa, `command`, `log`, `create[]`, `modify[]`. Gerar a partir do manifesto do `IMPLEMENTATION.md`.

O que ele faz, em ordem: dispara o executor → destila o log (linhas suspeitas + cauda, em vez do arquivo inteiro) → compara `git status` com o manifesto da etapa → roda `tsc`/`lint`/`unit`/`smoke` → compara com o baseline → emite veredito. Saída de processo: `0` passou, `2` reprovado.

> ⚠️ **`snapshot` não é opcional.** Este repositório carrega mais de 100 arquivos sujos sem relação com o plano (medido em 2026-09-08: 112). Sem o snapshot prévio, a checagem de escopo acusa violação em tudo e vira ruído.

**O que ele NÃO faz, e não deve tentar fazer:** revisão de código. Portão verde não é aprovação — significa apenas que a etapa pode ir para a revisão de verdade, na profundidade que a tabela do §6 define. A Regra 13 dos prompts continua valendo: relatório não é evidência.

---

## 8. Manutenção deste arquivo

Atualizar quando:

1. Uma ferramenta for instalada, removida ou mudar de sintaxe
2. O usuário mudar de plano/assinatura, alterando o custo marginal
3. Um comando aqui registrado falhar na prática — corrigir e datar

Os comandos desta versão foram verificados em 2026-09-07 executando `--help` de cada binário. Não registrar comando não verificado.
