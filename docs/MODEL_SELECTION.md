# MODEL_SELECTION.md

**Última atualização:** 2026-09-07
**Propósito:** protocolo para o agente planejador escolher **qual executor roda cada etapa** de um `IMPLEMENTATION.md` ou `IMPLEMENTATION_FIXBUG.md`.
**Idioma de operação:** Português do Brasil.

---

## 0. O que mudou nesta versão — leia antes de usar

A versão anterior ranqueava modelos por **preço `$/M`** e produzia **3 sugestões para o plano inteiro**. Ambas as coisas estavam erradas para este projeto:

1. **O usuário não paga por token em nenhuma ferramenta.** Todas são assinatura fixa ou gratuitas. Ranquear por `$/M` otimizava uma variável inexistente no orçamento — e por isso recomendava Opus 5 e GPT-5.6 Sol para tarefas que um modelo gratuito resolve.
2. **A escolha de executor é por etapa, não por plano.** Um mesmo `IMPLEMENTATION.md` costuma ter etapas triviais (arquivos novos, lógica pura) e etapas que tocam produção. Uma recomendação única força o pior dos dois mundos: caro demais para as fáceis, ou arriscado demais para as difíceis.

O eixo de custo agora é **custo real para este usuário**, e a saída é **uma tabela por etapa**.

---

## 1. Ordem de consulta — obrigatória

Consulte nesta ordem e pare no primeiro que resolver:

| # | Arquivo | O que responde |
|---|---|---|
| 1 | `docs/EXECUTOR-TRACK-RECORD.md` | Como cada executor **realmente se saiu** nesta combinação (classe + forma) neste projeto |
| 2 | `docs/EXECUTORS.md` | Qual ferramenta/modelo existe, comando exato, custo real, quem dispara |
| 3 | `docs/model-cache.md` | Benchmark público — usado **só para aptidão**, nunca para custo |

**Regra de precedência:** com **4 ou mais registros** na mesma combinação, o track record manda e o benchmark é ignorado. Com menos, declare "amostra insuficiente" e decida por benchmark, citando os registros existentes como indício.

**Nunca acesse a web** se os três arquivos locais bastarem.

---

## 2. Fontes de benchmark — só para aptidão

Estas fontes seguem válidas para julgar **capacidade relativa** entre modelos catalogados. Os campos de preço delas são irrelevantes para a decisão de executor neste projeto.

### 2.1 Fontes primárias

| Fonte | URL exata para fetch | O que aproveitar aqui |
|---|---|---|
| **Artificial Analysis** | `https://artificialanalysis.ai/leaderboards/models` | Índice de qualidade, velocidade (t/s), janela de contexto, licença |
| **Vellum AI** | `https://vellum.ai/llm-leaderboard` | SWE-Bench (coding real), GPQA Diamond, HLE |

### 2.2 Contraprova

| Fonte | URL | Papel |
|---|---|---|
| **OpenRouter** | `https://openrouter.ai/api/v1/models` | Disponibilidade e janela de contexto; preencher lacunas |
| **Hugging Face** | `https://huggingface.co/api/models/<org>/<repo>` | Licença declarada e existência pública dos pesos |

### 2.3 Referência manual

**LMSYS Chatbot Arena** (`https://lmarena.ai`) — Elo por votação humana cega. É SPA pesada e não renderiza por fetch automatizado; consultar manualmente quando o usuário questionar um ranking.

> **Precedência em conflito de valores:** documentação oficial do provedor > primárias > terciária. Divergência não resolvida fica registrada no cache. **Nunca inventar número** — "—" é resposta válida.

> **Limite conhecido e relevante:** a maioria dos 31 modelos gratuitos do opencode **não é catalogada em fonte nenhuma**, incluindo o `big-pickle`. Para eles, benchmark não existe e o `EXECUTOR-TRACK-RECORD.md` é a única evidência possível. Não fabricar métrica para preencher a lacuna.

---

## 3. Como usar — passo a passo

### Passo 1 — Classificar a delegabilidade de cada etapa

Não classifique o plano inteiro. Classifique **cada etapa**:

| Classe | Critério | Executor |
|---|---|---|
| **Delegável** | Só arquivos novos; lógica pura, apresentação ou testes transcritos; sem banco; sem fronteira de segurança | Tier C |
| **Supervisionado** | Edita arquivo existente; integra módulos já em produção; altera contrato consumido por outro módulo | Tier A ou B |
| **Não delegável** | Migration com dado real; correção de dado em produção; fronteira de tenant/auth/RLS | Agente planejador escreve |

Na dúvida entre duas classes, **suba** para a mais restritiva.

### Passo 2 — Verificar as condições da especificação

Uma etapa só é `Delegável` de fato se o plano der ao executor o que ele precisa para não decidir nada:

- [ ] **Manifesto de arquivos** — lista exaustiva do que ele pode criar e modificar
- [ ] **Casos de teste literais** — assertivas concretas (`entrada X → saída Y`), não descrições vagas
- [ ] **Baseline numérico** gravado no plano

**Se algum item faltar, a etapa não é `Delegável`** — independentemente de quão simples pareça. Sem manifesto não há verificação mecânica de escopo; sem casos literais o executor escreve testes que confirmam a própria interpretação.

Essa é a peça mais importante do protocolo. Modelo gratuito com especificação frouxa é o arranjo mais caro de todos, porque o retrabalho recai sobre o agente revisor — o recurso escasso.

### Passo 3 — Consultar o track record

Para cada etapa, buscar registros com a **mesma classe e a mesma forma** (`lógica pura`, `componente de UI`, `edição em arquivo existente`, `migration`, `integração externa`, `teste`, `configuração`).

- **≥ 4 registros** → o histórico decide. Escolher o de menor custo real com melhor desempenho.
- **< 4 registros** → declarar "amostra insuficiente" e seguir para o Passo 4.

### Passo 4 — Selecionar por custo real, dentro da aptidão

Ordem de preferência, sempre **de cima para baixo**, parando no primeiro que atende à aptidão da classe:

| Ordem | Categoria | Exemplos |
|---|---|---|
| 1º | **Custo zero absoluto** — não consome cota | 31 modelos `(Free)` do opencode; `freebuff` |
| 2º | **Custo marginal zero** — assinatura já paga, consome cota | `codex`/`gpt-5.6-sol`; `claude`; modelos pagos do opencode |
| 3º | **Custo por token** | nenhum configurado hoje |

Aptidão mínima por classe:

| Classe | Aptidão exigida |
|---|---|
| Delegável | Suporta `tool_call` **e** teto de saída compatível com o volume da etapa |
| Supervisionado | Benchmark forte em coding (SWE-Bench alto ou qualidade AA ≥ 55) |
| Não delegável | — |

**Regra anti-overkill:** um modelo mais forte só entra se houver razão objetiva **citada na justificativa** — fronteira de segurança, dado de produção, margem nula para retrabalho, benchmark fraco no tipo de tarefa, ou contexto/saída insuficientes. "Por precaução" não é razão.

**Regra do teto de saída:** verificar `limit.output` do modelo contra o volume estimado da etapa. Um modelo com teto de 32k não deve receber etapa que gera mais de ~5 arquivos. Este critério tem precedência sobre o histórico — nem o melhor track record salva um executor que não consegue emitir a entrega inteira.

### Passo 5 — Definir a profundidade de revisão

Não é julgamento do momento; é tabela:

| | Tier A/B | Tier C |
|---|---|---|
| **Delegável** | Portão | **Revisão dirigida** |
| **Supervisionado** | Revisão dirigida | **Linha a linha** |

**Portão** — reexecutar `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run test:smoke`; comparar com o baseline; conferir `git status --short` contra o manifesto.

**Revisão dirigida** — portão + leitura integral de **todos os testes novos** com olhar adversarial (mock que anula o alvo? asserção que passa sozinha? caso do plano ausente?) + leitura dos arquivos criados.

**Linha a linha** — portão + diff completo.

**Regra absoluta:** nunca aceitar o relatório do executor como evidência. Sempre reexecutar.

### Passo 6 — Produzir a saída

Formato exato:

```
Distribuição de execução por etapa
Consulta: EXECUTOR-TRACK-RECORD.md (N registros na combinação) · EXECUTORS.md · model-cache.md (cache de YYYY-MM-DD)

| Etapa | Classe | Forma | Tier | Executor | Custo | Revisão | Quem dispara |
|-------|--------|-------|------|----------|-------|---------|--------------|
| ...   | ...    | ...   | ...  | ...      | ...   | ...     | ...          |

Comandos prontos:
  Etapa N: <linha de comando exata, copiada do EXECUTORS.md>

Justificativas:
  Etapa N: [1-2 linhas citando a evidência usada — registro do track record, benchmark
            específico do model-cache, ou declaração explícita de amostra insuficiente.
            Deve citar o domínio concreto da etapa, não termos genéricos.]

Condições da spec: manifesto=[sim/não] · testes-literais=[sim/parcial/não] · baseline=[sim/não]
[Se alguma condição faltar: apontar quais etapas foram rebaixadas de Delegável por isso.]
```

---

## 4. Critérios de exclusão

Descarte qualquer modelo que se enquadre em:

- **Sem `tool_call`** — não consegue editar arquivos; serve para consulta, não para execução
- **Teto de saída insuficiente** para o volume da etapa
- Marcado como **deprecated** em qualquer fonte
- **Preview/Beta sem SLA** — permitido apenas em etapas `Delegável`

> **Sobre licença:** o critério "Non-Commercial" da versão anterior não se aplica aos modelos acessados **via assinatura do opencode** — nesse caminho o uso é regido pelos termos do opencode, não pela licença dos pesos. O critério continua valendo para modelos usados por API direta ou pesos locais.

---

## 5. Quando atualizar o cache de benchmarks

Atualizar `docs/model-cache.md` apenas quando:

1. O arquivo não existe
2. A data em `Próxima atualização obrigatória:` já passou
3. O usuário pede explicitamente
4. **Uma etapa `Supervisionado` ou `Não delegável` depende de aptidão de um modelo ausente do cache**

O item 4 é novo e existe por causa de um caso real: em 2026-09-07 o cache de 22/08 desconhecia o `gpt-6-astra`, que já estava disponível na conta do usuário, e a recomendação saiu incompleta. Para etapas `Delegável` isso não importa — a decisão ali é por custo real e track record, não por benchmark.

---

## 6. Formato do arquivo de cache

```markdown
# Model Cache
Atualizado em: YYYY-MM-DD
Fontes: Artificial Analysis (artificialanalysis.ai) + Vellum AI (vellum.ai) · Contraprova: OpenRouter (openrouter.ai) + Hugging Face (huggingface.co)
Próxima atualização obrigatória: YYYY-MM-DD

| Modelo | Provedor | Qualidade (AA) | SWE-Bench | GPQA | HLE | Input $/M | Output $/M | Blended (AA) | Velocidade (t/s) | Contexto | Saída máx. | Licença |
|--------|----------|---------------|-----------|------|-----|-----------|------------|--------------|------------------|----------|------------|---------|
```

**Legenda:**
- Qualidade (AA): Intelligence Index do Artificial Analysis (maior = melhor)
- SWE-Bench: % de issues reais de GitHub resolvidos
- GPQA: % em perguntas de pós-graduação
- HLE: % no Humanity's Last Exam
- **Saída máx.:** teto de tokens de saída — campo obrigatório, usado pela regra do Passo 4
- Input/Output $/M: mantidos por completude e para comparação externa; **não usados na seleção de executor deste projeto**
- "—" = dado não disponível em nenhuma fonte segura (nunca inventar)

---

## 7. Registro obrigatório após a execução

Toda execução delegada **deve** gerar um registro em `docs/EXECUTOR-TRACK-RECORD.md`, escrito no momento da revisão, com atribuição explícita de falha (`falha do modelo` / `falha do plano` / `ambiguidade genuína`).

Sem esse registro o protocolo não aprende, e a escolha de executor fica presa em benchmark genérico para sempre.
