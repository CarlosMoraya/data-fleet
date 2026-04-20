# NovoModulo.md — Protocolo de Construção de Novos Módulos

> **ESTE ARQUIVO É ATIVADO AUTOMATICAMENTE** quando o usuário pede para criar algo novo.
> **NÃO comece a codar** até seguir todas as fases abaixo na ordem.

---

## Fluxo Automático

```
Usuário: "Quero criar um módulo de X"
         ↓
Você: Lê este arquivo
         ↓
Você: FASE 0 (mapear entidades) — espera respostas
         ↓
Usuário: Responde / confirma
         ↓
Você: FASE 1 (análise de impacto) — espera aprovação
         ↓
Usuário: "Aprovado"
         ↓
Você: FASE 2 (implementação na ordem correta)
         ↓
Você: FASE 3 (verificação automática — self-check)
         ↓
Você: FASE 4 (entrega final com checklist)
```

---

## FASE 0 — Mapeamento de Entidades

> Se o usuário já listou todas as entidades, pule para FASE 1.

Analise a descrição e responda:

1. Quais são TODAS as entidades envolvidas e seus atributos?
2. Quais relacionamentos existem entre elas (1:1, 1:N, N:N)?
3. Quais entidades já existem no projeto e quais são novas?
   → Consulte `src/types.ts` e `.claude/data-model.md`
4. O que é escopo mínimo (MVP) vs. o que pode ficar para depois?
5. Que perguntas você precisa fazer antes de prosseguir?

⚠️ **NÃO implemente nada. Só mapeie. Aguarde as respostas.**

---

## FASE 1 — Análise de Impacto

> Obrigatória antes de qualquer código. Só avance com aprovação explícita.

Responda:

1. Quais arquivos e módulos existentes esta mudança pode AFETAR?
2. Existe conflito ou sobreposição com o que já foi implementado?
3. Esta abordagem pode criar acoplamento ou dívida técnica no futuro?
4. Existe uma forma mais segura e escalável de implementar isso?
5. Quais padrões do projeto devo seguir para manter consistência?
   → Consulte `.claude/arch-frontend.md`, `arch-backend.md`, `style-guide.md`

⚠️ **NÃO AVANCE PARA CÓDIGO. Espere "Aprovado" do usuário.**

---

## FASE 2 — Implementação

> Execute SOMENTE após aprovação da Fase 1.

### Ordem de Criação (OBRIGATÓRIA — não pule etapas)

| Fase | O que criar | Caminho |
|------|------------|---------|
| **2A — Fundação** | 1. Tipos/interfaces | `src/types/[modulo].ts` |
| | 2. Validações Zod | `src/validations/[modulo].ts` |
| **2B — Dados** | 3. Mappers | `src/lib/[modulo]Mappers.ts` |
| | 4. Serviço | `src/services/[modulo]Service.ts` |
| **2C — Comportamento** | 5. Hook | `src/hooks/use[Modulo].ts` |
| **2D — UI** | 6. Componentes | `src/components/[Modulo]Form.tsx`, `[Modulo]DetailModal.tsx` |
| | 7. Página | `src/pages/[Modulo].tsx` |
| **2E — Testes** | 8. Testes unitários | Veja seção abaixo |

### Regras Arquiteturais (VIOLAR = REFAZER)

| Regra | Detalhe |
|-------|---------|
| **Tipos** | NUNCA em `pages/`, `components/` ou `hooks/` → sempre em `src/types/` |
| **Supabase** | Componentes NUNCA importam supabase → use serviço via hook |
| **Páginas** | NUNCA têm lógica de negócio → só conectam hook → componentes |
| **Validações** | NUNCA inline (`if (!campo)`) → SEMPRE com Zod schema |
| **Funções** | Máximo 40 linhas — sem justificativa = violação |
| **Duplicação** | NUNCA duplicar `ROLE_RANK`, `ROLES_CAN_*`, `json()` → importe dos existentes |
| **Imports** | NUNCA importar de `pages/` em `lib/` ou `services/` |
| **sessionStorage** | NUNCA para dados sensíveis |
| **Migrations** | NUNCA alterar existentes → criar novas |
| **Tipos existentes** | NUNCA modificar → apenas estender |
| **Git** | NUNCA commit ou push sem autorização |

### Módulos Existentes para Reutilizar (OBRIGATÓRIO)

| Módulo | Para que usar |
|--------|--------------|
| `src/types.ts` | Tipos compartilhados globais |
| `src/lib/rolePermissions.ts` | Permissões de acesso |
| `src/lib/invokeEdgeFn.ts` | Chamar Edge Functions |
| `src/lib/inputHelpers.ts` | Sanitização de inputs |
| `src/lib/supabase.ts` | Cliente Supabase |
| `src/lib/storageHelpers.ts` | Upload/compressão de documentos |
| `src/lib/dateUtils.ts` | Utilitários de data |
| `src/lib/fileHandlers.ts` | Handlers genéricos de arquivos |
| `src/components/common/FormLabel.tsx` | Labels de formulário |
| `src/components/common/DetailFields.tsx` | Campos de detalhe |

Se já existe, **USE**. Não recrie.

### Restrições de Escopo

- Arquivos APENAS nos caminhos indicados
- Compartilhar código entre módulos → crie interface comum e avise
- Edge Function nova → `supabase/functions/[nome]/index.ts`
- Migration nova → `supabase/migrations/[timestamp]_[nome].sql`

### Testes (Fase 2E — Custo Consciente)

**PRIORIDADE 1 (criar SEMPRE):**
- Validações Zod → `src/validations/[modulo].test.ts` — dados FIXOS
- Mappers → `src/lib/[modulo]Mappers.test.ts` — input fixo → output fixo

**PRIORIDADE 2 (criar se tem CRUD):**
- Serviço → `src/services/[modulo]Service.test.ts` — mocks do Supabase

**PRIORIDADE 3 (criar se Fase 1 identificou interação):**
- Cruzado → `src/[modulo]/[modulo].cross.test.ts`

**NÃO crie agora:**
- ❌ E2E — adicione 1 fluxo aos existentes
- ❌ Carga — use script genérico
- ❌ Banco real — moque o Supabase

**Regras Anti-Alucinação:**
- Use APENAS tabelas/colunas do schema atual
- Se não tem certeza do schema, PERGUNTE
- Dados FIXOS, nunca aleatórios
- Simule a execução mentalmente antes de entregar
- Mismatch entre teste e código? CORRIGE antes

---

## FASE 3 — Verificação Automática

> Antes de entregar, self-check. Se algo violar, CORRIJA antes.

- [ ] Tipo em `pages/` ou `components/`? → MOVA para `src/types/`
- [ ] Componente importa supabase? → EXTRAIA para serviço
- [ ] Função > 40 linhas? → QUEBRE
- [ ] Validação inline? → MOVA para Zod
- [ ] Import circular? → REFAÇA
- [ ] `.test.ts` correspondente criado? → CRIE
- [ ] Tipo/helper duplicado? → REUTILIZE
- [ ] Página com lógica de negócio? → MOVA para serviço/hook
- [ ] Testes com dados fixos? → Deve ser sim
- [ ] Testes mockam Supabase? → Deve ser sim

---

## FASE 4 — Entrega Final

Responda EXATAMENTE neste formato:

### Arquivos Criados
| # | Caminho | Finalidade |
|---|---------|-----------|
| 1 | `src/types/[modulo].ts` | ... |

### Arquivos Modificados
| Caminho | O que mudou | Por que |
|---------|------------|---------|
| ... | ... | ... |

### Pirâmide de Testes
| Camada | Arquivo | Cobre | Passou? |
|--------|---------|-------|---------|
| Validações | `[caminho]` | schemas Zod | ✅/❌ |
| Mappers | `[caminho]` | conversões | ✅/❌ |
| Serviço | `[caminho]` | CRUD mocks | ✅/❌ |
| Cruzado | `[caminho]` | módulo X | ✅/❌ |

### Checklist de Qualidade
| Regra | Status |
|-------|--------|
| Tipos em `src/types/` | ✅/❌ |
| Sem supabase em componentes | ✅/❌ |
| Funções ≤ 40 linhas | ✅/❌ |
| Sem validação inline | ✅/❌ |
| Sem import circular | ✅/❌ |
| Sem duplicação | ✅/❌ |
| Página só orquestra | ✅/❌ |
| Testes criados | ✅/❌ |
| Testes dados fixos | ✅/❌ |
| Testes mockam Supabase | ✅/❌ |
| Migrations novas | ✅/❌ |
| Sem commit/push | ✅ |

### Notas e Decisões
- [Decisões arquiteturais]
- [Trade-offs]
- [Interações com módulos existentes]

⚠️ **Se algum ❌, corrija ANTES de enviar.**

---

## Contexto do Projeto

Para entender a arquitetura existente:

1. `CLAUDE.md` — índice de contexto
2. `.claude/` — módulos detalhados (arquitetura, schema, estilos, testes)
3. `CHANGELOG.md` — histórico de mudanças

**Não reinvente. Consulte primeiro.**
