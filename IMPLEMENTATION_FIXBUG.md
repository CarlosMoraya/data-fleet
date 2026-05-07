# IMPLEMENTATION_FIXBUG.md
Gerado em: 2026-05-06 22:38
Sessão: correção de bug — CPF truncado ao colar valor formatado no formulário de motorista
Tipo de bug: Tipo A — Bug isolado
Causa raiz confirmada: sim
Baseado em: docs/MEMORY.md (2026-05-06)

---

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação completa e fechada desta correção. O agente de código que executar este plano:

- NÃO modifica arquivos além dos listados aqui
- NÃO refatora código não relacionado ao bug
- NÃO "melhora" código que não está causando o problema
- NÃO instala dependências não listadas aqui
- NÃO altera testes para fazê-los passar — corrige o código
- SE encontrar algo que parece errado mas não está neste documento: registra como observação no MEMORY.md e continua sem corrigir
- SE encontrar ambiguidade em qualquer passo: para, informa o usuário e aguarda instrução

---

## Contexto necessário
Antes de implementar, leia:
- `agent/AGENT.md` — regras universais do projeto
- `agent/AGENT-FRONTEND.md` — padrões de interface e React

---

## O bug
**Comportamento atual:** Ao colar um CPF formatado (ex.: `187.182.207-62`) no campo CPF do formulário de motorista, os últimos 2 dígitos verificadores são perdidos. O campo exibe `187182207` (9 dígitos) em vez de `18718220762` (11 dígitos).

**Comportamento esperado:** Ao colar um CPF de qualquer fonte externa (planilha, documento, sistema), todos os 11 dígitos devem ser preservados após a normalização automática do campo.

**Condições de reprodução:**
1. Abrir o formulário de cadastro ou edição de motorista
2. Copiar um CPF no formato `NNN.NNN.NNN-DD` de qualquer fonte externa (ex.: planilha Excel)
3. Colar no campo CPF do formulário
4. Observar: os 2 dígitos verificadores (após o traço) desaparecem

**Impacto:** Todo usuário que tenta cadastrar um motorista colando o CPF de uma planilha ou documento. O CPF fica com 9 dígitos — inválido para o banco de dados e para validação. Severidade alta: bloqueia o cadastro correto de motoristas.

---

## Causa raiz identificada

O campo CPF no componente `src/components/DriverForm.tsx` (linha 380) possui o atributo `maxLength={11}`.

O `maxLength` do HTML opera sobre o valor **bruto** do input — ou seja, sobre a string com pontos e traço — antes de qualquer evento `onChange` ser disparado. Quando o usuário cola `187.182.207-62` (14 caracteres), o browser trunca silenciosamente para os primeiros 11 caracteres: `187.182.207`. Somente então o `onChange` dispara com esse valor já truncado. A função `filterCPF` recebe `187.182.207`, remove os pontos, e produz `187182207` — apenas 9 dígitos.

A função `filterCPF` em `src/lib/inputHelpers.ts` (linha 96-98) já possui seu próprio `.slice(0, 11)` que limita corretamente a 11 dígitos **após** a limpeza de caracteres especiais. O `maxLength={11}` no HTML é, portanto, não apenas redundante, mas destrutivo para o caso de paste de CPF formatado.

```typescript
// inputHelpers.ts — funciona corretamente, não precisa de alteração
export function filterCPF(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}
```

**Por que essa é a causa:** Se `filterCPF` recebe o string completo `187.182.207-62`, remove todos os não-dígitos e obtém `18718220762` (11 dígitos) — correto. O problema está 100% no `maxLength={11}` que impede o string completo de chegar à função.

---

## Estado dos testes antes da correção — baseline

- **Suite unitária:** 107 testes passando, 0 falhando
- **Typecheck (`tsc --noEmit`):** 0 erros
- **Testes de fumaça:** não executados (usuário optou por pular — bug e correção são isolados e de baixo risco)
- **Testes relacionados ao bug:** nenhum teste existente cobre a interação maxLength + filterCPF no DOM — este é o gap de cobertura que será fechado

O teste existente em `src/lib/inputHelpers.test.ts` (linha 106-111) já valida que `filterCPF('123.456.789-01')` → `'12345678901'`, provando que a função em si está correta. O bug não está na função — está no atributo HTML que impede a função de receber o input completo.

---

## Dependências mapeadas

**Arquivo a ser modificado:** `src/components/DriverForm.tsx`

Este componente é usado exclusivamente em `src/pages/Drivers.tsx` para criação e edição de motoristas. O campo CPF afetado não tem dependências em outros módulos.

A remoção do `maxLength={11}` não afeta:
- O `filterCPF` (que já limita a 11 dígitos internamente)
- O `driverToRow` mapper (que recebe o valor já filtrado)
- O banco de dados (a coluna `cpf` aceita a string normalizada de 11 dígitos)
- Qualquer outro campo do formulário

---

## O que NÃO fazer — restrições absolutas

- **Não modificar `src/lib/inputHelpers.ts`** — a função `filterCPF` está correta e seus 107 testes passam
- **Não adicionar máscara visual de CPF** — fora do escopo desta correção; o campo exibe dígitos puros intencionalmente
- **Não alterar o `maxLength` para um número maior (ex.: 14)** — a solução correta é remover o atributo, não ajustar o número
- **Não modificar outros campos do formulário** — apenas o campo `cpf` é afetado por este bug
- **Não refatorar o `handleChange` ou o `FIELD_FILTERS`** — estão corretos e não contribuem para o bug

---

## Correção

### Passo 1 — Remover `maxLength={11}` do campo CPF em DriverForm.tsx

**Arquivo:** `src/components/DriverForm.tsx`

**Causa que justifica tocar neste arquivo:** É aqui que o atributo `maxLength={11}` está definido — a única causa do bug.

**O que mudar:** Remover o atributo `maxLength={11}` do `<input>` do campo CPF.

Localizar o bloco (linha 375):

```tsx
<input
  type="text"
  name="cpf"
  required
  inputMode="numeric"
  maxLength={11}
  value={formData.cpf || ''}
  onChange={handleChange}
  className={inputClass}
  placeholder="Somente números"
/>
```

Substituir por:

```tsx
<input
  type="text"
  name="cpf"
  required
  inputMode="numeric"
  value={formData.cpf || ''}
  onChange={handleChange}
  className={inputClass}
  placeholder="Somente números"
/>
```

**O que NÃO mudar neste arquivo:** Todos os outros campos, handlers, e lógica de estado devem permanecer intactos.

**Impacto em dependências:** Nenhum. O `filterCPF` já garante que `formData.cpf` nunca terá mais de 11 dígitos. O input nunca exibirá mais de 11 caracteres após o primeiro `onChange`.

**Como verificar este passo:**
```
1. Abrir o formulário de motorista no browser
2. Colar "187.182.207-62" no campo CPF
3. Resultado esperado: campo exibe "18718220762" (11 dígitos, sem pontos ou traço)
4. Colar "123.456.789-09" no campo CPF
5. Resultado esperado: campo exibe "12345678909" (11 dígitos)
6. Digitar manualmente mais de 11 dígitos
7. Resultado esperado: o campo para de aceitar após o 11º dígito (filterCPF limita via slice)
```

---

### Passo 2 — Adicionar teste de regressão em inputHelpers.test.ts

**Arquivo:** `src/lib/inputHelpers.test.ts`

**Causa que justifica tocar neste arquivo:** O caso específico do CPF com dígitos verificadores colado de planilha não está documentado como caso de teste explícito. Este teste serve como proteção e documentação do comportamento esperado.

**O que mudar:** Adicionar um novo caso de teste dentro do bloco `describe('filterCPF', ...)` existente (linha 106).

Localizar o bloco atual:

```typescript
describe('filterCPF', () => {
  it('mantém apenas 11 dígitos', () => {
    expect(filterCPF('123.456.789-01')).toBe('12345678901');
    expect(filterCPF('12345678901234567890')).toBe('12345678901');
  });
});
```

Substituir por:

```typescript
describe('filterCPF', () => {
  it('mantém apenas 11 dígitos', () => {
    expect(filterCPF('123.456.789-01')).toBe('12345678901');
    expect(filterCPF('12345678901234567890')).toBe('12345678901');
  });

  it('preserva os dígitos verificadores ao processar CPF colado de planilha', () => {
    expect(filterCPF('187.182.207-62')).toBe('18718220762');
    expect(filterCPF('000.000.001-91')).toBe('00000000191');
  });
});
```

**O que NÃO mudar neste arquivo:** Os casos de teste existentes e todos os outros `describe` blocks.

**Impacto em dependências:** Nenhum. É apenas adição de testes.

**Como verificar este passo:**
```bash
npm run test:unit
```
Resultado esperado: 109 testes passando (107 anteriores + 2 novos), 0 falhando.

---

## Verificação final

Após todos os passos:

1. Rode a suite unitária completa:
```bash
npm run test:unit
```
Resultado esperado: 109 testes passando. Nenhum teste que passava antes deve estar falhando.

2. Rode o typecheck:
```bash
npm run lint
```
Resultado esperado: nenhum erro de tipo.

3. Validação manual no browser:
```
a. Abrir /cadastros/motoristas
b. Abrir formulário de criação ou edição de motorista
c. Colar "187.182.207-62" no campo CPF
d. Verificar: campo exibe "18718220762"
e. Tentar digitar um 12º dígito manualmente
f. Verificar: o campo não aceita o 12º dígito (filterCPF limita via slice)
```

Se qualquer verificação falhar: pare, informe o usuário com o resultado exato e aguarde instrução. Não tente corrigir por conta própria sem comunicar.

---

## Observações para sessões futuras

**Máscara de CPF no campo:** O campo exibe os dígitos sem formatação (sem pontos e traço). Seria mais amigável exibir `187.182.207-62` enquanto o usuário digita ou após a colagem. Esta é uma melhoria de UX, não um bug — deve ser tratada em sessão separada com `evolucao.md`.

**Outros campos com maxLength potencialmente problemático:** Outros campos numéricos do projeto que aceitam formatos com separadores (ex.: CNPJ, telefone, CEP) devem ser auditados para verificar se possuem o mesmo padrão de `maxLength` igual ao número de dígitos (sem contar os separadores). Não é escopo desta correção — registrar para revisão futura.

---

## Registro para o docs/MEMORY.md
Após a correção confirmada, adicionar ao docs/MEMORY.md:

```
Bug corrigido: CPF truncado ao colar valor formatado no formulário de motorista
Causa raiz: maxLength={11} no input HTML truncava o texto colado antes do filterCPF processar — browser aplica maxLength sobre o string bruto (com pontos/traço), não sobre os dígitos
Correção aplicada: remoção do atributo maxLength={11} do campo CPF em DriverForm.tsx; filterCPF já limita a 11 dígitos internamente via .slice(0, 11)
Arquivos modificados: src/components/DriverForm.tsx, src/lib/inputHelpers.test.ts
Testes adicionados: 2 novos casos em describe('filterCPF') no inputHelpers.test.ts
```

---

## Sugestão de commit
Quando todos os critérios de conclusão estiverem atendidos e você confirmar que o bug foi corrigido:

```
git add src/components/DriverForm.tsx src/lib/inputHelpers.test.ts
git commit -m "fix: preservar dígitos verificadores ao colar CPF formatado no formulário de motorista"
```
