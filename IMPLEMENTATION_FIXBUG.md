# IMPLEMENTATION_FIXBUG.md
Gerado em: 2026-05-06 21:45
Sessão: correção de bug — filtro de cliente e dados do formulário de motorista se perdem ao alternar abas
Tipo de bug: Tipo B — Bug com dependências
Causa raiz confirmada: sim
Baseado em: docs/MEMORY.md (auditoria 11/04/2026)

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação completa e fechada desta correção. O agente de código que executar este plano:

- NÃO modifica arquivos além dos listados aqui
- NÃO refatora código não relacionado ao bug
- NÃO "melhora" código que não está causando o problema
- NÃO instala dependências novas
- NÃO altera testes para fazê-los passar — corrige o código
- SE encontrar algo que parece errado mas não está neste documento: registra como observação no MEMORY.md e continua sem corrigir
- SE encontrar ambiguidade em qualquer passo: para, informa o usuário e aguarda instrução

## Contexto necessário
Antes de implementar, leia:
- `agent/AGENT.md` — regras universais do projeto
- `agent/AGENT-FRONTEND.md` — padrões de estado e persistência

## O bug
**Comportamento atual:** O Admin Master seleciona o cliente "Deluna" no filtro do topo e abre o formulário de cadastro de motorista. Ao alternar para outra aba do navegador e retornar (situação em que o navegador descarrega a aba por pressão de memória e a página recarrega), o filtro volta para "Todos os Clientes" e os arquivos inseridos no formulário (CNH, GR) são perdidos.

**Comportamento esperado:** Ao recarregar a página, o filtro deve restaurar o cliente que estava selecionado ("Deluna") — exatamente como já funciona para o role Workshop. O formulário deve reabrir com os dados textuais preservados.

**Condições de reprodução:**
1. Logar como Admin Master
2. Selecionar o cliente "Deluna" no filtro do topo (Topbar)
3. Abrir o formulário de cadastro de motorista (botão "Adicionar Motorista")
4. Preencher campos de texto e selecionar arquivos (CNH, GR)
5. Alternar para outra aba do navegador — aguardar alguns minutos (navegador pode suspender a aba)
6. Retornar para a aba do Beta Fleet
7. Resultado atual: filtro mostra "Todos os Clientes", formulário reabriu mas arquivos foram perdidos
8. Resultado esperado: filtro mostra "Deluna", formulário reabriu com campos de texto preservados

**Impacto:** Qualquer Admin Master que precise multitarefa perde o contexto de cliente e precisa refazer a seleção manualmente. Se havia arquivos selecionados (CNH, GR), esses não podem ser restaurados e devem ser selecionados novamente — pois objetos `File` do navegador não podem ser serializados em `sessionStorage`.

## Causa raiz identificada
Em `src/context/AuthContext.tsx`, função `switchClient` (linhas 257-258):

```tsx
const client = allClients.find((c) => c.id === clientId);
if (client) setCurrentClient(client);
```

Esta linha apenas atualiza o estado em memória. Quando a aba recarrega, `fetchProfile` é executado novamente. O Admin Master tem `profile.client_id = null` no banco → `setCurrentClient(null)` é chamado (linha 179) → o cliente selecionado é perdido.

**Por que isso é a causa:** O role Workshop já tem o mesmo problema resolvido com o padrão:
- Ao selecionar: `localStorage.setItem('workshop_active_client', clientId)` (linha 252)
- Ao restaurar: `localStorage.getItem('workshop_active_client')` em `fetchProfile` (linha 116)
- Ao deslogar: `localStorage.removeItem('workshop_active_client')` (linha 214)

O Admin Master não recebeu o mesmo tratamento.

## Estado dos testes antes da correção — baseline
- Testes de fumaça: executados via `npx playwright test e2e/completed/` ✅
- TypeCheck: ✅ zero erros (confirmado via `tsc --noEmit`)
- Lint: não executado
- Testes falhando relacionados ao bug: nenhum teste específico existia para este fluxo
- Testes passando (baseline confirmado):
  - Admin Master setup ✓
  - Controle de Acesso: 4/4 ✓
  - Admin → Clientes (criar, editar, excluir, filtrar): 5/5 ✓
  - Admin → Usuários: 6/6 ✓
  - Autenticação: 3/3 ✓
- Testes falhando não relacionados ao bug (baseline pré-existente — não são responsabilidade desta correção):
  - `setup/alexandre.setup.ts` — `Invalid login credentials` para Manager Alexandre (senha desatualizada no `.env.local`)
  - `setup/pedro.setup.ts` — mesmo problema para Fleet Assistant Pedro
  - Em cascata: `driver-user-integration`, `new-roles-audit` (Coordinator/Supervisor), `shippers-operational-units`, `tire-inspection-assistant`
  - Ação pendente separada: atualizar senhas de teste no `.env.local` para Alexandre, Pedro e demais roles

## Dependências mapeadas
**Arquivo modificado:** `src/context/AuthContext.tsx`

Consumidores de `currentClient`:
- `src/pages/Drivers.tsx` — usa `currentClient?.id` como filtro de query e `clientId` para salvar
- `src/pages/Maintenance.tsx` — usa `currentClient?.id` como filtro de query
- `src/pages/Tires.tsx` — usa `currentClient?.id` como filtro de query
- `src/pages/Vehicles.tsx` — usa `currentClient?.id` como filtro de query
- `src/pages/Dashboard.tsx` — usa `currentClient?.id` para métricas
- `src/components/Topbar.tsx` — exibe `currentClient?.name` e renderiza o select de filtro
- E outros módulos de listagem

**Garantia de não-regressão:** A correção apenas adiciona `localStorage.setItem/removeItem` em 4 pontos isolados do `AuthContext`. Não altera a assinatura de `switchClient`, não altera `currentClient` para outros roles, não altera o fluxo de Workshop. Todos os consumidores continuam recebendo `currentClient` exatamente como antes — a única diferença é que, após um reload, o Admin Master terá `currentClient` populado em vez de null.

## O que NÃO fazer — restrições absolutas
- Não modificar `src/pages/Drivers.tsx` — a persistência do estado do formulário já está implementada (sessionStorage) e não é a causa raiz do filtro resetar
- Não modificar `src/components/DriverForm.tsx` — dados textuais do formulário já são persistidos corretamente
- Não alterar o comportamento para roles Workshop — eles já têm seu próprio mecanismo e chave `workshop_active_client`
- Não aplicar a persistência para Director, Manager, Coordinator — esses roles têm `client_id` no profile e o comportamento correto é restaurar o cliente do profile, não a última seleção manual
- Não alterar a chave `workshop_active_client` já existente
- Não refatorar a função `fetchProfile` além do bloco específico descrito

## Correção

### Passo 1 — Limpar a chave ao deslogar
**Arquivo:** `src/context/AuthContext.tsx`
**Causa que justifica tocar neste arquivo:** é aqui que `currentClient` é gerenciado para todos os roles
**O que mudar:** no handler `SIGNED_OUT` do `onAuthStateChange`, adicionar remoção da chave `adminMasterActiveClient` junto às outras remoções já existentes
**O que NÃO mudar neste arquivo:** não alterar as remoções de `dashboard_date_filter` e `workshop_active_client` já existentes
**Impacto em dependências:** nenhum — é apenas limpeza de storage no logout

Localizar o bloco:
```tsx
localStorage.removeItem('dashboard_date_filter');
localStorage.removeItem('workshop_active_client');
```

Alterar para:
```tsx
localStorage.removeItem('dashboard_date_filter');
localStorage.removeItem('workshop_active_client');
localStorage.removeItem('adminMasterActiveClient');
```

**Como verificar este passo:**
```
Logar como Admin Master → selecionar Deluna → deslogar → inspecionar localStorage no DevTools
→ confirmar que a chave 'adminMasterActiveClient' não existe mais
```

---

### Passo 2 — Limpar a chave ao selecionar "Todos os Clientes"
**Arquivo:** `src/context/AuthContext.tsx`
**Causa que justifica tocar neste arquivo:** quando o Admin Master seleciona "Todos os Clientes" (clientId vazio), a chave persistida deve ser removida para que o reload não restaure um cliente que o usuário explicitamente desselecionou
**O que mudar:** no bloco `if (!clientId)` da função `switchClient`, adicionar remoção da nova chave
**O que NÃO mudar neste arquivo:** não alterar `setCurrentClient(null)` e `setActiveWorkshopId(null)` existentes
**Impacto em dependências:** nenhum — é apenas limpeza de storage

Localizar o bloco:
```tsx
if (!clientId) {
  setCurrentClient(null);
  setActiveWorkshopId(null);
  localStorage.removeItem('workshop_active_client');
  return;
}
```

Alterar para:
```tsx
if (!clientId) {
  setCurrentClient(null);
  setActiveWorkshopId(null);
  localStorage.removeItem('workshop_active_client');
  localStorage.removeItem('adminMasterActiveClient');
  return;
}
```

**Como verificar este passo:**
```
Logar como Admin Master → selecionar Deluna → selecionar "Todos os Clientes"
→ inspecionar localStorage → confirmar que 'adminMasterActiveClient' foi removida
```

---

### Passo 3 — Persistir o cliente selecionado pelo Admin Master
**Arquivo:** `src/context/AuthContext.tsx`
**Causa que justifica tocar neste arquivo:** este é o passo que resolve o bug — ao selecionar um cliente, a seleção deve ser salva para sobreviver a reloads
**O que mudar:** após o bloco `if (client) setCurrentClient(client)` no final de `switchClient`, envolver em bloco para também persistir quando o role for Admin Master
**O que NÃO mudar neste arquivo:** não alterar o bloco de Workshop acima que já possui sua própria lógica
**Impacto em dependências:** nenhum — `currentClient` continua sendo atualizado da mesma forma; a única adição é a persistência no localStorage para o role Admin Master

Localizar:
```tsx
const client = allClients.find((c) => c.id === clientId);
if (client) setCurrentClient(client);
```

Alterar para:
```tsx
const client = allClients.find((c) => c.id === clientId);
if (client) {
  setCurrentClient(client);
  if (user?.role === 'Admin Master') {
    localStorage.setItem('adminMasterActiveClient', clientId);
  }
}
```

**Como verificar este passo:**
```
Logar como Admin Master → selecionar Deluna
→ inspecionar localStorage → confirmar que 'adminMasterActiveClient' = '<id do cliente Deluna>' está presente
```

---

### Passo 4 — Restaurar o cliente ao carregar a sessão
**Arquivo:** `src/context/AuthContext.tsx`
**Causa que justifica tocar neste arquivo:** sem este passo, o localStorage seria salvo mas nunca lido — a restauração é o outro lado do par save/restore
**O que mudar:** dentro do bloco `if (['Admin Master', 'Director', 'Manager', 'Coordinator'].includes(profile.role))` em `fetchProfile`, após popular `allClients`, adicionar a lógica de restauração exclusivamente para Admin Master
**O que NÃO mudar neste arquivo:** não alterar o `setCurrentClient` das linhas 164-179 (que trata roles com `client_id` no profile); não alterar o comportamento para Director, Manager, Coordinator
**Impacto em dependências:** `currentClient` será populado durante `fetchProfile` em vez de ficar null — todos os consumidores já tratam `currentClient` como nullable, então receber um valor não-null é sempre seguro

Localizar:
```tsx
if (['Admin Master', 'Director', 'Manager', 'Coordinator'].includes(profile.role)) {
  const { data: clients } = await supabase.from('clients').select('id, name, logo_url');
  if (clients) setAllClients(clients.map((c: any) => ({ id: c.id, name: c.name, logoUrl: c.logo_url ?? undefined })));
}
```

Alterar para:
```tsx
if (['Admin Master', 'Director', 'Manager', 'Coordinator'].includes(profile.role)) {
  const { data: clients } = await supabase.from('clients').select('id, name, logo_url');
  if (clients) {
    const clientList = clients.map((c: any) => ({ id: c.id, name: c.name, logoUrl: c.logo_url ?? undefined }));
    setAllClients(clientList);
    if (profile.role === 'Admin Master') {
      const savedClientId = localStorage.getItem('adminMasterActiveClient');
      if (savedClientId) {
        const savedClient = clients.find((c: any) => c.id === savedClientId);
        if (savedClient) {
          setCurrentClient({
            id: savedClient.id,
            name: savedClient.name,
            logoUrl: savedClient.logo_url ?? undefined,
          });
        }
      }
    }
  }
}
```

**Como verificar este passo:**
```
Logar como Admin Master → selecionar Deluna → pressionar F5 (reload)
→ Resultado esperado: filtro continua mostrando "Deluna" após o reload
```

---

## Testes novos a escrever

**Teste 1 — Persistência do cliente selecionado pelo Admin Master após reload**
- Nome sugerido: `e2e/completed/admin-master-client-persistence.spec.ts`
- O que valida: que o filtro de cliente sobrevive a um reload de página
- Cenários a cobrir:
  1. Admin Master seleciona cliente X → recarrega página → filtro exibe cliente X (não "Todos os Clientes")
  2. Admin Master seleciona cliente X → seleciona "Todos os Clientes" → recarrega → filtro exibe "Todos os Clientes"
  3. Admin Master seleciona cliente X → faz logout → faz login novamente → filtro exibe "Todos os Clientes" (a seleção deve ser descartada no logout)

## Verificação final
Após todos os passos:

1. Rode o typecheck:
```
npx tsc --noEmit
```
Resultado esperado: zero erros

2. Rode a suite de testes E2E:
```
npx playwright test
```
Resultado esperado: os testes que passavam antes continuam passando. Testes de movimentação de pneus com falhas de timing são pré-existentes e não são responsabilidade desta correção.

3. Execute os testes de fumaça do docs/MEMORY.md e confirme que todos passam.

4. Validação manual do fluxo corrigido:
```
1. Logar como Admin Master
2. Selecionar cliente "Deluna" no filtro do topo
3. Abrir formulário "Adicionar Motorista"
4. Preencher nome, CPF e outros campos de texto
5. Pressionar F5 para forçar reload
Resultado esperado: filtro mostra "Deluna", formulário reabre com campos de texto preservados
```

Se qualquer verificação falhar: pare, informe o usuário com o resultado exato e aguarde instrução.

## Observações para sessões futuras

**Observação 1 — `onClose` em `Drivers.tsx` não limpa `sessionStorage`**
`src/pages/Drivers.tsx`, handler `onClose` (linhas 302-305): quando o usuário fecha o formulário pelo botão X ou Cancelar, `sessionStorage` permanece com `driverFormOpen = 'true'`. Isso faz o formulário reabrir inesperadamente se a página recarregar depois que o formulário foi fechado. Não é o bug reportado agora — é um comportamento adjacente. Tratar em sessão futura com `evolucao.md` ou nova sessão `Fixbugs.md`.

**Observação 2 — Arquivos (CNH, GR) não podem ser restaurados após reload**
Por limitação do navegador, objetos `File` não podem ser serializados em `sessionStorage`. Após um reload, os campos de arquivo estarão vazios mesmo que o formulário reabra com os dados textuais. Isso é comportamento esperado e não tem solução sem upload incremental ou draft salvo no servidor. Registrar para avaliação futura de UX.

## Registro para o docs/MEMORY.md
Após a correção confirmada, adicione ao docs/MEMORY.md:

```
Bug corrigido: Filtro de cliente do Admin Master resetava para "Todos os Clientes" após reload de aba
Causa raiz: switchClient em AuthContext não persistia seleção no localStorage para Admin Master (padrão já existia para Workshop)
Correção aplicada: 4 mudanças cirúrgicas em AuthContext — save ao selecionar, remove ao desselecionar, remove no logout, restore no fetchProfile
Arquivos modificados: src/context/AuthContext.tsx
Testes adicionados: e2e/completed/admin-master-client-persistence.spec.ts (a criar)
```

## Sugestão de commit
Quando todos os critérios de conclusão estiverem atendidos:

```
git add src/context/AuthContext.tsx
git commit -m "fix: persistir cliente selecionado pelo Admin Master entre reloads de aba

Ao selecionar um cliente no filtro, Admin Master perdia a seleção
ao recarregar a página pois switchClient não persistia no localStorage.
Workshop já tinha esse mecanismo (workshop_active_client); aplicado o
mesmo padrão para Admin Master com chave adminMasterActiveClient."
```
