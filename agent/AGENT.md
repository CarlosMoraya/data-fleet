# AGENT - Fonte de Verdade Operacional

Este é o ponto de entrada central para o desenvolvimento do **βetaFleet**. Ele contém as regras universais e o índice para toda a documentação técnica e operacional.

## 📌 Índice de Documentação

### 🤖 Manuais do Agente (Technical Guards)
- [AGENT-BACKEND.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/agent/AGENT-BACKEND.md): Padrões técnicos de API e lógica de negócio.
- [AGENT-DATABASE.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/agent/AGENT-DATABASE.md): Modelagem, RLS e histórico de migrações.
- [AGENT-DESIGN.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/agent/AGENT-DESIGN.md): Especificações visuais e regras de estilização.
- [AGENT-FRONTEND.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/agent/AGENT-FRONTEND.md): Padrões de interface e consumo de serviços.
- [AGENT-INFRA.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/agent/AGENT-INFRA.md): Configurações, deploy e infraestrutura.

### 📄 Documentação de Produto e Memória
- [PRD.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/docs/PRD.md): Objetivos de negócio e escopo funcional.
- [SPEC.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/docs/SPEC.md): Especificação técnica completa e arquitetura.
- [DESIGN.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/docs/DESIGN.md): UX/UI e guia de estilos do dashboard.
- [MEMORY.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/docs/MEMORY.md): Estado atual, tarefas e próximos passos.
- [MEMORY-HISTORY.md](file:///home/cmoraya/Documentos/Projetos/Beta-fleet/docs/MEMORY-HISTORY.md): Histórico de sessões e decisões passadas.

---

## 🛠 Protocolos Universais

### 1. Criação de Novos Módulos (Protocolo de 4 Fases)
Qualquer nova funcionalidade **DEVE** seguir estas fases sequenciais:

1.  **Mapeamento de Requisitos e Dependências**: Identificar tabelas impactadas, novos campos e fluxos.
2.  **Análise de Impacto e Planejamento**: Avaliar efeitos no RLS, performance e módulos existentes.
3.  **Execução em Lotes (Iterativo)**: Implementar backend (SQL/RLS) primeiro, depois frontend (Mappers/Components).
4.  **Verificação e Ajustes Finais**: Validar com testes E2E e auditoria de código.

### 2. Regras de Ouro de Desenvolvimento
- **Admin Master**: Possui `client_id = NULL`. Qualquer RLS que filtre por `client_id` deve incluir `OR role = 'Admin Master'`.
- **Aesthetics First**: A interface deve ser premium. Use Tailwind v4, HSL colors e micro-animações.
- **Offline-First**: Funcionalidades críticas (como checklists) devem usar a infraestrutura IndexedDB (Dexie).
- **Sem Placeholders**: Use imagens reais ou geradas; nunca deixe seções incompletas.

### 3. Convenções de Código
- **Idioma**: Código e comentários em Inglês. Documentação técnica em Português.
- **Commits**: Mensagens descritivas em Português, focando no "porquê".
- **Linting**: Preservar comentários e docstrings existentes.

---

## 🚀 Comandos Rápidos

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento (Vite) |
| `npx playwright test` | Executa a bateria completa de testes E2E |
| `npm run build` | Gera o bundle de produção (~8s esperado) |
| `npx playwright show-report` | Exibe o último relatório de testes |
