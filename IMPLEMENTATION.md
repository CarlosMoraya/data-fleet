# IMPLEMENTATION.md
Gerado em: 2026-05-05 08:45
Sessão: Toggle de visibilidade de senha no formulário de cadastro do motorista
Tipo de mudança: Tipo 2 — Adição com integração ao sistema existente
Baseado em: agent/AGENT-FRONTEND.md + agent/AGENT-DESIGN.md + docs/MEMORY.md (2026-05-05)

---

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação completa e fechada desta implementação. O agente de código que executar este plano:

- NÃO toma decisões de arquitetura além do que está especificado aqui
- NÃO cria arquivos além dos listados neste documento
- NÃO modifica arquivos além dos listados neste documento
- NÃO instala dependências além das listadas neste documento
- NÃO refatora código não relacionado à tarefa
- NÃO "melhora" código que não está causando problema
- SE encontrar algo que parece errado mas não está neste documento: registra no MEMORY.md como observação e continua — não corrige

Qualquer decisão não prevista aqui deve ser tratada como: parar, informar o usuário e aguardar instrução.

---

## Contexto necessário
Antes de implementar, leia obrigatoriamente:
- `agent/AGENT.md` — regras universais do projeto
- `agent/AGENT-FRONTEND.md` — padrões de interface e React
- `agent/AGENT-DESIGN.md` — design system, tokens, estética premium

---

## O produto e a mudança
**O que é este produto:** βetaFleet é um sistema SaaS de gestão de frota de transporte — veículos, motoristas, manutenção, pneus e checklists offline-first.
**O que será implementado:** Adicionar um botão de toggle (olho) ao campo "Senha temporária" no formulário de cadastro do motorista, permitindo que o usuário alterne a visibilidade da senha digitada. A mudança ocorre exclusivamente no frontend, em um único arquivo.

---

## Padrões de mercado aplicados
- **Password Visibility Toggle**: estado booleano local que alterna o atributo `type` do input entre `"password"` e `"text"`. Ícones `Eye`/`EyeOff` indicam o estado atual. Padrão amplamente adotado (Google, GitHub, Stripe). Justificativa: evita erro de digitação em senha temporária sem expor a senha por padrão.

---

## Pré-condições
- TypeScript sem erros (`npm run lint` — confirmado ✅)
- 107 testes unitários passando (`npm run test:unit` — confirmado ✅)
- Dependência `lucide-react` já instalada no projeto (sem instalação necessária)

---

## Funções e módulos reutilizados
- `src/components/DriverForm.tsx` → ícones de `lucide-react` já importados no arquivo (`X`, `FileText`, `ExternalLink`, `Loader2`, `UserPlus`) — `Eye` e `EyeOff` serão adicionados à mesma importação existente
- Classe `inputClass` já definida na linha 250 — será reutilizada no input com ajuste de padding-right

---

## Restrições absolutas — o que NÃO fazer
- Não modificar nenhum outro arquivo além dos dois listados neste documento
- Não alterar o comportamento de salvamento da senha no `sessionStorage` — isso já existe e está fora do escopo
- Não adicionar toggle de senha à tela de Login (`src/pages/Login.tsx`) — fora do escopo desta sessão
- Não instalar nenhuma biblioteca nova — `lucide-react` já contém os ícones necessários
- Não alterar a lógica de validação (`minLength={6}`) nem o `onChange` do campo senha
- Não refatorar nenhuma outra parte do formulário

---

## Etapas de implementação

### Etapa 1 — Adicionar estado e ícones em DriverForm.tsx

**Padrão aplicado:** Password Visibility Toggle

**Arquivo a modificar:** `src/components/DriverForm.tsx`

**O que muda:**

**1.1 — Importação dos ícones**

Localizar a linha de importação existente:
```
import { X, FileText, ExternalLink, Loader2, UserPlus } from 'lucide-react';
```
Substituir por:
```
import { X, FileText, ExternalLink, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
```

**1.2 — Novo estado local**

Localizar o bloco de declarações de estado (após `const isCreating = !driver;`, antes do primeiro `useState`). Adicionar imediatamente após a linha `const [saving, setSaving] = useState(false);`:
```tsx
const [showPassword, setShowPassword] = useState(false);
```

**1.3 — Substituição do campo senha**

Localizar o bloco exato do campo senha temporária (dentro da seção `{isCreating && (...)}`, sub-div sem `sm:col-span-2`):

```tsx
<div>
  <label className="block text-sm font-medium text-zinc-700">
    Senha temporária<span className="text-red-500 ml-0.5">*</span>
  </label>
  <input
    type="password"
    required
    minLength={6}
    value={password}
    onChange={e => setPassword(e.target.value)}
    placeholder="Mínimo 6 caracteres"
    className={inputClass}
  />
  <p className="mt-1 text-xs text-zinc-400">O motorista deverá alterar a senha no primeiro acesso.</p>
</div>
```

Substituir por:
```tsx
<div>
  <label className="block text-sm font-medium text-zinc-700">
    Senha temporária<span className="text-red-500 ml-0.5">*</span>
  </label>
  <div className="relative">
    <input
      data-testid="password-input"
      type={showPassword ? 'text' : 'password'}
      required
      minLength={6}
      value={password}
      onChange={e => setPassword(e.target.value)}
      placeholder="Mínimo 6 caracteres"
      className={`${inputClass} pr-10`}
    />
    <button
      type="button"
      onClick={() => setShowPassword(prev => !prev)}
      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition-colors"
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
  <p className="mt-1 text-xs text-zinc-400">O motorista deverá alterar a senha no primeiro acesso.</p>
</div>
```

**O que permanece inalterado neste arquivo:** toda a lógica de salvamento, sessionStorage, validações, OCR, upload de arquivos, outros campos do formulário.

**Funções a implementar:**
- Nenhuma função nova — a lógica é inline: `() => setShowPassword(prev => !prev)` — estimativa: 1 linha

---

### Etapa 2 — Atualizar seletor no teste E2E de integração do motorista

**Arquivo a modificar:** `e2e/completed/driver-user-integration.spec.ts`

**O que muda:**

Localizar as linhas que usam o seletor `input[type="password"]` para o campo de senha do formulário de cadastro:
```ts
const passwordInput = page.locator('input[type="password"]').first();
await expect(passwordInput).toBeVisible();
await passwordInput.fill(driverPassword);
```

Substituir por:
```ts
const passwordInput = page.locator('[data-testid="password-input"]');
await expect(passwordInput).toBeVisible();
await passwordInput.fill(driverPassword);
```

**Por que este arquivo:** o seletor `input[type="password"]` quebraria caso o toggle esteja ativo (`type="text"`) durante a execução do teste. O `data-testid` é estável independentemente do estado do toggle.

**O que permanece inalterado:** toda a lógica do teste, demais seletores, asserts e fluxo de criação do motorista.

**Como verificar:** após a mudança, rodar `npx playwright test e2e/completed/driver-user-integration.spec.ts` e confirmar que o teste encontra o campo sem erro.

---

## Segurança
- O toggle expõe a senha visualmente apenas sob ação explícita do usuário (clique intencional) — risco de shoulder surfing aceito, comportamento padrão de mercado
- O atributo `type="button"` no botão de toggle é obrigatório para evitar que ele submeta o formulário acidentalmente
- O campo mantém `minLength={6}` e `required` independentemente do estado do toggle
- Nenhum dado de senha é enviado para log ou analytics

---

## Tratamento de erros
Não há operações assíncronas nesta etapa. O toggle é puramente local — não há casos de falha a tratar.

---

## Suite completa ao final
Após as duas etapas implementadas, execute:
```
npm run lint && npm run test:unit
```
Resultado esperado: 0 erros de TypeScript, 107 testes unitários passando.

Validação manual obrigatória:
1. Abrir `http://localhost:3000/cadastros/motoristas`
2. Clicar em "Cadastrar Motorista"
3. Rolar até o campo "Senha temporária"
4. Digitar uma senha qualquer (ex: `abc123`)
5. Clicar no ícone de olho — confirmar que a senha aparece em texto claro e o ícone muda para `EyeOff`
6. Clicar novamente — confirmar que a senha volta a ser ocultada e o ícone muda para `Eye`
7. Confirmar que o botão de olho NÃO submete o formulário ao ser clicado
8. Confirmar que o campo continua validando `minLength={6}`

---

## Critérios de conclusão
A implementação está completa quando:
- [ ] `npm run lint` passa sem erros
- [ ] `npm run test:unit` passa com 107 testes (0 falhando)
- [ ] Validação manual dos 8 passos acima confirmada
- [ ] O ícone alterna corretamente entre `Eye` e `EyeOff` ao clicar
- [ ] O botão de toggle NÃO submete o formulário
- [ ] O seletor do teste E2E foi atualizado para `data-testid="password-input"`

Se algum critério não for atendido: pare, informe o usuário e aguarde instrução. Não tente corrigir por conta própria sem comunicar.

---

## Decisões tomadas nesta sessão
- **`data-testid` no campo senha:** adicionado para estabilizar o seletor do teste E2E existente, que usava `input[type="password"]` — seletor frágil após o toggle
- **Toggle apenas na criação:** o campo senha só existe no modo `isCreating`. O toggle foi implementado apenas nesse contexto — não há campo de senha no modo edição

---

## Observações para sessões futuras
- A tela de Login (`src/pages/Login.tsx`) também tem campo de senha sem toggle — pode ser uma melhoria futura consistente com esta mudança
- Nenhum outro formulário do projeto possui campo de senha — escopo restrito ao DriverForm por ora

---

## Após a implementação
Quando todos os critérios de conclusão estiverem atendidos:

1. Atualize o `docs/MEMORY.md` com o estado atual
2. Mova os detalhes desta sessão para `docs/MEMORY-HISTORY.md`
3. Apresente sugestão de commit:

```
git add src/components/DriverForm.tsx e2e/completed/driver-user-integration.spec.ts
git commit -m "feat: adiciona toggle de visibilidade de senha no cadastro do motorista"
```

O commit só deve ser executado pelo usuário após validar que o resultado está como esperado.
