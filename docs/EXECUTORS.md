# EXECUTORS.md

**Última atualização:** 2026-09-07
**Propósito:** parque real de agentes de código disponíveis nesta máquina, com o comando exato de invocação de cada um. É a fonte única que traduz **tier** (usado nos planos) em **ferramenta + modelo + comando**.
**Idioma de operação:** Português do Brasil.

---

## 1. Por que este arquivo existe

Planos (`IMPLEMENTATION.md` / `IMPLEMENTATION_FIXBUG.md`) **nunca** citam nome de modelo. Citam apenas o **tier**. O mapeamento tier → ferramenta vive só aqui.

Motivo: nome de modelo apodrece. Em 2026-09-07 o `docs/model-cache.md` (de 22/08) já desconhecia o `gpt-6-astra`, que já estava disponível na conta do usuário. Um plano escrito com nome fixo já nasceria defasado. Com tier, trocar de ferramenta é editar **este** arquivo, e todos os planos continuam válidos.

---

## 2. Custo marginal — o que realmente importa aqui

**O usuário não paga por token em nenhuma das ferramentas.** Todas são assinatura fixa ou gratuitas. Portanto o preço `$/M` publicado nos leaderboards é irrelevante para a decisão de qual executor usar; serve apenas para julgar aptidão relativa entre modelos que têm benchmark.

O recurso escasso real, em ordem de escassez:

1. **Tokens do agente planejador/revisor** (Claude Code) — consumidos na especificação e na revisão. É o gargalo.
2. **Cota das assinaturas** — finita, mas raramente atingida em uma sessão.
3. **Tempo do usuário** — supervisão interativa e retrabalho.

Há duas categorias distintas de "zero", e a diferença importa quando a cota aperta:

- **Custo marginal zero** — assinatura fixa já paga (codex, claude, modelos pagos do opencode). Consome cota.
- **Custo zero absoluto** — os 31 modelos `(Free)` do opencode, a `freebuff` e o `ollama` local. **Não consomem cota nenhuma.**

Consequência prática: **executor com custo zero absoluto é sempre a primeira escolha, desde que atenda à aptidão mínima da classe da etapa.** Um executor que falha não é barato — o retrabalho cai no recurso nº 1.

---

## 3. Tiers

| Tier | Quando usar | Aptidão exigida |
|---|---|---|
| **A — máxima** | Etapas `Supervisionado` de alto risco: fronteira de tenant/auth, contrato de API, arquivo compartilhado grande | Melhor disponível |
| **B — forte** | Etapas `Supervisionado` comuns: edição em arquivo existente, integração entre módulos | Benchmark forte em coding |
| **C — econômico** | Etapas `Delegável`: arquivos novos, lógica pura, componentes de apresentação, testes transcritos | Suficiente para transcrever especificação fechada |

Etapas `Não delegável` (migration com dado real, correção de dado em produção) não têm tier — são escritas pelo agente planejador.

---

## 4. O parque — comandos verificados em 2026-09-07

Todos os comandos abaixo foram verificados nesta máquina. Os marcados como **acionável** podem ser disparados pelo agente planejador via Bash; os demais exigem que o usuário rode no próprio terminal.

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
| `gpt-6-astra` | "Our most capable model for complex, demanding work"; prioridade 1 |
| `gpt-5.6-sol` | **default do `config.toml`**; usado com sucesso em 2026-09-07 |
| `gpt-5.6-terra` | — |
| `gpt-5.6-luna` | — |
| `gpt-5.5` | — |
| `gpt-5.4-mini` | o mais leve da família |

Comando canônico (prompt por stdin, para não sofrer com aspas):

```bash
codex exec -s workspace-write \
  -c model_reasoning_effort="high" \
  --skip-git-repo-check - < session/codex-prompt.txt \
  > session/codex-run.log 2>&1
```

Notas operacionais:
- `-m <slug>` sobrepõe o modelo; sem ele usa o default do `config.toml` (`gpt-5.6-sol`).
- `-c model_reasoning_effort=` aceita `low|medium|high|xhigh|max|ultra` **sem** alterar o `config.toml`. O default do usuário é `medium`; para etapas `Supervisionado` usar `high` ou acima.
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

Verificado em `~/.cache/opencode/models.json` (2026-09-07): o provider `opencode` expõe 102 modelos, dos quais **31 têm `cost.input = 0` e `cost.output = 0`**. **Todos os 31 suportam `tool_call`**, ou seja, todos qualificam tecnicamente como executor.

São o **Tier C canônico**: custo zero absoluto, não apenas marginal.

Os mais relevantes, ordenados por janela de contexto:

| Slug | Contexto | Saída máx. | Knowledge | Nota |
|---|---|---|---|---|
| `nemotron-3-ultra-free` | 1.000.000 | 128.000 | **2026-02** | knowledge mais recente do pool |
| `mimo-v2-pro-free` | 1.048.576 | 64.000 | 2024-12 | maior contexto |
| `x-preview-f-free` | 1.000.000 | 131.072 | — | "Ox Alpha Free (Unlimited)" |
| `longcat-2.0-free` | 1.000.000 | 131.072 | — | — |
| `grok-code` | 256.000 | 256.000 | — | "Grok Code Fast 1" — especializado em código |
| `north-mini-code-free` | 256.000 | 64.000 | 2025-09-23 | orientado a código |
| `nemotron-3-super-free` | 204.800 | 128.000 | **2026-02** | — |
| `kimi-k2.5-free` | 262.144 | 262.144 | 2024-10 | — |
| `glm-5-free` | 204.800 | 131.072 | 2025-04 | — |
| `minimax-m3-free` | 200.000 | 32.000 | 2025-01 | — |
| **`big-pickle`** | 200.000 | **32.000** | 2025-01 | **validado em campo pelo usuário** |

> ⚠️ **Limite de saída importa mais do que parece.** O `big-pickle` tem teto de **32.000 tokens de saída** — o menor entre os candidatos fortes. Para etapas que criam muitos arquivos de uma vez (a Etapa 3-5 do módulo MELI gerou 12 arquivos, ~36 KB), esse teto pode obrigar o executor a fatiar a entrega ou truncar. Para etapas volumosas, preferir um modelo com 128k+ de saída (`nemotron-3-ultra-free`, `x-preview-f-free`, `glm-5-free`). Para etapas pequenas, o `big-pickle` tem a vantagem de ter histórico real.

**Evidência disponível por modelo:**

| Modelo | Benchmark público | Experiência de campo |
|---|---|---|
| `big-pickle` | **indisponível** — não catalogado em Artificial Analysis nem Vellum | **sim** — uso recorrente do usuário com bom resultado |
| demais 30 gratuitos | **indisponível** para a maioria | nenhuma ainda |

Não inventar métrica para nenhum deles. É exatamente esta lacuna que o `docs/EXECUTOR-TRACK-RECORD.md` existe para preencher.

#### Modelos pagos do catálogo (assinatura, custo marginal zero)

| Modelo | Tier | Evidência |
|---|---|---|
| `opencode/claude-opus-5` | A | Qualidade AA 63 (`model-cache.md`) |
| `opencode/claude-fable-5` | A/B | SWE-Bench 95,0% |
| `opencode/deepseek-v4-pro` | B/C | Qualidade AA 53, licença MIT |

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

**Fluxo para esta ferramenta:** o agente planejador entrega o prompt pronto em `session/`, o usuário roda a `freebuff` no terminal, e o agente planejador entra depois apenas no portão de revisão. É a opção de menor custo absoluto, ao preço de o usuário ficar no laço.

---

## 5. Tabela de decisão

| Classe da etapa | Tier | Ferramenta preferida | Quem dispara |
|---|---|---|---|
| Delegável, entrega pequena (≤ 5 arquivos) | C | `opencode run -m opencode/big-pickle` | usuário (mais econômico) ou agente planejador |
| Delegável, entrega volumosa (> 5 arquivos) | C | `opencode run -m opencode/nemotron-3-ultra-free` — teto de saída 128k | usuário ou agente planejador |
| Delegável, alternativa com sessão própria | C | `pi -p --provider opencode --model big-pickle` | usuário ou agente planejador |
| Delegável, custo zero e sem meu envolvimento | C | `freebuff` | **usuário** — obrigatoriamente |
| Supervisionado comum | B | `codex exec` (default `gpt-5.6-sol`, effort `high`) | agente planejador |
| Supervisionado de alto risco | A | `codex exec -m gpt-6-astra` ou `opencode run -m opencode/claude-opus-5` | agente planejador |
| Não delegável | — | — | agente planejador escreve |

**Critério de desempate dentro do Tier C:** enquanto o `EXECUTOR-TRACK-RECORD.md` não tiver 4 registros na combinação, preferir `big-pickle` — é o único com evidência real, ainda que de campo. Acima de 5 arquivos, o teto de 32k de saída dele passa a ser risco concreto; aí vale um modelo de saída maior mesmo sem histórico, registrando o resultado.

**Regra de economia:** o agente planejador disparar uma etapa `Delegável` é conveniência, não economia — orquestrar consome tokens do recurso mais escasso. Em regime, o usuário roda as `Delegável` com o comando pronto deste arquivo e chama o agente planejador só no portão de revisão.

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

## 7. Manutenção deste arquivo

Atualizar quando:

1. Uma ferramenta for instalada, removida ou mudar de sintaxe
2. O usuário mudar de plano/assinatura, alterando o custo marginal
3. Um comando aqui registrado falhar na prática — corrigir e datar

Os comandos desta versão foram verificados em 2026-09-07 executando `--help` de cada binário. Não registrar comando não verificado.
