# MODEL_SELECTION.md

**Última atualização:** 2026-09-11
**Propósito:** protocolo para o agente planejador escolher **qual executor roda cada etapa** de um `IMPLEMENTATION.md` ou `IMPLEMENTATION_FIXBUG.md`.
**Idioma de operação:** Português do Brasil.

---

## 0. O que mudou nesta versão — leia antes de usar

A versão anterior ranqueava modelos por **preço `$/M`** e produzia **3 sugestões para o plano inteiro**. Ambas as coisas estavam erradas para este projeto:

1. **O usuário não paga por token em nenhuma ferramenta.** Todas são assinatura fixa ou gratuitas. Ranquear por `$/M` otimizava uma variável inexistente no orçamento — e por isso recomendava Opus 5 e GPT-5.6 Sol para tarefas que um modelo gratuito resolve.
2. **A escolha de executor é por etapa, não por plano.** Um mesmo `IMPLEMENTATION.md` costuma ter etapas triviais (arquivos novos, lógica pura) e etapas que tocam produção. Uma recomendação única força o pior dos dois mundos: caro demais para as fáceis, ou arriscado demais para as difíceis.

3. **Assinatura já paga não é recurso infinito.** *(acrescentado em 2026-09-08)* As ferramentas têm limite de uso por janela de 5 horas, e modelo mais forte queima a janela mais rápido. Tratar "custo marginal zero" como gratuito levava a recomendar o modelo de topo para etapas de transcrição, esgotando a janela antes do fim do plano. O consumo de janela passa a ser critério explícito — ver Passo 4.

4. **Benchmark combinado produzia justificativa ambígua.** *(acrescentado em 2026-09-11)* O protocolo misturava SWE-Bench, GPQA, HLE, Vellum e LMSYS com o índice do Artificial Analysis. Métricas em unidades diferentes não são comparáveis, e a mesma escolha podia ser defendida por duas delas em direções opostas — foi o que aconteceu com o `gpt-5.6-luna`, justificado por uma diferença pequena de SWE-Bench que correspondia a uma diferença grande de índice. Passa a valer **uma fonte só**: o Artificial Analysis Intelligence Index (AAII). E cada etapa passa a declarar o **piso de AAII** exigido pelo seu grau — ver Passo 4. <!-- aposentado-ok -->

O eixo de custo agora é **custo real para este usuário**, e a saída é **uma tabela por etapa**.

---

## 1. Ordem de consulta — obrigatória

A fonte da verdade tem **duas camadas**. Consulte nesta ordem:

| Camada | Arquivo | O que responde |
|---|---|---|
| **1 — histórico real** | `docs/EXECUTOR-TRACK-RECORD.md` | Como cada executor **realmente se saiu** nesta combinação (classe + forma) neste projeto |
| **2 — benchmark** | `docs/model-cache.md` | AAII, para aferir aptidão quando o histórico não resolver |

Dentro da camada 1, a preferência é, nesta ordem: **modelo gratuito** que já executou bem a mesma combinação; na falta dele, o **mais barato** entre os disponíveis nas ferramentas que o usuário já assina.

`docs/EXECUTORS.md` **não é camada de decisão** — é o tradutor de tier → ferramenta + comando, consultado depois que a escolha já foi feita.

**Regra de precedência:** com **4 ou mais registros** na mesma combinação, o histórico manda e o AAII é ignorado *na escolha* — mas o **piso do grau continua sendo declarado** no plano. Com menos de 4, declare "amostra insuficiente" e decida pelo AAII, citando os registros existentes como indício.

**Nunca acesse a web** se os arquivos locais bastarem.

---

## 2. Fonte de benchmark — uma só

O **Artificial Analysis** (`https://artificialanalysis.ai/leaderboards/models`) é a **única** fonte de benchmark público deste projeto. A métrica é o **Artificial Analysis Intelligence Index (AAII)**.

Saíram de uso como critério de decisão, em 2026-09-11: Vellum AI, SWE-Bench, GPQA, HLE e LMSYS/Chatbot Arena. Menções a elas em documentos anteriores a essa data são fato histórico e não devem ser reinterpretadas. <!-- aposentado-ok -->

Permanecem em uso, **exclusivamente como contraprova factual** — nunca como medida de capacidade:

| Fonte | O que responde | O que NÃO responde |
|---|---|---|
| `opencode models` e `~/.cache/opencode/models.json` | Existência real do modelo, teto de saída, `tool_call` | Qualidade |
| OpenRouter (`https://openrouter.ai/api/v1/models`) | Preço, **quando o AA não publicar** | Qualidade |
| Hugging Face | Licença declarada | Qualidade |

> **O comando é mais confiável que o arquivo de cache.** Em 2026-09-11 o `~/.cache/opencode/models.json` listava 31 modelos gratuitos; `opencode models` listava 7. Para existência, vale o comando.

> **Quando o AAII de um modelo não existir, o valor é `—`.** Nunca inventar, nunca estimar por proximidade de nome, nunca herdar de versão vizinha. Caso real: `Muse Spark 1.3` tem nota 48 e `Muse Spark 1.2` está ausente do índice — e as duas custam exatamente o mesmo, de modo que nem o preço as distingue. A 1.2 fica com `—`.

> **Nota de escala.** O AA reescalou o índice entre 22/08 e 11/09/2026, com quedas de 12 a 17 pontos que **não** preservaram a ordem relativa dos modelos. Um número de AAII só significa alguma coisa junto com a data da coleta. Ver o cabeçalho de `docs/model-cache.md`.

---

## 3. Como usar — passo a passo

### Passo 1 — Classificar a delegabilidade de cada etapa

Não classifique o plano inteiro. Classifique **cada etapa**:

| Classe | Grau | Critério | Executor |
|---|---|---|---|
| **Delegável** | **D1** | Só arquivos novos; manifesto fechado; assertivas literais; o executor transcreve, não monta | Tier C |
| **Delegável** | **D2** | Arquivo novo, contrato fechado, mas a implementação é do executor | Tier C |
| **Supervisionado** | **S1** | Artefato literal do plano fundido em arquivo existente | Tier B ou C |
| **Supervisionado** | **S2** | Edita arquivo existente; integra módulos já em produção | Tier A ou B |
| **Supervisionado** | **S3** | Altera contrato consumido por outro módulo; arquivo grande em produção | Tier A |
| **Não delegável** | **N** | Migration com dado real; correção de dado em produção; fronteira de tenant/auth/RLS | Agente planejador escreve |

O **grau** é o que determina o piso de AAII da etapa (Passo 4). A **classe** é o que determina a profundidade de revisão (Passo 5). São eixos distintos: o grau mede a dificuldade do artefato, a classe mede o risco.

Na dúvida entre dois graus, **suba** para o mais restritivo.

### Passo 2 — Verificar as condições da especificação

Uma etapa só é `Delegável` de fato se o plano der ao executor o que ele precisa para não decidir nada:

- [ ] **Manifesto de arquivos** — lista exaustiva do que ele pode criar e modificar
- [ ] **Casos de teste literais** — assertivas concretas (`entrada X → saída Y`), não descrições vagas
- [ ] **Baseline numérico** gravado no plano

**Se algum item faltar, a etapa não é `Delegável`** — independentemente de quão simples pareça. Sem manifesto não há verificação mecânica de escopo; sem casos literais o executor escreve testes que confirmam a própria interpretação.

Essa é a peça mais importante do protocolo. Modelo gratuito com especificação frouxa é o arranjo mais caro de todos, porque o retrabalho recai sobre o agente revisor — o recurso escasso.

### Passo 3 — Consultar o track record (camada 1 da fonte da verdade)

Para cada etapa, buscar registros com a **mesma classe e a mesma forma** (`lógica pura`, `componente de UI`, `edição em arquivo existente`, `migration`, `integração externa`, `teste`, `configuração`).

- **≥ 4 registros** → o histórico decide. Dentro dele, preferir nesta ordem: (a) **modelo gratuito** com bom desempenho na combinação; (b) na falta dele, o **mais barato** entre os disponíveis nas ferramentas já assinadas.
- **< 4 registros** → declarar "amostra insuficiente" e seguir para o Passo 4.

**O piso de AAII do grau é declarado no plano em qualquer um dos dois casos.** Quando a escolha vier do histórico, o piso aparece como *referência da exigência da etapa* e a justificativa cita os registros — não o número. Isto vale inclusive, e principalmente, quando o executor escolhido **não tem nota pública** (caso do `big-pickle`): o plano declara o piso, diz que o modelo não é catalogado, e sustenta a escolha no histórico.

### Passo 4 — Selecionar por custo real, dentro da aptidão

Ordem de preferência, sempre **de cima para baixo**, parando no primeiro que atende à aptidão da classe:

| Ordem | Categoria | Consome janela? | Exemplos |
|---|---|---|---|
| 1º | **Custo zero absoluto** | **Não** | os 7 modelos gratuitos reais do opencode (verificado por `opencode models` em 2026-09-11) |
| 2º | **Custo marginal zero** — assinatura já paga | **Sim** | `codex`; `claude`; modelos pagos do opencode |
| 3º | **Custo por token** | — | nenhum configurado hoje |

#### O eixo que faltava: consumo de janela

> Corrigido em 2026-09-08, a partir de uma restrição declarada pelo usuário. A versão anterior tratava "custo marginal zero" como se fosse gratuito e recomendava o modelo mais forte da assinatura sem hesitar. **É errado.** As assinaturas têm limite de uso por janela de 5 horas, e **quanto mais forte o modelo, mais rápido a janela queima**. Duas etapas com um modelo de topo podem esgotar a janela e travar a sessão inteira — inclusive as etapas que ainda nem começaram.

Regras que decorrem disso:

- **Custo marginal zero não é custo zero.** Ao escolher um executor da categoria 2ª, a justificativa DEVE dizer qual janela ele consome (`codex`/ChatGPT, `opencode`, `claude`) e por que valia gastá-la nesta etapa.
- **Pergunte antes de distribuir quando o plano tiver 3+ etapas delegadas.** Qual janela está apertada muda a tabela inteira. Não presuma.
- **Dentro da mesma janela, prefira o modelo mais barato que atenda à aptidão.** Preço `$/M` continua não sendo critério de orçamento — mas é o **melhor proxy disponível de velocidade de queima da janela**. Um modelo com output $1,20 consome a janela muito mais devagar que um de $20-30. Este é o único uso legítimo de preço neste protocolo.
- **`model_reasoning_effort` é a alavanca mais subestimada.** Raciocínio é onde a janela queima. Em etapa cuja especificação não deixa nenhuma decisão ao executor — manifesto fechado, código transcrito, assertivas literais —, `high` gasta orçamento que não tem onde render. Use `medium` como padrão para `Supervisionado` com spec fechada, e reserve `high` para arquivo grande em produção ou contrato consumido por outro módulo. Isto **substitui** a orientação anterior de `EXECUTORS.md` §4.1 de usar sempre `high` em `Supervisionado`.

#### Piso de AAII por grau — a exigência declarada da etapa

Todo executor precisa, sempre: suportar `tool_call` **e** ter teto de saída compatível com o volume da etapa. Além disso, precisa alcançar o piso do grau:

| Grau | **Piso AAII** | Modelo de referência |
|---|---|---|
| **D1** — transcrição pura | **23** | Nemotron 3 Ultra |
| **D2** — lógica pura / componente | **30** | MiniMax M3 |
| **S1** — transcrição supervisionada | **35** | DeepSeek V4 Flash |
| **S2** — supervisionado comum | **38** | **Claude Sonnet 5** |
| **S3** — alto risco | **45** | GLM-5.3 / Kimi K3 |
| **N** — não delegável | **sem piso** | — |

**Os pisos vivem em `docs/model-cache.md` e são relidos a cada atualização dele.** A tabela acima é cópia de conveniência; em caso de divergência, o cache manda.

**Por que ancoragem por modelo de referência, e não por número fixo nem por fração da fronteira.** Em 2026-09-11 o Artificial Analysis reescalou o índice: quedas de 12 a 17 pontos que **não** preservaram a ordem relativa dos modelos. Piso em número absoluto teria virado uma barra muito mais alta da noite para o dia; piso em fração da fronteira teria mudado silenciosamente quem qualifica. Ancorar em modelo nomeado é o único método que sobrevive a mudança de metodologia: relê-se o modelo, obtém-se o número novo.

**Regra de congelamento:** se um modelo de referência desaparecer do índice, o piso **congela no último valor conhecido** e a troca de âncora exige aprovação do usuário. Desaparecimento não move barra em silêncio.

**O piso mede a exigência da tarefa, não a qualidade do executor.** D1 é baixo de propósito: transcrever manifesto fechado com assertiva literal exige obediência, não inteligência. A evidência do projeto sustenta isso — o `big-pickle`, sem nota pública nenhuma, passou o portão de primeira em execuções repetidas dessa forma.

**Regra anti-overkill:** um modelo mais forte só entra se houver razão objetiva **citada na justificativa** — fronteira de segurança, dado de produção, margem nula para retrabalho, benchmark fraco no tipo de tarefa, ou contexto/saída insuficientes. "Por precaução" não é razão. **"É a assinatura que eu já pago" também não é razão** — ver o eixo de janela acima.

**Regra do teto de saída:** verificar `limit.output` do modelo contra o volume estimado da etapa. Um modelo com teto de 32k não deve receber etapa que gera mais de ~5 arquivos. Este critério tem precedência sobre o histórico — nem o melhor track record salva um executor que não consegue emitir a entrega inteira.

#### Modelo sem nota no AAII — os dois únicos caminhos

A maior parte do parque gratuito não é catalogada pelo Artificial Analysis, e a tentativa de contornar isso por preço do gêmeo pago **deixou de funcionar de forma confiável**: em 2026-09-11, `muse-spark-1.2` e `muse-spark-1.3` custavam exatamente o mesmo ($1,25/$4,25), e só uma das duas tinha linha no índice. Preço idêntico não prova identidade de modelo.

Um modelo sem AAII **não atende a piso nenhum por benchmark**. Ele entra por dois caminhos, e só por eles:

**(a) Histórico** — há registros na mesma combinação (classe + forma) em `docs/EXECUTOR-TRACK-RECORD.md`. O plano declara o piso do grau como referência da exigência e **justifica a escolha pelos registros**, citando quais. É o caso canônico do `big-pickle`.

**(b) Estreia disciplinada** — apenas em grau **D1 ou D2**, uma estreia por plano, com revisão elevada um nível acima do mínimo da tabela do Passo 5, e registro obrigatório no track record. **Proibida** em S1, S2, S3 e N.

Quando o mapeamento por gêmeo pago for possível (nome idêntico no índice **e** preço idêntico em fonte de contraprova), ele continua válido — mas registre na justificativa que foi mapeamento, não leitura direta. Na dúvida, `—`.

#### Tier C em etapa Supervisionada — permitido, com preço

Quando a janela aperta e nenhum gratuito alcança a aptidão de `Supervisionado`, o arranjo **é permitido**: a tabela do Passo 5 já prevê `Supervisionado` × `Tier C` = **revisão linha a linha**. O custo migra da janela da assinatura para a profundidade de revisão do agente planejador.

Só faça essa troca conscientemente: se a etapa exigir mais de um ciclo de correção, a economia foi ilusória, porque o retrabalho cai no recurso nº 1. Registre os ciclos no track record — é o que permite saber, na sessão seguinte, se a troca compensou.

### Passo 4.1 — Rebaixar `Não delegável` para transcrição, sempre que couber

> **Máxima do projeto, declarada pelo usuário em 2026-09-08: qualidade com o melhor custo-benefício.** Manter uma etapa em `Não delegável` por hábito é desperdício do recurso mais caro do fluxo.

`Não delegável` protege **a decisão**, não a digitação. Quando o `IMPLEMENTATION.md` já contém o artefato **literal e completo** — o SQL inteiro da migration, o corpo inteiro da função —, a decisão de arquitetura **já foi tomada no planejamento**. O que sobra é transcrever, e transcrever é delegável.

Antes de fechar a distribuição, percorra cada etapa `Não delegável` e pergunte: *o executor precisaria decidir alguma coisa, ou só copiar?*

#### PRIMEIRO o teste de economia: a razão especificação / artefato

> **Corrigido em 2026-09-08, depois de um erro medido nesta sessão.** A versão anterior desta seção dizia: "se o artefato está literal no plano, delegue". **Está errado, e custou tokens de verdade.**
>
> Para delegar, o agente precisa emitir o artefato dentro de um prompt de executor. Se o artefato já está escrito por inteiro no `IMPLEMENTATION.md`, delegá-lo significa **datilografar duas vezes** — uma no plano, outra no prompt — e depois ainda gastar contexto lendo o log, verificando e revisando. Escrever o arquivo direto emite o conteúdo **uma vez só**.

Antes de qualquer consideração de risco, aplique este teste:

| Relação | Decisão |
|---|---|
| **spec ≈ artefato** (o plano já contém o código completo) | **O agente escreve.** Delegar é puro overhead. |
| **spec << artefato** (contrato curto gera arquivo grande: um E2E de 8 cenários, um componente a partir de uma interface, uma suíte de testes a partir de assertivas) | **Delegue.** Aqui a delegação paga. |

Casos reais de 2026-09-08, medidos: as quatro migrations tinham o SQL literal no plano — delegá-las foi **negativo**. O E2E gerou 317 linhas a partir de ~180 de prompt — foi o único ganho claro do dia.

**Não confunda dois eixos independentes.** `Não delegável` é classificação de **risco**: protege a decisão de arquitetura, não a digitação. O teste acima é de **custo**. Para artefato literal, os dois apontam em direções opostas — o risco autoriza delegar, mas o custo desaconselha. **Quando divergirem, o custo decide**, porque o risco já foi neutralizado pela especificação fechada.

#### Se o teste de economia autorizar, aí sim confira o risco

**Rebaixe para `Supervisionado / transcrição` quando TODAS forem verdadeiras:**

- [ ] O teste de economia acima autorizou (spec << artefato)
- [ ] O artefato está especificado sem ambiguidade — não "descrito", não "como em X"
- [ ] O executor não precisa abrir nenhum outro arquivo para produzi-lo
- [ ] Existe verificação **mecânica** do resultado: consulta SQL estrutural, `prosecdef`, contagem de policies, teste com assertiva literal
- [ ] A revisão fica em **linha a linha**

**Mantenha em `Não delegável` quando QUALQUER uma ocorrer:**

- O artefato precisa ser **fundido** com código existente (ler um arquivo, inserir em posições específicas, preservar o resto) — isso não é cópia, é merge, e merge é onde o executor decide
- A etapa contém uma **armadilha de falha silenciosa**: um erro que não quebra teste nenhum e desliga uma garantia de segurança. Exemplo real desta sessão: trocar o cliente ligado ao JWT por `service_role` em uma Edge Function anula quatro invariantes de RLS sem nenhum sintoma
- É correção de dado em produção

Registre o rebaixamento na justificativa, dizendo qual verificação mecânica cobre o risco **e** por que o teste de economia autorizou.

**O custo de orquestração é do agente e é real.** Cada etapa delegada consome, além da janela do executor: o prompt que o agente emite, a leitura do log, a verificação e a revisão. O `EXECUTORS.md` §2 lista a janela das assinaturas como recurso escasso — mas o recurso nº 1 continua sendo o agente, e ele paga por delegar. Uma etapa delegada com especificação frouxa é o pior arranjo possível, porque soma a janela do executor ao retrabalho do orquestrador.

**Registro do erro, para não se repetir:** em 2026-09-08 o agente rebaixou as Etapas 1-4 (migrations com SQL literal no plano) para transcrição, argumentando economia. Na medição pós-sessão, delegá-las custou **mais** do que escrevê-las: o SQL foi emitido no plano, emitido de novo em quatro prompts de executor, e depois lido de volta na verificação. As Etapas 5 e 6 ficaram com o agente pelo motivo certo — merge em função existente e fronteira de autenticação com armadilha silenciosa —, mas 1-4 deveriam ter ficado pelo motivo de custo.

### Passo 4.2 — Testar executor deliberadamente, para não depender de benchmark

Benchmark é indício, não evidência. A maioria do parque gratuito não é catalogada, e enquanto ninguém rodar esses modelos o `EXECUTOR-TRACK-RECORD.md` nunca sai do zero — o protocolo fica preso em benchmark genérico para sempre.

Por isso, **estrear executor sem histórico é comportamento desejado**, não risco a evitar. Com disciplina:

1. **Escolha a etapa de menor risco disponível** naquela classe — arquivo novo antes de edição; teste antes de código de produção; nunca fronteira de segurança.
2. **Prefira quem atende ao piso do grau.** Se houver gratuito que alcance o piso (hoje: `muse-spark-1.3-contributor-free`, AAII 48), estreie com ele primeiro. **Estreia só é permitida em grau D1 ou D2** — nunca em S1, S2, S3 ou N.
3. **Na falta de um apto, um pouco abaixo da barra é aceitável** — em etapa `Delegável`, ou `Supervisionado` de risco baixo, sempre com revisão **linha a linha**. É assim que se descobre se a barra do benchmark corresponde ao que este projeto exige. Não vale para fronteira de tenant/auth/RLS, migration com dado real ou contrato consumido por outro módulo.
4. **Um executor inédito por vez.** Duas estreias no mesmo plano tornam impossível atribuir a falha.
5. **Registro obrigatório em `docs/EXECUTOR-TRACK-RECORD.md`**, com ciclos e atribuição (`falha do modelo` / `falha do plano` / `ambiguidade genuína`). Sem isso a estreia foi desperdício: o risco foi corrido e o aprendizado, perdido.
6. **Regra de reabilitação e de queima:** falha de modelo em duas estreias consecutivas na mesma forma → o executor sai das recomendações daquela forma até haver motivo novo. Duas execuções limpas → a revisão pode cair para o mínimo da tabela do Passo 5.

Na primeira execução de qualquer executor inédito, **eleve a revisão um nível acima do mínimo**, mesmo que ele atenda à barra. Precedente: registro #009 do track record, revisado linha a linha onde o mínimo era revisão dirigida.

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

> **Quem dispara é sempre o agente planejador** — `agent/AGENT.md` §4, decisão do usuário de 2026-09-08. A coluna "Quem dispara" permanece no formato para tornar a regra visível, e deve vir preenchida com `agente planejador` em **todas** as linhas. Nunca atribuir execução ao usuário, nem para etapa `Delegável`, nem "por economia".
>
> Consequências ao montar a tabela: descarte qualquer ferramenta sem modo não-interativo (é o caso da `freebuff`), e apresente ao usuário, junto da tabela, **a ordem em que os executores serão disparados** — por importância e dependência, não por número de etapa. A execução começa com um comando único dele e segue sem devolver o terminal.

Formato exato:

```
Distribuição de execução por etapa
Consulta: EXECUTOR-TRACK-RECORD.md (N registros na combinação) · model-cache.md (cache de YYYY-MM-DD, fronteira NN)

| Etapa | Classe | Grau | Forma | AAII mín. | Tier | Executor | Custo | Revisão | Quem dispara |
|-------|--------|------|-------|-----------|------|----------|-------|---------|--------------|
| ...   | ...    | ...  | ...   | ...       | ...  | ...      | ...   | ...     | ...          |

Comandos prontos:
  Etapa N: <linha de comando exata, copiada do EXECUTORS.md>

Justificativas:
  Etapa N: [1-2 linhas citando a evidência usada — registro do track record, AAII
            específico do model-cache, ou declaração explícita de amostra insuficiente.
            Deve citar o domínio concreto da etapa, não termos genéricos.
            Quando a escolha vier do histórico, declarar o piso do grau como
            referência da exigência e sustentar a escolha nos registros, dizendo
            quais. Quando o executor não tiver nota pública, dizer isso
            explicitamente — nunca omitir e nunca estimar.]

Condições da spec: manifesto=[sim/não] · testes-literais=[sim/parcial/não] · baseline=[sim/não]
[Se alguma condição faltar: apontar quais etapas foram rebaixadas de Delegável por isso.]
```

---

## 4. Critérios de exclusão

Descarte qualquer modelo que se enquadre em:

- **Sem `tool_call`** — não consegue editar arquivos; serve para consulta, não para execução
- **Teto de saída insuficiente** para o volume da etapa
- **Ausente de `opencode models` / `~/.codex/models_cache.json`** — se o comando não lista, o modelo não existe para este projeto, por mais que apareça em cache local ou em leaderboard. Critério introduzido em 2026-09-11, quando 24 dos 31 "gratuitos" documentados se revelaram inexistentes
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
Fonte única de benchmark: Artificial Analysis (artificialanalysis.ai)
Contraprova factual (nunca métrica): opencode models · OpenRouter (preço) · Hugging Face (licença)
Fronteira AAII desta coleta: NN
Próxima atualização obrigatória: YYYY-MM-DD  (30 dias)

| Modelo | Provedor | AAII | Input $/M | Output $/M | Velocidade (t/s) | Contexto | Saída máx. | Licença |
|--------|----------|------|-----------|------------|------------------|----------|------------|---------|
```

**Legenda:**
- **AAII:** Artificial Analysis Intelligence Index nesta coleta (maior = melhor). **Só comparável a números da mesma coleta** — o índice já foi reescalado uma vez, sem preservar ordem relativa.
- **Saída máx.:** teto de tokens de saída — campo obrigatório, usado pela regra do Passo 4. Vem de `opencode models` / `models_cache.json`, não do AA.
- Input/Output $/M: não são orçamento. Servem como desempate de disponibilidade e proxy de queima de janela.
- "—" = dado não disponível em fonte segura (**nunca inventar**)

**Seções obrigatórias do arquivo**, além da tabela:

1. **Aviso de reescala**, quando houver — com a tabela comparativa antes/depois e a advertência de não comparar entre coletas.
2. **Tabela de pisos por grau**, com o modelo de referência de cada um, relida nesta coleta.
3. **Parque gratuito real**, verificado por `opencode models` na data da coleta, com teto de saída e grau máximo alcançado por modelo.
4. **Modelos sem entrada no Artificial Analysis** — lista explícita de quem ficou com `—` e por quê. Obrigatória: impede que uma sessão futura confunda ausência de dado com nota baixa.

---

## 7. Registro obrigatório após a execução

Toda execução delegada **deve** gerar um registro em `docs/EXECUTOR-TRACK-RECORD.md`, escrito no momento da revisão, com atribuição explícita de falha (`falha do modelo` / `falha do plano` / `ambiguidade genuína`).

Sem esse registro o protocolo não aprende, e a escolha de executor fica presa em benchmark genérico para sempre.
