# MODEL_SELECTION.md

**Última atualização:** 2026-07-01
**Propósito:** Guia para o agente arquiteto escolher o melhor modelo de IA para executar um `IMPLEMENTATION.md` ou `IMPLEMENTATION_FIXBUG.md`.
**Idioma de operação:** Português do Brasil.

---

## 1. Como usar

Após gerar o plano de implementação, siga exatamente estes passos **na ordem abaixo**.

### Passo 1 — Verificar cache local

Verifique se `docs/model-cache.md` existe e leia a linha `Atualizado em:` no cabeçalho:

- **Existe e data ≤ 30 dias atrás** → use os dados do cache; pule para o Passo 3.
- **Não existe ou data > 30 dias** → execute o Passo 2.
- **Usuário pediu explicitamente para atualizar** → execute o Passo 2.

### Passo 2 — Buscar dados atualizados

Acesse a URL exata abaixo (a URL raiz `/models` é muito grande e falha):

```
https://artificialanalysis.ai/leaderboards/models
```

Extraia para cada modelo listado:

- Nome do modelo e provedor
- Índice de qualidade (Intelligence Index)
- Preço blended de input ($/M tokens)
- Velocidade de saída (tokens/segundo)
- Janela de contexto
- Licença (Aberto / Fechado)

Salve em `docs/model-cache.md` seguindo o formato da Seção 4. A linha `Próxima atualização obrigatória:` deve ser a data de hoje + 30 dias.

### Passo 3 — Classificar a complexidade do plano

Leia o plano gerado e classifique:

| Nível | Critérios |
|---|---|
| **Trivial** | CRUD simples, 1–2 arquivos, sem lógica de negócio complexa |
| **Médio** | 3–6 arquivos, lógica de negócio moderada, sem segurança crítica |
| **Complexo** | >6 arquivos, múltiplas camadas, autenticação/autorização, migrações |
| **Crítico** | Segurança, dados sensíveis, RLS, Auth, pagamentos, produção urgente |

### Passo 4 — Selecionar os 3 modelos

Consulte o cache e filtre os modelos pelo critério do nível:

| Nível | Critério de seleção |
|---|---|
| **Trivial** | Menor custo com índice de qualidade suficiente (≥ 40) |
| **Médio** | Melhor razão qualidade/preço |
| **Complexo** | Equilíbrio entre qualidade (≥ 46) e custo |
| **Crítico** | Maior qualidade disponível; custo é critério de desempate entre empatados |

**Regra de ouro:** o modelo escolhido deve entregar o plano **sem desvios** ao menor custo possível. Um modelo mais barato que comete erros não é custo-benefício.

Ordene os 3 modelos do **melhor custo-benefício** (posição 1) ao **mais robusto** (posição 3). Para nível Crítico, posição 1 é o modelo de maior qualidade com o menor preço; posição 3 é o de maior qualidade absoluta.

### Passo 5 — Produzir a saída

```
Para executar [IMPLEMENTATION.md / IMPLEMENTATION_FIXBUG.md] eu sugiro os modelos a seguir, ordenados do melhor custo-benefício ao mais robusto:

Complexidade identificada: [Trivial / Médio / Complexo / Crítico]

1. [modelo] — melhor custo-benefício
   Custo estimado: $X/M (blended) · Y t/s · Z contexto
   Justificativa: [1 linha — o que no plano justifica este modelo e por que entrega sem desvios a esse custo]

2. [modelo] — fallback técnico
   Custo estimado: $X/M (blended) · Y t/s · Z contexto
   Justificativa: [1 linha]

3. [modelo] — máxima robustez
   Custo estimado: $X/M (blended) · Y t/s · Z contexto
   Justificativa: [1 linha]
```

---

## 2. Critérios de exclusão automática

Descarte imediatamente qualquer modelo que se enquadre em:

- Licença **Non-Commercial** (incompatível com uso comercial)
- **Sem API pública** disponível (ex: ChatGPT Pro only)
- Marcado como **deprecated** ou descontinuado no site
- **Preview/Beta** sem SLA — só permitido para nível Trivial ou Médio

---

## 3. Quando atualizar o cache

Atualizar `docs/model-cache.md` apenas quando:

1. O arquivo não existe
2. A data `Próxima atualização obrigatória:` no arquivo já passou
3. O usuário diz explicitamente "atualize o cache de modelos" ou similar

**Nunca acesse a web sem necessidade** — o cache existe para economizar tokens e tempo.

---

## 4. Formato do arquivo de cache

```markdown
# Model Cache
Atualizado em: YYYY-MM-DD
Fonte: https://artificialanalysis.ai/leaderboards/models

| Rank | Modelo | Provedor | Índice Qualidade | Input $/M (blended) | Velocidade (t/s) | Contexto | Licença |
|------|--------|----------|-----------------|---------------------|------------------|----------|---------|
| 1  | ...    | ...      | ...             | ...                 | ...              | ...      | ...     |

Próxima atualização obrigatória: YYYY-MM-DD (ou sob instrução explícita do usuário).
```
