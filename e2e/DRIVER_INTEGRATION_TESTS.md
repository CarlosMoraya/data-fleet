# Testes E2E: Integração Motorista ↔ Usuário do Sistema

## Localização do Arquivo de Teste

```
e2e/driver-user-integration.spec.ts
```

## O que os Testes Cobrem

✅ **Criar motorista com email/senha** — DriverForm gera credenciais de login
✅ **Verificar profile_id** — Motorista é linkado a um perfil de usuário
✅ **Users.tsx filtrado** — Driver role não aparece na listagem
✅ **Driver não criável via Users.tsx** — Dropdown não oferece opção de criar Driver
✅ **Validação manual no Supabase** — Query para confirmar profile_id

## Como Rodar os Testes

### Pré-requisitos

1. **Dev server rodando:**
   ```bash
   npm run dev
   ```
   (Porta 3000)

2. **Perfis de auth configurados:**
   ```bash
   # Se ainda não foram criados:
   npx playwright test --project=setup-ana
   npx playwright test --project=setup-alexandre
   ```

### Opção 1: Rodar todos os testes desta suite

```bash
npx playwright test e2e/driver-user-integration.spec.ts --project=analyst --project=manager
```

### Opção 2: Rodar testes específicos

```bash
# Apenas criar motorista (Analyst profile)
npx playwright test driver-user-integration -g "1.1 Criar motorista"

# Apenas validações em Users.tsx (Manager profile)
npx playwright test driver-user-integration -g "2.1"

# Apenas validação manual (sem browser)
npx playwright test driver-user-integration -g "3.1"
```

### Opção 3: Com modo debug

```bash
npx playwright test e2e/driver-user-integration.spec.ts --debug
```

### Opção 4: Com interface visual

```bash
npx playwright test e2e/driver-user-integration.spec.ts --ui
```

## Estrutura dos Testes

### Grupo 1: Criar Motorista (Analyst Profile)
- **1.1** — Criar motorista via DriverForm com email/senha
  - Preenche: Email, Senha, Nome, CPF
  - Valida que a criação foi bem-sucedida
  - **Salve o email e senha exibidos no console para teste manual de login**

- **1.2** — Verificar que motorista aparece na lista

### Grupo 2: Validar Users.tsx (Manager Profile)
- **2.1** — Verificar que "Driver" role NÃO aparece no dropdown de criação
- **2.2** — Verificar que motorista criado NÃO aparece como "Driver" na lista

### Grupo 3: Validação Manual (Banco de Dados)
- **3.1** — Instruções para verificar `profile_id` no Supabase

## Saída Esperada

```
✓ driver-user-integration.spec.ts (grupo 1)
  ✓ 1.1 Criar motorista com email/senha via DriverForm
    ✓ Motorista criado: Driver Test 1710528000123
      Email: driver-1710528000123@test.datafleet.local
      Senha: TestPass1710528000123 (salve para próximos testes)
  ✓ 1.2 Verificar que motorista aparece na lista
    ✓ Motorista encontrado na lista

✓ driver-user-integration.spec.ts (grupo 2)
  ✓ 2.1 Verificar que Driver role NÃO aparece no dropdown
    ✓ Role "Driver" não aparece no dropdown de criação
  ✓ 2.2 Verificar que Driver NÃO aparece na lista
    ✓ Motorista não aparece como role "Driver" na lista

✓ driver-user-integration.spec.ts (grupo 3)
  ✓ 3.1 [MANUAL] Verificar profile_id no Supabase
    [Instruções SQL exibidas]
```

## Verificação Manual no Supabase

O teste 3.1 exibe uma query SQL para você executar no Supabase Dashboard:

1. Vá para **Supabase Dashboard** → seu projeto
2. **SQL Editor** (painel esquerdo)
3. Cole a query fornecida
4. Verifi que que:
   - `profile_id` ≠ NULL ✅
   - `email` = email criado ✅
   - `role` = "Driver" ✅

### Exemplo de Resultado Esperado

```
id                                   | name                    | cpf         | profile_id                           | email                              | role
-------------------------------------|------------------------|-------------|--------------------------------------|------------------------------------|---------
12345678-abcd-ef00-1234-567890abcdef | Driver Test 1710528000 | 99999999999 | 87654321-dcba-fe00-4321-0987654321ba | driver-1710528000123@test.d...     | Driver
```

## Troubleshooting

### ❌ "Arquivo de auth não encontrado: e2e/.auth/ana.json"

**Solução:** Execute o setup antes:
```bash
npx playwright test --project=setup-ana
npx playwright test --project=setup-alexandre
```

### ❌ "Motorista não aparece na lista"

**Verificar:**
1. Está logado como Analyst?
2. O modal do formulário abriu?
3. Todos os campos obrigatórios foram preenchidos?

**Debug:**
```bash
npx playwright test driver-user-integration --debug --headed
```

### ❌ "Email/Senha não aceitos ao fazer login"

**Verificar:**
1. Email e senha foram salvos corretamente?
2. Esperar ~2 segundos após criação (Edge Function pode levar tempo)
3. Verificar se `profile_id` foi preenchido (teste 3.1)

## Próximas Funcionalidades para Testar

- [ ] Login do motorista e redirecionamento para `/checklists`
- [ ] Motorista vê seu veículo associado
- [ ] Motorista consegue preencher checklist
- [ ] Exclusão de motorista remove profile também

## Notas para o Desenvolvedor

- **Nomes únicos:** Cada teste usa `Date.now()` para gerar nomes/emails únicos
- **Perfis:** Os testes assumem que `playwright.config.ts` tem suporte para `--project=analyst` e `--project=manager`
- **CPF fake:** Usa "99999999999" para não conflitar com dados reais
- **Async/await:** Todos os testes são `async` e usam `await` para aguardar elementos

---

**Criado:** 2026-03-14
**Autor:** Integração Motorista ↔ Usuário
**Status:** ✅ Pronto para usar com Playwright / Gemini
