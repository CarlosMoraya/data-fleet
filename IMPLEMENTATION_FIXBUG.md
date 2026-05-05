# IMPLEMENTATION_FIXBUG.md
Gerado em: 2026-05-05 06:13
Sessão: correção de bug — persistência de email/senha no formulário de cadastro de motorista
Tipo de bug: Tipo A — Isolado
Causa raiz confirmada: sim
Baseado em: docs/MEMORY.md (2026-04-11)

---

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação completa e fechada desta correção. O agente de código que executar este plano:

- NÃO modifica arquivos além dos listados aqui
- NÃO refatora código não relacionado ao bug
- NÃO "melhora" código que não está causando o problema
- NÃO instala dependências novas sem comunicar
- NÃO altera testes para fazê-los passar — corrige o código
- SE encontrar algo que parece errado mas não está neste documento: registra como observação no MEMORY.md e continua sem corrigir
- SE encontrar ambiguidade em qualquer passo: para, informa o usuário e aguarda instrução

---

## Contexto necessário
Antes de implementar, leia:
- `agent/AGENT.md` — regras universais do projeto
- `agent/AGENT-FRONTEND.md` — padrão de persistência via sessionStorage

---

## O bug

**Comportamento atual:** Ao preencher o formulário de cadastro de motorista (nome, CPF, CNH, e-mail, senha) e navegar para outra página da aplicação, ao retornar à página de motoristas o formulário reabre (estado `driverFormOpen` é restaurado do sessionStorage), mas os campos **E-mail** e **Senha temporária** estão vazios.

**Comportamento esperado:** Todos os campos preenchidos — incluindo E-mail e Senha temporária — devem ser restaurados exatamente como estavam antes da navegação.

**Condições de reprodução:**
1. Ir até `/cadastros/motoristas`
2. Clicar em "Adicionar Motorista"
3. Preencher E-mail, Senha temporária, Nome e CPF
4. Navegar para outra rota (ex: Dashboard)
5. Voltar para `/cadastros/motoristas`
6. Observar: o formulário reabre, mas E-mail e Senha temporária estão vazios

**Impacto:** Todos os usuários que criam motoristas. Perda de dados digitados a cada navegação acidental durante o preenchimento.

---

## Causa raiz identificada

Em `src/components/DriverForm.tsx`, os campos `email` (linha 45) e `password` (linha 46) são declarados como `useState('')` simples:

```ts
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```

O mecanismo de persistência existente salva apenas `formData` (campos do tipo `Driver`) no sessionStorage. Os campos `email` e `password` ficam de fora completamente — não são lidos na inicialização do componente nem gravados quando mudam.

Quando o usuário navega para outra rota, o componente desmonta e esses dois valores são perdidos. Ao retornar, o componente remonta com `email = ''` e `password = ''`.

Por que `formData` funciona e esses dois não: `formData` usa um initializer lazy (`useState(() => sessionStorage.getItem(...))`) e um `useEffect` que grava a cada mudança. Os campos `email` e `password` nunca receberam o mesmo tratamento.

---

## Estado dos testes antes da correção — baseline

- **Testes de fumaça (E2E):** 6 setups de autenticação falhando — não conseguem logar em `localhost:3000`. 266 testes não rodaram. **PRÉ-EXISTENTE**, registrado em `docs/MEMORY.md` como tarefa em andamento. Não relacionado a este bug.
- **Typecheck:** PASSOU — sem erros
- **Lint:** PASSOU — (`lint = tsc --noEmit`)
- **Testes falhando relacionados ao bug:** nenhum (comportamento não estava coberto por testes)
- **Testes falhando não relacionados ao bug:** 6 setups E2E — não são responsabilidade desta correção e não devem piorar

---

## Dependências mapeadas

**Arquivo `src/components/DriverForm.tsx`** é consumido exclusivamente por `src/pages/Drivers.tsx`. A mudança adicionará leitura/escrita no sessionStorage para duas chaves novas (`driverFormEmail`, `driverFormPassword`). Isso não altera nenhuma prop, nenhum tipo exportado, nenhum contrato de interface. O componente `DriverDetailModal.tsx` e o serviço `driverService.ts` não são afetados.

**Arquivo `src/pages/Drivers.tsx`** receberá limpeza das duas novas chaves de sessionStorage na função `handleSave` (após salvar com sucesso). Nenhuma lógica de negócio, query ou estado de UI será alterado.

---

## O que NÃO fazer — restrições absolutas

- Não modificar `src/lib/driverMappers.ts` — a causa raiz não está no mapper
- Não modificar `src/services/driverService.ts` — a causa raiz não está no serviço
- Não alterar o tipo `Driver` em `src/types` para incluir email/password — esses campos não pertencem ao modelo de domínio do motorista
- Não refatorar o mecanismo de sessionStorage para uma abstração genérica — isso é escopo futuro com `evolucao.md`
- Não alterar testes E2E existentes para fazê-los passar — a falha de autenticação é pré-existente e não é escopo desta correção

---

## Correção

### Passo 1 — Persistir email e password no sessionStorage (DriverForm.tsx)

**Arquivo:** `src/components/DriverForm.tsx`

**Causa que justifica tocar neste arquivo:** É aqui que `email` e `password` são declarados e onde o mecanismo de sessionStorage já existe para `formData`.

**O que mudar:**

1. Alterar a inicialização de `email` (linha 45) para ler do sessionStorage:
```ts
// ANTES
const [email, setEmail] = useState('');

// DEPOIS
const [email, setEmail] = useState(() => {
  return sessionStorage.getItem('driverFormEmail') ?? '';
});
```

2. Alterar a inicialização de `password` (linha 46) para ler do sessionStorage:
```ts
// ANTES
const [password, setPassword] = useState('');

// DEPOIS
const [password, setPassword] = useState(() => {
  return sessionStorage.getItem('driverFormPassword') ?? '';
});
```

3. Adicionar dois `useEffect` para gravar as mudanças, logo após o `useEffect` existente que grava `formData` (após a linha 80):
```ts
useEffect(() => {
  if (isCreating) {
    sessionStorage.setItem('driverFormEmail', email);
  }
}, [email, isCreating]);

useEffect(() => {
  if (isCreating) {
    sessionStorage.setItem('driverFormPassword', password);
  }
}, [password, isCreating]);
```

> **Nota:** os `useEffect` só gravam em modo de criação (`isCreating = true`) porque os campos email/password não aparecem no modo de edição. Gravar em modo de edição seria inócuo mas poderia causar confusão futura.

4. Adicionar limpeza das novas chaves na função `handleClose` (após linha 228, dentro do bloco existente):
```ts
const handleClose = () => {
  sessionStorage.removeItem('driverFormOpen');
  sessionStorage.removeItem('driverFormEditing');
  sessionStorage.removeItem('driverFormData');
  sessionStorage.removeItem('driverFormEmail');    // ADICIONAR
  sessionStorage.removeItem('driverFormPassword'); // ADICIONAR
  onClose();
};
```

**O que NÃO mudar neste arquivo:** Todo o restante — lógica de upload, OCR, validação de campos obrigatórios, `formData`, `handleSubmit`, estilos, componentes internos.

**Impacto em dependências:** Nenhum. As novas chaves de sessionStorage são isoladas ao ciclo de vida deste componente. Não há outros componentes lendo `driverFormEmail` ou `driverFormPassword`.

**Como verificar este passo:**
```
1. Abrir localhost:3000/cadastros/motoristas
2. Clicar "Adicionar Motorista"
3. Preencher E-mail: "teste@empresa.com" e Senha: "senha123"
4. Preencher Nome: "João Teste"
5. Navegar para o Dashboard (sidebar)
6. Voltar para /cadastros/motoristas
7. Resultado esperado: formulário reabre com E-mail "teste@empresa.com", Senha "senha123" e Nome "João Teste" preenchidos
```

---

### Passo 2 — Limpar as novas chaves após salvar com sucesso (Drivers.tsx)

**Arquivo:** `src/pages/Drivers.tsx`

**Causa que justifica tocar neste arquivo:** A função `handleSave` (linha 98) já faz a limpeza das chaves existentes de sessionStorage após um save bem-sucedido. As novas chaves precisam ser incluídas nessa limpeza para não persistirem após o cadastro ser concluído.

**O que mudar:**

Na função `handleSave` (linhas 108-110), adicionar as novas remoções:
```ts
// ANTES
sessionStorage.removeItem('driverFormOpen');
sessionStorage.removeItem('driverFormEditing');
sessionStorage.removeItem('driverFormData');

// DEPOIS
sessionStorage.removeItem('driverFormOpen');
sessionStorage.removeItem('driverFormEditing');
sessionStorage.removeItem('driverFormData');
sessionStorage.removeItem('driverFormEmail');    // ADICIONAR
sessionStorage.removeItem('driverFormPassword'); // ADICIONAR
```

**O que NÃO mudar neste arquivo:** Queries, estado `isFormOpen`, `editingDriver`, lógica de deleção, permissões por role, tabela de motoristas.

**Impacto em dependências:** Nenhum. A mudança é apenas a remoção de chaves de sessionStorage após o save já concluído.

**Como verificar este passo:**
```
1. Preencher e salvar um motorista com sucesso
2. Verificar no DevTools > Application > Session Storage
3. Resultado esperado: as chaves driverFormEmail e driverFormPassword NÃO existem mais após o save
```

---

## Testes novos a escrever

**Teste de regressão — persistência do formulário de motorista durante navegação**

Camada: E2E (depende de navegação real entre rotas, autenticação e estado de componente)

Arquivo sugerido: `e2e/completed/driver-form-persistence.spec.ts`

O que valida: garantir que nenhum campo do formulário de cadastro de motorista (incluindo email e senha temporária) seja perdido ao navegar para outra rota e retornar.

Cenários a cobrir:
1. **Persistência completa:** preencher email, senha, nome e CPF → navegar para Dashboard → voltar → todos os campos devem estar preenchidos
2. **Limpeza após cancelar:** preencher campos → clicar Cancelar → reabrir formulário → formulário deve estar vazio
3. **Limpeza após salvar:** preencher e salvar → abrir novo formulário → campos vazios (não contaminados pelo cadastro anterior)

---

## Verificação final

Após todos os passos:

1. Rode o teste específico do bug (manual — E2E de persistência ainda não existe):
```
1. localhost:3000/cadastros/motoristas
2. Adicionar Motorista → preencher todos os campos incluindo E-mail e Senha
3. Navegar para outra rota e voltar
4. Resultado esperado: todos os campos restaurados, incluindo E-mail e Senha
```

2. Rode o typecheck:
```
npx tsc --noEmit
```
Resultado esperado: zero erros.

3. Execute os testes existentes de driver (quando o ambiente de autenticação estiver funcional):
```
npx playwright test e2e/completed/driver-user-integration.spec.ts
```
Resultado esperado: todos os testes que passavam antes devem continuar passando. A correção não altera nenhum fluxo de criação ou edição de motorista.

Se qualquer verificação falhar: pare, informe o usuário com o resultado exato e aguarde instrução. Não tente corrigir por conta própria sem comunicar.

---

## Observações para sessões futuras

1. **Mecanismo de persistência de formulários não é padronizado:** cada formulário que usa sessionStorage (Manutenção, Pneus, ChecklistTemplates, agora Motoristas) implementa as mesmas 3 linhas de forma duplicada. Uma abstração genérica `useFormPersistence(key, initialValue)` eliminaria esse padrão repetido. Tratar com `evolucao.md` em sessão futura.

2. **Armazenamento de senha em sessionStorage:** a senha temporária é definida pelo administrador (não é a senha pessoal do usuário logado). O risco é baixo dado que sessionStorage é tab-scoped e limpo ao fechar o navegador. Ainda assim, para uma camada extra de segurança futura, considerar criptografar antes de armazenar, ou não persistir senha e apenas persistir email.

3. **Falhas nos setups de autenticação E2E:** os 6 setups estão falhando por não conseguir logar em localhost:3000. Isso pode indicar que as credenciais de teste expiraram ou que o seeding de usuários precisa ser refeito. Já registrado em MEMORY.md como tarefa em andamento.

---

## Registro para o docs/MEMORY.md
Após a correção confirmada, adicione ao docs/MEMORY.md:

```
Bug corrigido: campos email e senha temporária não persistiam no formulário de cadastro de motorista ao navegar entre rotas
Causa raiz: useState('') simples para email e password, sem initializer de sessionStorage e sem useEffect de persistência, ao contrário do formData que já tinha esse mecanismo
Correção aplicada: adicionados initializers lazy de sessionStorage e useEffects de persistência para email e password; limpeza adicionada em handleClose e handleSave
Arquivos modificados: src/components/DriverForm.tsx, src/pages/Drivers.tsx
Testes adicionados: e2e/completed/driver-form-persistence.spec.ts (a criar)
```

---

## Sugestão de commit
Quando todos os critérios de conclusão estiverem atendidos e você confirmar que o bug foi corrigido:

```
git add src/components/DriverForm.tsx src/pages/Drivers.tsx
git commit -m "fix: persistir email e senha temporária no formulário de motorista durante navegação"
```
