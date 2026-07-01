# Model Cache
Atualizado em: 2026-07-01
Fontes: Artificial Analysis (artificialanalysis.ai) + Vellum AI (vellum.ai)
Próxima atualização obrigatória: 2026-08-01

| Modelo | Provedor | Qualidade (AA) | SWE-Bench | GPQA | Input $/M | Output $/M | Velocidade (t/s) | Contexto | Licença |
|--------|----------|---------------|-----------|------|-----------|------------|------------------|----------|---------|
| Claude Fable 5         | Anthropic | 60 | —     | —     | $10.00 | $50.00 | —   | 1M   | Fechado |
| Claude Opus 4.8        | Anthropic | 56 | 88.6% | 93.6% | $5.00  | $25.00 | 65  | 1M   | Fechado |
| GPT-5.5                | OpenAI    | 55 | —     | —     | $5.00  | $30.00 | 79  | 922k | Fechado |
| Claude Opus 4.7        | Anthropic | 54 | —     | —     | $5.00  | $25.00 | 51  | 1M   | Fechado |
| Claude Sonnet 5        | Anthropic | 53 | 85.2% | 96.2% | $3.00  | $15.00 | 56  | 1M   | Fechado |
| GLM-5.2                | Zhipu     | 51 | —     | —     | $0.95  | $3.00  | 347 | 1M   | Aberto  |
| Kimi K2.6              | Moonshot  | 43 | —     | —     | $0.95  | $4.00  | 343 | 256k | Aberto  |
| Gemini 3.5 Flash       | Google    | 50 | —     | —     | $1.31  | —      | 163 | 1M   | Fechado |
| Gemini 3.1 Pro Preview | Google    | 46 | —     | 94.3% | $2.00  | $12.00 | 136 | 1M   | Fechado |
| Qwen3.7 Max            | Alibaba   | 46 | —     | —     | $1.43  | —      | 198 | 1M   | Fechado |
| Claude Sonnet 4.6      | Anthropic | 47 | —     | —     | $3.00  | $15.00 | 51  | 1M   | Fechado |
| MiniMax-M3             | MiniMax   | 44 | —     | —     | $0.22  | —      | 102 | 1M   | Aberto  |
| DeepSeek V4 Pro        | DeepSeek  | 44 | —     | —     | $0.435 | $0.87  | 175 | 1M   | Aberto  |
| DeepSeek V4 Flash      | DeepSeek  | —  | —     | —     | $0.14  | $0.28  | 108 | 1M   | Aberto  |
| GPT-5.3 Codex          | OpenAI    | 44 | —     | —     | $1.87  | —      | 92  | 400k | Fechado |

**Legenda:**
- Qualidade (AA): Intelligence Index do Artificial Analysis (maior = melhor, escala ~40–60)
- SWE-Bench: % de issues reais de GitHub resolvidos — benchmark de coding (fonte: Vellum AI)
- GPQA: % em perguntas de doutorado — raciocínio científico profundo (fonte: Vellum AI)
- Input/Output $/M: preços separados por milhão de tokens (fonte: Vellum AI; mais precisos que blended)
- "—" = dado não disponível na fonte no momento da coleta
- Velocidade em tokens/seg de output
