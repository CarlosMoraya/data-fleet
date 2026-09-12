# Model Cache
Atualizado em: 2026-09-11
Fonte única de benchmark: **Artificial Analysis** (`https://artificialanalysis.ai/leaderboards/models`)
Contraprova factual (nunca métrica): `opencode models` e `~/.cache/opencode/models.json` (existência real, teto de saída, `tool_call`) · OpenRouter (preço, quando o AA não publica) · Hugging Face (licença)
**Fronteira AAII desta coleta: 53** — GPT-6 Astra (`max`) e Claude Fable 5.1 (`max`)
Próxima atualização obrigatória: 2026-10-11

---

## ⚠️ Reescala do índice — leia antes de comparar com qualquer número antigo

Entre a coleta de 2026-08-22 e esta, o Artificial Analysis **reescalou o Intelligence Index**. A queda é de 12 a 17 pontos e **não é uniforme** — modelos trocaram de posição relativa entre si.

| Modelo | AAII em 22/08 | AAII em 11/09 | Δ |
|---|---|---|---|
| Claude Opus 5 | 63 | 51 | −12 |
| Claude Fable 5 | 62 | 50 | −12 |
| GPT-5.6 Sol | 61 | 47 | −14 |
| GLM-5.3 | 60 | 45 | −15 |
| Kimi K3 | 60 | 44 | −16 |
| GPT-5.6 Terra | 57 | 42 | −15 |
| Claude Sonnet 5 | 55 | 38 | −17 |
| GPT-5.6 Luna | 52 | 38 | −14 |
| DeepSeek V4 Flash | 52 | 35 | −17 |
| MiniMax M3 | 45 | 30 | −15 |
| Nemotron 3 Ultra | 38 | 23 | −15 |

**Consequência de protocolo:** um número de AAII só tem significado junto com a data da coleta. Nunca comparar nota desta tabela com nota citada em documento anterior a 2026-09-11 — inclusive os registros do `docs/EXECUTOR-TRACK-RECORD.md`, onde as notas antigas são fato histórico e não devem ser convertidas.

**Consequência de método:** foi esta reescala que aposentou a ancoragem dos pisos por fração da fronteira. Sonnet 5 valia 87% da fronteira e passou a valer 72%; Luna valia 83% e passou a valer 72%. Fração não preserva quem qualifica para quê. Os pisos passam a ser ancorados em **modelos de referência nomeados** — ver abaixo.

---

## Tabela principal

O AA passou a apresentar modelos de raciocínio por nível de esforço (`max`, `xhigh`, `high`). Quando há variantes, esta tabela registra a de maior esforço, que é a condição em que o executor roda.

| Modelo | Provedor | AAII | Input $/M | Output $/M | Velocidade (t/s) | Contexto | Saída máx. | Licença |
|---|---|---|---|---|---|---|---|---|
| GPT-6 Astra (`max`) | OpenAI | **53** | — | — | 54 | 1M | 128.000 | Fechado |
| Claude Fable 5.1 (`max`) | Anthropic | **53** | $10.00 | $50.00 | 67 | 1M | 128.000 | Fechado |
| Claude Opus 5 (`max`) | Anthropic | **51** | $5.00 | $25.00 | 51 | 1M | 128.000 | Fechado |
| Claude Fable 5 | Anthropic | **50** | $10.00 | $50.00 | 66 | 1M | 128.000 | Fechado |
| Muse Spark 1.3 (`max`) | Meta | **48** | $1.25 | $4.25 | 206 | 1.05M | 943.718 | Fechada (só API) |
| GPT-5.6 Sol (`max`) | OpenAI | **47** | $2.00 | $10.00 | 57 | 1.05M | 128.000 | Fechado |
| GLM-5.3 (`max`) | Z.AI | **45** | — | — | 62 | 1M | — | MIT |
| Kimi K3 (`max`) | Moonshot | **44** | $2.30 | $11.55 | 38 | 1.05M | 943.718 | Aberta (custom Moonshot) |
| Grok 4.6 (`high`) | SpaceXAI | **44** | — | — | 55 | 500k | — | Fechado |
| GPT-5.6 Terra (`max`) | OpenAI | **42** | $2.00 | $12.00 | 88 | 1.05M | 128.000 | Fechado |
| Claude Sonnet 5 (`max`) | Anthropic | **38** | $2.00 | $10.00 | 74 | 1M | 128.000 | Fechado |
| GPT-5.6 Luna (`max`) | OpenAI | **38** | $0.20 | $1.20 | 112 | 1.05M | 128.000 | Fechado |
| DeepSeek V4 Flash (`max`) | DeepSeek | **35** | $0.07 | $0.13 | 216 | 1.05M | 384.000 | MIT |
| MiniMax M3 | MiniMax | **30** | $0.30 | $1.20 | 92 | 1.05M | 512.000 | Aberta (MiniMax Community) |
| Ling 3.0 Flash | InclusionAI | **25** | $0.02 | $0.06 | 315 | 262k | 32.768 | MIT |
| Nemotron 3 Ultra | NVIDIA | **23** | $0.63 | $3.13 | 160 | 262k | 32.768 | Não verificada |
| MiMo V2.5 | Xiaomi | **22** | — | — | 52 | 1M | — | MIT |
| Nemotron 3.5 Lightning | NVIDIA | **14** | $0.08 | $0.20 | 283 | 262k | 131.072 | Não verificada |

**Legenda**
- **AAII** — Artificial Analysis Intelligence Index nesta coleta. Maior = melhor. Só comparável a outros números desta mesma coleta.
- **Saída máx.** — teto de tokens de saída. **Campo obrigatório**: alimenta a regra do teto de saída, que tem precedência sobre piso e sobre histórico.
- **Input/Output $/M** — não são orçamento (o usuário não paga por token em ferramenta nenhuma). Servem como desempate de disponibilidade e como proxy de velocidade de queima da janela de 5h.
- `—` — dado indisponível em fonte segura. **Nunca inventar.**

---

## Pisos de AAII por grau da etapa — ancorados em modelo de referência

Cada piso é definido por um modelo cujo comportamento o projeto conhece. O número é **relido** a cada atualização deste arquivo, abrindo o AA e consultando o modelo de referência. Isto substitui a ancoragem por fração da fronteira, aposentada nesta coleta.

| Grau | Caracterização da etapa | **Piso AAII** | Modelo de referência |
|---|---|---|---|
| **D1** — transcrição pura | Só arquivos novos; manifesto fechado; assertivas literais | **23** | Nemotron 3 Ultra |
| **D2** — lógica pura / componente | Arquivo novo, contrato fechado, implementação do executor | **30** | MiniMax M3 |
| **S1** — transcrição supervisionada | Artefato literal do plano fundido em arquivo existente | **35** | DeepSeek V4 Flash |
| **S2** — supervisionado comum | Edição em arquivo existente; integração entre módulos | **38** | **Claude Sonnet 5** |
| **S3** — alto risco | Contrato consumido por outro módulo; arquivo grande em produção | **45** | GLM-5.3 / Kimi K3 |
| **N** — não delegável | Migration com dado real; fronteira de tenant/auth/RLS | **sem piso** | — |

**Por que S2 = 38 e não outro número.** A barra anterior do projeto era `AA ≥ 55`, que na escala antiga correspondia exatamente ao Claude Sonnet 5 e foi validada por 16 execuções registradas. Relendo o mesmo modelo na escala nova: 38. O piso não foi redefinido — foi **traduzido**, preservando quem qualifica.

**Consequência aceita:** Luna e Sonnet 5 convergiram para 38 nesta reescala (antes eram 52 e 55). Luna sobe de S1 para S2. Nenhuma tradução preserva as duas ordenações ao mesmo tempo; escolheu-se preservar a âncora empírica.

**Regra de congelamento:** se um modelo de referência desaparecer do índice — como o Muse Spark 1.2 desapareceu nesta coleta — o piso **congela no último valor conhecido** e a substituição da âncora exige aprovação do usuário. Desaparecimento não move barra em silêncio.

---

## Parque gratuito real — verificado por `opencode models` em 2026-09-11

O provider `opencode` expõe **7 modelos gratuitos**, não os 31 que o `~/.cache/opencode/models.json` ainda lista. O arquivo de cache local está defasado; a fonte de verdade sobre existência é o comando.

| Slug | Saída máx. | AAII | Grau máximo alcançado | Origem da nota |
|---|---|---|---|---|
| `muse-spark-1.3-contributor-free` | 131.072 | **48** | **S3** | Linha "Muse Spark 1.3" no AA. Confirmado por nome |
| `muse-spark-1.2-contributor-free` | 131.072 | — | por histórico | **Ausente do AA nesta coleta.** Ver nota abaixo |
| `nemotron-3-ultra-free` | 128.000 | **23** | **D1** | Linha "Nemotron 3 Ultra" no AA |
| `ling-3.0-flash-fin-free` | 32.768 | — | — | O AA publica `Ling 3.0 Flash` (25); a variante `-fin` é outro modelo. Não confirmado |
| `mimo-v2.5-free` | 32.000 | — | — | O AA publica `MiMo V2.5` (22); o slug gratuito não foi confirmado como o mesmo modelo |
| `nemotron-3.5-lightning-free` | 65.536 | **14** | — | Abaixo de D1. Não elegível a etapa nenhuma |
| `big-pickle` | 32.000 | — | por histórico | Sem nota pública em fonte nenhuma. Entra só pela camada 1 |

**Saíram do parque** (constavam do `EXECUTORS.md` e não existem mais em `opencode models`): `deepseek-v4-flash-free`, `minimax-m3-free`, `grok-code`, `north-mini-code-free`, `glm-5-free`, `kimi-k2.5-free`, `x-preview-f-free`, `longcat-2.0-free`, `mimo-v2-pro-free`.

---

## Modelos sem entrada no Artificial Analysis

Esta seção é obrigatória. Existe para impedir que uma sessão futura confunda **ausência de dado** com **nota baixa**.

- **Muse Spark 1.2** — ausente do índice nesta coleta, embora a **1.3** esteja presente com 48. O procedimento do "gêmeo pago" **não resolve** o caso: `meta/muse-spark-1.2` e `meta/muse-spark-1.3` custam exatamente o mesmo ($1,25/$4,25 no OpenRouter), então o preço não distingue as versões. A 1.2 fica com `—`. **Não herda o 48 da 1.3.**
- **`big-pickle`** — sem catalogação pública em fonte alguma, como sempre foi. É o caso canônico da regra R4(a): entra pelo histórico do `docs/EXECUTOR-TRACK-RECORD.md`, com o piso do grau declarado como referência da exigência, não como critério da escolha.
- **GPT-6 Astra, GLM-5.3, Grok 4.6, MiMo V2.5** — presentes no índice, mas o AA não publicou preço de input nesta coleta.

**Limitação metodológica registrada nesta coleta:** o Artificial Analysis deixou de publicar preço de input para a maior parte dos modelos de raciocínio. O procedimento de confirmação de modelo gratuito por comparação de preço com o gêmeo pago fica, por isso, dependente do OpenRouter como contraprova — caminho que a regra já autoriza, mas que passou de exceção a norma. Quando nem o AA nem o OpenRouter publicarem o preço, a confirmação por gêmeo é **impossível** e o modelo fica com `—`.
