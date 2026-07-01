# MODEL_SELECTION.md

**Última atualização:** 2026-07-01
**Propósito:** Guia para o agente arquiteto escolher o melhor modelo de IA para executar um `IMPLEMENTATION.md` ou `IMPLEMENTATION_FIXBUG.md`.
**Idioma de operação:** Português do Brasil.

---

## 1. Fontes de benchmark

Este documento usa três fontes combinadas para reduzir viés de provedores. Cada uma mede coisas diferentes e tem grau de independência distinto.

### 1.1 Fontes automáticas (o agente busca e combina)

| Fonte | URL exata para fetch | O que mede | Independência |
|---|---|---|---|
| **Artificial Analysis** | `https://artificialanalysis.ai/leaderboards/models` | Preço blended (7:2:1 cache/input/output), velocidade (t/s), janela de contexto, índice de qualidade próprio | Alta — empresa independente, sem vínculo com provedores de IA |
| **Vellum AI** | `https://vellum.ai/llm-leaderboard` | Preço separado (input $/M e output $/M), SWE-Bench (coding real), GPQA Diamond (raciocínio), HLE (conhecimento amplo) | Média — combina dados dos provedores com avaliações independentes; transparente sobre a distinção |

**Por que dois sites?**
- Artificial Analysis dá o **preço real de uso** (separado em blended) e **velocidade** — o que o agente precisa para calcular custo.
- Vellum dá o **preço separado input/output** (mais preciso para tarefas com muito output) e **benchmarks acadêmicos reconhecidos** (SWE-Bench, GPQA) que os provedores não controlam.
- Juntos, cobrem o que nenhum cobre sozinho.

### 1.2 Referência manual (não fetchável pelo agente)

| Fonte | URL | O que mede | Por que importa |
|---|---|---|---|
| **LMSYS Chatbot Arena** | `https://lmarena.ai` | Elo score via votação humana cega (usuários comparam dois modelos sem saber qual é qual) | A mais imparcial do mundo — nenhum provedor controla os votos. Usar quando o usuário questionar o ranking ou quiser validação humana. |

> O LMSYS Arena é uma SPA JavaScript pesada — não renderiza via fetch automatizado. Consultar manualmente quando necessário.

---

## 2. Como usar (passo a passo)

### Passo 1 — Verificar cache local

Leia `docs/model-cache.md` e verifique a linha `Próxima atualização obrigatória:`:

- **Data ainda não chegou** → use os dados do cache; pule para o Passo 3.
- **Data já passou ou arquivo não existe** → execute o Passo 2.
- **Usuário pediu explicitamente para atualizar** → execute o Passo 2.

### Passo 2 — Buscar e combinar as duas fontes

Faça fetch das duas URLs em paralelo:

1. `https://artificialanalysis.ai/leaderboards/models` → extrair: modelo, provedor, índice de qualidade, preço blended $/M, velocidade t/s, contexto, licença.
2. `https://vellum.ai/llm-leaderboard` → extrair: modelo, provedor, input $/M, output $/M, SWE-Bench %, GPQA %, HLE %.

Combine pelo nome do modelo (join). Para modelos presentes nas duas fontes, use o preço separado do Vellum (mais preciso) e o índice de qualidade + velocidade do Artificial Analysis. Para modelos só em uma das fontes, use o que tiver disponível.

Salve em `docs/model-cache.md` seguindo o formato da Seção 5.

### Passo 3 — Classificar a complexidade do plano

| Nível | Critérios |
|---|---|
| **Trivial** | CRUD simples, 1–2 arquivos, sem lógica de negócio |
| **Médio** | 3–6 arquivos, lógica moderada, sem segurança crítica |
| **Complexo** | >6 arquivos, múltiplas camadas, autenticação/autorização, migrações |
| **Crítico** | Segurança, RLS, Auth, dados sensíveis, pagamentos, produção urgente |

### Passo 4 — Selecionar os 3 modelos

Consulte o cache. Para cada nível, o critério de seleção muda:

| Nível | Critério |
|---|---|
| **Trivial** | Menor custo (input + output) com qualidade ≥ 40 |
| **Médio** | Melhor razão qualidade / preço total |
| **Complexo** | Qualidade ≥ 46 com menor custo dentro do threshold |
| **Crítico** | Maior qualidade disponível; custo é desempate entre iguais em qualidade |

**Regra de ouro:** o modelo escolhido deve entregar o plano **sem desvios** ao menor custo. Um modelo mais barato que comete erros não é custo-benefício — o erro tem custo oculto (retrabalho, debug, rollback).

Aplique os critérios de exclusão da Seção 3 antes de ranquear.

Ordene os 3 modelos do **melhor custo-benefício** (posição 1) ao **mais robusto** (posição 3).

### Passo 5 — Produzir a saída

```
Para executar [IMPLEMENTATION.md / IMPLEMENTATION_FIXBUG.md] eu sugiro os modelos a seguir, ordenados do melhor custo-benefício ao mais robusto:

Complexidade identificada: [Trivial / Médio / Complexo / Crítico]
Fontes: Artificial Analysis + Vellum AI (cache de YYYY-MM-DD)

1. [modelo] — melhor custo-benefício
   Input: $X/M · Output: $Y/M · Velocidade: Z t/s · Contexto: N
   Justificativa: [1 linha citando o benchmark específico que suporta a escolha e o que no plano justifica]

2. [modelo] — fallback técnico
   Input: $X/M · Output: $Y/M · Velocidade: Z t/s · Contexto: N
   Justificativa: [1 linha]

3. [modelo] — máxima robustez
   Input: $X/M · Output: $Y/M · Velocidade: Z t/s · Contexto: N
   Justificativa: [1 linha]
```

---

## 3. Critérios de exclusão automática

Descarte qualquer modelo que se enquadre em:

- Licença **Non-Commercial** — incompatível com uso comercial
- **Sem API pública** — ex.: acesso apenas via chat proprietário
- Marcado como **deprecated** em qualquer das duas fontes
- **Preview/Beta sem SLA** — permitido apenas para nível Trivial ou Médio

---

## 4. Quando atualizar o cache

Atualizar `docs/model-cache.md` apenas quando:

1. O arquivo não existe
2. A data em `Próxima atualização obrigatória:` já passou
3. O usuário diz explicitamente "atualize o cache de modelos" ou similar

**Nunca acesse a web sem necessidade** — o cache existe para economizar tokens e tempo.

---

## 5. Formato do arquivo de cache

```markdown
# Model Cache
Atualizado em: YYYY-MM-DD
Fontes: Artificial Analysis (artificialanalysis.ai) + Vellum AI (vellum.ai)
Próxima atualização obrigatória: YYYY-MM-DD

| Modelo | Provedor | Qualidade (AA) | SWE-Bench | GPQA | Input $/M | Output $/M | Velocidade (t/s) | Contexto | Licença |
|--------|----------|---------------|-----------|------|-----------|------------|------------------|----------|---------|
| ...    | ...      | ...           | ...       | ...  | ...       | ...        | ...              | ...      | ...     |

**Legenda:**
- Qualidade (AA): Intelligence Index do Artificial Analysis (maior = melhor)
- SWE-Bench: % de issues reais de GitHub resolvidos (benchmark de coding)
- GPQA: % em perguntas de pós-graduação (raciocínio científico profundo)
- Input/Output $/M: preços separados do Vellum AI (mais precisos que blended)
- "—" = dado não disponível na fonte
```
