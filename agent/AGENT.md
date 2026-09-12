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

### 4. Modelo de Execução — Orquestração Centralizada

> **Decisão do usuário, 2026-09-08. Vigente até revogação explícita. Substitui qualquer orientação anterior em `docs/EXECUTORS.md`, `docs/MODEL_SELECTION.md`, `prompts/Evolucao.md` e `prompts/Fixbugs.md` que atribua execução ao usuário.**

**O usuário não executa código, não dispara agentes e não roda comandos no terminal.** Ele planeja com o agente, aprova e valida o resultado. Nada além disso.

O agente que conduz a sessão acumula **três papéis**:

1. **Planejador** — produz o `IMPLEMENTATION.md` / `IMPLEMENTATION_FIXBUG.md`.
2. **Orquestrador** — dispara **todos** os agentes executores via Bash, na ordem definida pelo plano, e trata os ciclos de correção.
3. **Revisor** — reexecuta as verificações, compara com o baseline, confere o `git status` contra o manifesto e aplica a profundidade de revisão da tabela do Passo 5.

Regras operacionais que decorrem disso:

- **A coluna "Quem dispara" de toda tabela de distribuição vale `agente planejador` em todas as linhas.** Ela permanece na tabela apenas para tornar a regra visível, não porque exista alternativa.
- **Antes de começar, o agente apresenta o roster:** qual executor roda cada etapa e em que ordem. O usuário responde com um comando único de início; o agente então executa a sequência inteira sem devolver o terminal a ele.
- **A ordem de execução é a ordem de importância do plano**, não a ordem numérica por conveniência: dependências primeiro, fronteiras de segurança antes do que as consome.
- **Ferramenta sem modo não-interativo é inutilizável neste projeto.** É o caso da `freebuff`, que exige o usuário no terminal. Não recomendá-la em plano nenhum.
- **Custo de orquestração é real e deixou de ser opcional.** Cada etapa delegada consome, além da janela do executor, tokens do agente orquestrador no disparo, na leitura do log e na revisão. Isso **não** justifica delegar menos — justifica exigir especificação fechada, para que o ciclo seja um só.
- **O usuário continua sendo o dono de três decisões**, que nenhum agente toma por conta própria: aplicar migration em DEV e em PROD, publicar Edge Function, e executar `git commit`.

**Operar o próprio cliente NÃO é executar trabalho.** Esta regra proíbe o usuário de ficar no laço da *execução* — rodar build, teste, deploy, agentes, scripts do projeto. Ela não se aplica ao que ele faz na própria ferramenta: digitar `/clear`, `/compact`, `/model`, interromper com Esc, trocar de aba ou abrir sessão nova. Isso é uso normal do cliente, na mesma categoria de digitar uma mensagem, e o agente pode e deve sugerir quando for útil.

**Higiene de contexto — responsabilidade do agente, não do usuário.** Sessão longa é cara mesmo com cache: o custo escala com o tamanho do contexto em *cada* turno. A prevenção é do agente:

- editar arquivo grande com edições cirúrgicas, nunca reescrevendo o documento inteiro;
- ler o trecho necessário, não o arquivo inteiro;
- **nunca emitir o mesmo artefato duas vezes** — se o código já está escrito no plano, escrevê-lo de novo num prompt de executor é datilografar em dobro.

O remédio de última instância é o usuário digitar `/clear` (limpa e exige uma frase de repriming) ou `/compact` (resume e mantém a continuidade). Sugira isso apenas em **fronteira de fase** — planejamento → implementação, implementação → validação, validação → produção —, nunca entre etapas de um mesmo plano: cada `/clear` custa reler o `IMPLEMENTATION.md` inteiro, e fazer isso a cada etapa sai mais caro que carregar o contexto. Ao sugerir, entregue o texto de repriming pronto para colar.

### 5. Política de Artefatos Mutáveis
- **Persistentes e versionáveis**: `docs/MEMORY.md` e `docs/MEMORY-HISTORY.md` representam a memória operacional compartilhada do projeto. Sempre que mudarem o estado vigente ou registrarem histórico relevante, devem ser considerados artefatos de commit.
- **Transitórios e não versionáveis por padrão**:
  - `IMPLEMENTATION.md` e `IMPLEMENTATION_FIXBUG.md` (raiz) e `session/implementation/IMPLEMENTATION*.md` são artefatos de sessão. Servem como instrução de execução da tarefa corrente e podem ser sobrescritos na sessão seguinte.
  - Toda a pasta `session/` (implementação, `reports/`, `scratch/`, `test-checklists/`) também é transitória e está no `.gitignore`.
- **Acessibilidade aos agentes**: o fato de um arquivo estar no `.gitignore` **não** impede os agentes de lê-lo quando citado explicitamente pelo usuário. Transitórios são arquivos legíveis e editáveis durante a sessão; apenas não entram em commits por padrão.
- **Commit de transitórios**: `IMPLEMENTATION*.md` (raiz ou `session/implementation/`) só devem entrar em commit quando o usuário pedir explicitamente para versionar o plano daquela sessão. Caso contrário, afastá-los de `git add` (evitar `git add .`).

---

## 🚀 Comandos Rápidos

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento (Vite) |
| `npm run test:smoke` | Executa o protocolo oficial de smoke: login, rota protegida, shell autenticado e navegação crítica de Cadastros |
| `npx playwright test` | Executa a bateria completa de testes E2E |
| `npm run build` | Gera o bundle de produção (~8s esperado) |
| `npx playwright show-report` | Exibe o último relatório de testes |
