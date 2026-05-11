# IMPLEMENTATION.md
Gerado em: 2026-05-11 09:45
Sessão: Toggle de visibilidade de senha na tela de login
Tipo de mudança: Tipo 1 — Adição sem impacto em código existente
Baseado em: agent/AGENT-FRONTEND.md + docs/MEMORY.md (2026-05-11)

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
- `agent/AGENT-FRONTEND.md` — stack e padrões de frontend

---

## O produto e a mudança
**O que é este produto:** βetaFleet é um sistema SaaS de gestão de frotas com múltiplos perfis de acesso (Admin Master, Manager, Analyst, Driver, etc.), construído com React 19 + Vite + Tailwind CSS v4 + Supabase.

**O que será implementado:** Adição de um botão de toggle (ícone Eye/EyeOff) ao campo de senha da tela de login, permitindo que o usuário alterne entre visualizar e ocultar a senha digitada. A única mudança é em `src/pages/Login.tsx`.

---

## Padrões de mercado aplicados
- **Controlled Input with Toggle**: alternância do atributo `type` do input entre `"password"` e `"text"` via estado local React. Padrão amplamente adotado para visibilidade de senha, sem dependências extras.

---

## Pré-condições
- TypeCheck passando: ✅ confirmado (2026-05-11)
- Testes de autenticação passando: ✅ confirmado — 33 testes passando, falhas são pré-existentes e não relacionadas
- `lucide-react ^0.546.0` já instalado no projeto — ícones `Eye` e `EyeOff` disponíveis

---

## Funções e módulos reutilizados
- `lucide-react` → ícones `Eye` e `EyeOff` — importados diretamente, sem wrapper adicional
- `useState` do React — já importado em `src/pages/Login.tsx`

---

## Restrições absolutas — o que NÃO fazer
- Não criar nenhum componente novo — a mudança é autocontida em Login.tsx
- Não instalar nenhuma dependência nova — lucide-react já está no projeto
- Não alterar os campos de email, o botão de submit, a lógica de autenticação, o layout de fundo (vídeo/imagem) nem nenhum outro elemento da tela
- Não adicionar tooltip, label extra ou texto ao botão do toggle — apenas o ícone
- Não refatorar a estrutura do componente Login além do especificado aqui
- Não modificar `e2e/completed/auth.spec.ts` — os testes existentes continuam válidos porque o toggle inicia com senha oculta (`type="password"`)

---

## Etapas de implementação

### Etapa 1 — Adicionar estado e importação dos ícones

**Padrão aplicado:** Controlled Input with Toggle

**O que fazer:**
No arquivo `src/pages/Login.tsx`:

1. Adicionar novo import na linha 1 (após os imports existentes):
   ```
   import { Eye, EyeOff } from 'lucide-react';
   ```

2. Dentro do componente `Login`, após a declaração do estado `imageFailed` (linha 11), adicionar o novo estado:
   ```
   const [showPassword, setShowPassword] = useState(false);
   ```

**Arquivos a modificar:**
- `src/pages/Login.tsx`
  - O que muda: adição de 1 import e 1 declaração de estado
  - O que permanece: toda a lógica de autenticação, todos os outros estados, o layout completo
  - Por que este arquivo: é o único arquivo que contém o campo de senha do login

**Como verificar:**
O arquivo deve compilar sem erros de TypeScript. Rode `npx tsc --noEmit` — resultado esperado: sem output (zero erros).

---

### Etapa 2 — Modificar o campo de senha com o toggle

**Padrão aplicado:** Controlled Input with Toggle

**O que fazer:**
Substituir o bloco atual do campo "Senha" em `src/pages/Login.tsx` pelo seguinte.

**Bloco atual a substituir** (identificado pelo label "Senha" — atualmente linhas 95–107):
```jsx
<div>
  <label className="block text-sm font-medium text-zinc-700">Senha</label>
  <div className="mt-1">
    <input
      type="password"
      required
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
      placeholder="••••••••"
    />
  </div>
</div>
```

**Substituir por:**
```jsx
<div>
  <label className="block text-sm font-medium text-zinc-700">Senha</label>
  <div className="relative mt-1">
    <input
      type={showPassword ? 'text' : 'password'}
      required
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="block w-full appearance-none rounded-xl border border-zinc-200 px-3 py-2 pr-10 placeholder-zinc-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
      placeholder="••••••••"
    />
    <button
      type="button"
      onClick={() => setShowPassword((prev) => !prev)}
      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition-colors"
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
</div>
```

**Detalhes de cada mudança:**
- `type={showPassword ? 'text' : 'password'}` — alterna a visibilidade da senha
- `pr-10` adicionado ao `className` do input — garante que o texto digitado não sobreponha o ícone
- `<div className="relative mt-1">` — muda de `<div className="mt-1">` para habilitar o posicionamento absoluto do botão
- `<button type="button">` — `type="button"` é obrigatório para evitar que o clique submeta o formulário
- `aria-label` — acessibilidade: anuncia a ação correta para leitores de tela
- `<Eye size={18} />` quando senha oculta (estado inicial), `<EyeOff size={18} />` quando visível

**Arquivos a modificar:**
- `src/pages/Login.tsx`
  - O que muda: o bloco do campo "Senha" conforme especificado acima
  - O que permanece: tudo o que não é o campo "Senha"

**Estimativa de linhas adicionadas:** 12 linhas no JSX. Dentro do limite de 30 linhas.

**Como verificar:**
1. A aplicação renderiza sem erros no console
2. O ícone de olho (Eye) aparece à direita do campo "Senha"
3. Ao clicar no ícone: a senha digitada fica visível e o ícone muda para EyeOff (olho riscado)
4. Ao clicar novamente: a senha fica oculta e o ícone volta para Eye
5. Clicar no ícone NÃO submete o formulário

---

## Segurança
- **Sem risco**: a alternância `type="password"` ↔ `type="text"` é um comportamento padrão do DOM. A senha nunca é transmitida de forma diferente — a mudança é puramente visual no cliente.
- **`type="button"` obrigatório**: sem ele, qualquer clique dentro do `<form>` dispararia o submit. Está especificado explicitamente acima.
- **Sem armazenamento adicional**: `showPassword` é estado efêmero — não persiste em sessionStorage, localStorage nem em nenhum outro mecanismo.

---

## Tratamento de erros
Não há operações que possam falhar nesta implementação. O toggle é uma operação de estado local síncrona sem chamadas externas.

---

## Validação manual guiada

Esta mudança é puramente visual e depende de interação com o browser. Não é necessário escrever teste unitário ou E2E novo porque a lógica é trivial (alternância de um boolean) e o fluxo de login já está coberto por `e2e/completed/auth.spec.ts`.

Execute manualmente após a implementação:

1. Abra `http://localhost:3000/login`
2. **Cenário 1 — Estado inicial:** o campo "Senha" exibe o ícone Eye à direita; ao digitar, os caracteres aparecem como `•`
3. **Cenário 2 — Mostrar senha:** clique no ícone Eye → caracteres ficam visíveis → ícone muda para EyeOff
4. **Cenário 3 — Ocultar novamente:** clique no ícone EyeOff → caracteres voltam a `•` → ícone volta para Eye
5. **Cenário 4 — Sem impacto no submit:** com o campo preenchido, clique no ícone → formulário NÃO é submetido
6. **Cenário 5 — Login funcional após toggle:** deixe a senha visível e clique em "Entrar" → login ocorre normalmente e redireciona para `/`

---

## Suite completa ao final
Após todas as etapas implementadas, execute:
```
npx tsc --noEmit
```
Resultado esperado: sem output (zero erros de tipo).

```
npx playwright test e2e/completed/auth.spec.ts --reporter=list
```
Resultado esperado: 3 testes passando, 0 falhando.

---

## Critérios de conclusão
A implementação está completa quando:
- [ ] `npx tsc --noEmit` passa sem erros
- [ ] Os 3 testes de `auth.spec.ts` passam (os mesmos que passavam antes)
- [ ] A validação manual dos 5 cenários acima está concluída
- [ ] O ícone está visualmente alinhado ao campo, sem sobreposição de texto
- [ ] Clicar no ícone não submete o formulário

Se algum critério não for atendido: pare, informe o usuário e aguarde instrução. Não tente corrigir por conta própria sem comunicar.

---

## Decisões tomadas nesta sessão
- **Sem componente separado**: a lógica é simples o suficiente para permanecer inline no Login.tsx. Criar um `PasswordInput` reutilizável introduziria abstração prematura — não há outro campo de senha no projeto que se beneficiaria dela no momento.
- **`size={18}`**: tamanho equilibrado para não dominar o campo visualmente e manter proporção com o padding `pr-10`.
- **Teste E2E não criado**: o comportamento do toggle é um boolean local sem lógica de negócio. A cobertura existente do fluxo de login (`auth.spec.ts`) é suficiente. A validação manual guiada cobre os cenários visuais que não fazem sentido em teste automatizado.

---

## Observações para sessões futuras
- Se futuramente houver campo de senha em outros formulários (cadastro, troca de senha), considerar extrair um componente `PasswordInput` reutilizável.
- O teste `auth.spec.ts` usa o seletor `input[type="password"]` — se algum dia o toggle precisar persistir o estado "visível" entre navegações, esse seletor precisaria ser atualizado.

---

## Após a implementação
Quando todos os critérios de conclusão estiverem atendidos:

1. Atualize o `docs/MEMORY.md` — registre que o toggle de senha foi adicionado ao login
2. Mova os detalhes desta sessão para `docs/MEMORY-HISTORY.md`
3. Sugestão de commit:

```
git add src/pages/Login.tsx
git commit -m "feat: adicionar toggle de visibilidade de senha na tela de login"
```

O commit só deve ser executado após validar que o resultado está como esperado.
