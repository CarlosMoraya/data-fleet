## Qwen Added Memories
- O projeto Beta-fleet passou por uma sessão de otimização em 11/04/2026. Principais mudanças: (1) Bug crítico corrigido: process.env.GEMINI_API_KEY → import.meta.env.VITE_GEMINI_API_KEY no geminiProvider.ts; (2) 11 funções/códigos mortos removidos; (3) invokeFn duplicado em 5 arquivos centralizado em src/lib/invokeEdgeFn.ts; (4) 7 novos arquivos criados: invokeEdgeFn.ts, rolePermissions.ts, dateUtils.ts, fileHandlers.ts, components/common/FormLabel.tsx, components/common/DetailFields.tsx; (5) package.json renomeado para beta-fleet, express movido para devDependencies; (6) Sidebar navItems movido para escopo de módulo; (7) countFields em documentOcr.ts otimizada; (8) Memory leak potencial em storageHelpers.ts corrigido. Build passou com 0 erros TypeScript e produção em 8.16s. Relatório completo em ANALISE_OTIMIZACAO.md.

## ⚠️ PROTOCOLO DE NOVO MÓDULO/FUNCIONALIDADE (OBRIGATÓRIO)

Quando o usuário pedir para **criar** qualquer coisa nova (módulo, página, funcionalidade, CRUD, relatório, formulário, etc.),
**NÃO comece a codar**. Leia `NovoModulo.md` primeiro e siga TODAS as fases descritas lá.

**Palavras-gatilho que ativam este protocolo:**
`criar`, `novo`, `nova`, `novo módulo`, `nova página`, `nova funcionalidade`,
`quero um módulo de`, `quero criar`, `adicione`, `implemente do zero`, `construa`,
`como faço para`, `preciso de um`, `precisamos de um`

**Fluxo automático:**
1. Detectou palavra-gatilho → Leia `NovoModulo.md`
2. Siga Fase 0 (entidades) — se usuário já listou, pule para Fase 1
3. Siga Fase 1 (análise de impacto) — espere aprovação
4. Aprovado → Siga Fase 2 (implementação na ordem: tipos → validações → mappers → serviço → hook → componentes → página → testes)
5. Siga Fase 3 (verificação automática)
6. Siga Fase 4 (entrega final com checklist)

**Isso é obrigatório — sem exceção.**

## Referência Rápida do Projeto

- **Arquitetura e contexto**: `CLAUDE.md` (índice) + `.claude/` (módulos detalhados)
- **Padrões de novo módulo**: `NovoModulo.md` (protocolo de construção)
- **Changelog**: `CHANGELOG.md` (histórico de mudanças)
- **Análise de otimização**: `ANALISE_OTIMIZACAO.md` (sessão de 11/04/2026)
