# MEMORY - Estado Atual do Projeto

Este arquivo registra apenas o estado vigente, as frentes ativas e os próximos passos imediatos do **βetaFleet**.

## Estado Atual

- **Cadastros**: Veículos, Motoristas, Embarcadores e Unidades Operacionais estabilizados.
- **Manutenção**: workflow de OS, cancelamento, aprovação de orçamento e OCR operacional.
- **Checklists**: infraestrutura offline-first ativa, com templates versionados e smoke oficial definido.
- **Pneus**: módulo funcional com inspeções, configuração de eixos e histórico.
- **Oficinas**: modelo de parceria multi-tenant ativo.
- **Dashboard Executivo**: 3 abas em produção (`Visão Geral`, `Operação`, `Custos`), com tendência histórica de custo, projeção financeira, métricas documentais incluindo CRLV e cards de KPI com título em até 2 linhas; na aba Operação, os cards usam os textos "Tempo médio de OS" e "Idade média de OS abertas", e a grade de gráficos foi repriorizada para destacar primeiro o gargalo operacional (Fila de Manutenção por Status, Frota por Unidade Operacional, Frota por Embarcador).

## Tarefas em Andamento

1. **Estabilização E2E de Inspeção de Pneus**:
   - Persistem ajustes de timing e seed em fluxos de movimentação e perfis de teste.
2. **Migração incremental para React Query**:
   - Restam páginas menores ainda usando estado local.
3. **Acessibilidade**:
   - Revisão pendente de `aria-labels` em modais e tabelas.

## Próximos Passos

1. Retomar os E2Es pendentes de inspeção de pneus após estabilização de seed/timing.
2. Avaliar notificações de vencimento (CRLV/CNH) via Edge Functions.
3. Considerar backfill futuro de `crlv_expiration_date` para veículos legados, se houver demanda.

## Decisões Vigentes

- **Admin Master** com `currentClient = null` representa visão agregada cross-tenant onde o RLS já permite leitura.
- **CRLV** usa precedência **data real de vencimento → ano**; `crlv_year` é apenas fallback quando a data não existe.
- **Fila de Ação** pode exibir placas e nomes dentro do tenant. **Risco aceito** em 2026-06-13.
- **Smoke oficial** do projeto é `npm run test:smoke`; em falha, a correção precede novas evoluções.

## Referência Histórica

- Todo o histórico anterior deste arquivo foi arquivado em `docs/MEMORY-HISTORY.md`, sob `## Arquivamento — 2026-06-14`.
