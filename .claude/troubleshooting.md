# Troubleshooting & Gotchas Comuns

## Autenticação & Multi-Tenancy

**Problema:** Admin Master vê apenas dados de um cliente mesmo após selecionar outro
**Causa:** Query sem filtro `client_id` ou RLS sem `OR role = 'Admin Master'`
**Solução:**
1. Adicione `.eq('client_id', currentClient.id)` na query quando `currentClient?.id` existe
2. Verifique RLS — Admin Master precisa de `OR role = 'Admin Master'` em WHEREs de `client_id`

**Problema:** "JWT expired" ao fazer edit/delete
**Causa:** Token de sessão expirou antes da operação crítica
**Solução:** Adicione `await supabase.auth.refreshSession()` antes de `.update()` ou `.delete()`

---

## TypeScript & Tipos

**Problema:** `Cannot find type Vehicle` em novo arquivo
**Causa:** `src/types.ts` não foi importado
**Solução:** `import { Vehicle } from '../types'` no topo do arquivo

**Problema:** Type error em mapeador: `Property 'initial_km' doesn't exist`
**Causa:** Campo novo no DB mas mapeador não foi atualizado
**Solução:**
1. Leia a migration que criou o campo
2. Atualize `src/lib/*Mappers.ts` com novo mapeamento camelCase ↔ snake_case
3. Atualize interface em `src/types.ts`

---

## Migrations & Schema

**Problema:** "ERROR: Current identity has insufficient privileges to..." ao executar migration
**Causa:** Role SQL não tem permissão ou RLS está bloqueando INSERT/UPDATE
**Solução:**
1. Verifique `check_auth_role()` em migration — user precisa ser `postgres` ou `authenticated` com role correto
2. Valide RLS policies — teste com role específica em Supabase SQL Editor

**Problema:** Migration executada mas coluna não aparece em SELECT
**Causa:** RLS policy está bloqueando visibilidade da coluna ou migração não foi sincronizada
**Solução:**
1. Execute `SELECT * FROM tabela LIMIT 1` no Supabase SQL Editor (bypass de RLS com role `postgres`)
2. Se coluna existe — RLS está filtrando; verifique SECURITY DEFINER em view/function
3. Se coluna não existe — migration falhou silenciosamente; verifique logs do Supabase Dashboard

---

## React-Query & Data Fetching

**Problema:** Query retorna `undefined` mesmo após sucesso
**Causa:** `select()` transformer está retornando `undefined` ou `queryFn` não está retornando nada
**Solução:**
1. Adicione `console.log(data)` antes do `select()`
2. Valide que `queryFn` retorna objeto ou array completo
3. Se usar `select()`, certifique-se de retornar valor válido (não undefined)

**Problema:** Dados não atualizam após mutation
**Causa:** Faltou `queryClient.invalidateQueries({ queryKey: ['...'] })`
**Solução:** Após mutation bem-sucedida, invalide query manualmente:
```typescript
await mutateAsync(...);
queryClient.invalidateQueries({ queryKey: ['vehicles', clientId] });
```

---

## Dashboard & Filtros

**Problema:** Valores de KPI não aparecem ou mostram 0
**Causa:** Filtro `vehicleType` ou `maintenanceType` está excluindo todos os dados
**Solução:**
1. Abra DevTools → Console, verifique `filteredVehicles.length` e `filteredMaintenance.length`
2. Se ambos são 0 — adicione dados de teste com tipo correspondente
3. Verifique lógica de filtro em `useMemo` — AND vs OR

---

## Supabase RLS & Policies

**Problema:** "You do not have access to this table"
**Causa:** RLS policy bloqueia SELECT/INSERT/UPDATE/DELETE
**Solução:**
1. Verifique `auth.uid()` matches `profiles(id)` do user logado
2. Verifique `auth.jwt()->>'client_id'` matches `profile.client_id`
3. Para Admin Master: certifique-se de `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin Master')`

**Problema:** Erro ao criar/editar com RLS bloqueando Action Plans
**Causa:** Admin Master tem `client_id = NULL` em perfil; queries usando `IN (SELECT client_id FROM ... WHERE role = 'Admin Master')` retornam NULL (nunca TRUE em SQL)
**Solução:** Use `EXISTS` com check direto `p.role = 'Admin Master'` em vez de depender de `client_id`:
```sql
CREATE POLICY access_action_plans ON action_plans
  USING (
    (client_id = auth.jwt()->>'client_id')
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin Master')
  );
```

---

## Veículos & Hodômetro

**Problema:** Checklist rejeita hodômetro válido com "Deve ser maior que..."
**Causa:** Campo `initial_km` do veículo não foi configurado ou é nulo
**Solução:**
1. Vá para o cadastro do veículo
2. Preenchae "Km Inicial" (seção "Propriedade & Rastreamento")
3. Salve e tente o checklist novamente

**Problema:** Posições de pneu não aparecem ou mostram erro
**Causa:** Veículo sem configuração de eixos ou `VehicleTireConfig` inválida
**Solução:**
1. Verifique se o veículo tem `axle_config` preenchida ou `VehicleTireConfig` seed válida
2. Se veículo novo, acesse `/cadastros/veiculos` e edite-o
3. Configure eixos corretamente (primeiro = Direcional, rodagem válida)
4. Salve e volte para `/pneus`

---

## Pneus & Configuração

**Problema:** "Total de Pneus" mostra `—` (indefinido)
**Causa:** Configuração de eixos está incompleta
**Solução:**
1. Volte ao cadastro de veículo
2. Edite "Configuração de Eixos"
3. Certifique-se de que **todos os eixos** têm Tipo e Rodagem selecionados
4. Badge de status deve estar esmeralda (completo)
5. Salve e retorne a pneus

**Problema:** Ao tentar cadastrar pneu por lote, dropdown de Modelos está vazio
**Causa:** Não há veículos com a combinação de Marca/Modelo selecionada
**Solução:**
1. Verifique se criou veículos com essa Marca/Modelo
2. Filtre no passo 1 do modal e veja quais combinações existem
3. Se precisar adicionar novos veículos, vá para `/cadastros/veiculos` primeiro

---

## Workshops & Acesso

**Problema:** Workshop não consegue fazer login ou vê erro "Acesso negado"
**Causa:** Oficina foi criada sem `loginEmail` + `loginPassword` configurados
**Solução:**
1. Acesse `/cadastros/oficinas`
2. Edite a oficina problemática
3. Verifique se tem badge "Com acesso ao sistema"
4. Se não tem, a oficina precisa ser recriada com credenciais

**Problema:** Workshop acessa mas vê página em branco ou "Não há dados"
**Causa:** Nenhuma manutenção foi atribuída a essa oficina
**Solução:**
1. Como Fleet Assistant, crie uma manutenção e selecione essa oficina
2. Workshop vai conseguir acessar a manutenção após alguns segundos (propagação RLS)

---

## Configurações & Settings

**Problema:** Abas de configuração não aparecem ou estão desabilitadas
**Causa:** Role do usuário não tem permissão ou página está carregando
**Solução:**
1. Verifique role no AuthContext (deve ser Manager+ ou Fleet Assistant+)
2. Aguarde carregamento completo da página
3. Se continuar, limpe cache do navegador e faça login novamente

**Problema:** Salvar configuração retorna erro "You do not have access to this table"
**Causa:** `client_id` em request não corresponde ao `client_id` do usuário
**Solução:**
1. Verifique que `clientId` passado ao componente é correto
2. Valide em DevTools → Network se POST enviando `client_id` correto
3. Se admin master, certifique-se que RLS permite `OR role = 'Admin Master'` na tabela
