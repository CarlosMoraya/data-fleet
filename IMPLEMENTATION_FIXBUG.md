# IMPLEMENTATION_FIXBUG.md
Gerado em: 2026-08-21 13:05 (America/Sao_Paulo)
Sessão: correção de bug — oficina consegue alterar orçamento já aprovado durante "Serviço em execução"
Tipo de bug: Tipo B — bug com dependências (com característica de segurança: integridade financeira)
Causa raiz confirmada: sim
Baseado em: docs/MEMORY.md (2026-08-21)

## GUARDRAIL — leia antes de qualquer ação

Este documento é a especificação completa e fechada desta correção. O agente de código que executar este plano:

- NÃO modifica arquivos além dos listados aqui
- NÃO refatora código não relacionado ao bug
- NÃO "melhora" código que não está causando o problema
- NÃO instala dependências não listadas aqui
- NÃO altera testes para fazê-los passar — corrige o código
- SE encontrar algo que parece errado mas não está neste documento: registra como observação no MEMORY.md e continua sem corrigir
- SE encontrar ambiguidade em qualquer passo: para, informa o usuário e aguarda instrução

## Contexto necessário
Antes de implementar, leia:
- `agent/AGENT.md` — regras universais do projeto
- `agent/AGENT-FRONTEND.md` — padrões de interface e consumo de serviços
- `agent/AGENT-BACKEND.md` — mappers, storage privado e hierarquia de papéis
- `agent/AGENT-DATABASE.md` — RLS, gatilhos e política de migrações manuais (SQL Editor, DEV antes de PROD)

## O bug

**Comportamento atual:**
Depois que o orçamento é aprovado e o cliente muda o status da OS para `Serviço em execução`, o botão "Preencher OS" é liberado para a oficina anexar as evidências (Fotos das Peças). Só que o mesmo formulário continua com **todo o orçamento editável**: nome do item, sistema, quantidade, valor, adicionar linha, remover linha e substituição do PDF do orçamento. Ao salvar, o sistema apaga todos os itens do orçamento no banco e grava de novo o que estiver na tela. Nada — nem na tela, nem no banco — verifica que aquele orçamento já foi aprovado.

Consequências concretas:
1. A oficina pode trocar um item de R$ 780 por R$ 1.780 num orçamento já aprovado. O valor aprovado (`approved_cost`) não muda, porque o gatilho `enforce_workshop_maintenance_columns` já protege essa coluna — o resultado é que a **lista de itens e o valor aprovado passam a divergir**. É essa lista de itens que o Financeiro vê no modal "Itens/PDF" e que o Histórico de Orçamentos exibe como comprovação da decisão. Ou seja: a evidência documental do que foi aprovado pode ser adulterada depois da aprovação, sem deixar rastro.
2. Se a oficina anexar um **PDF novo**, o código força `budget_status = 'pendente'` e `status = 'Aguardando aprovação'` — jogando de volta para a fila de aprovação uma OS que já estava aprovada e com serviço em andamento, e apagando a decisão anterior (não há trilha de rodadas de orçamento; isso já está registrado em `docs/SPEC.md`, seção "Histórico de orçamentos aprovados e reprovados").
3. Descontos já estão travados após a aprovação (`discountsLocked`), mas **apenas na tela** — o que confirma que a intenção original era congelar o orçamento aprovado e que a trava ficou incompleta.

O pagamento em si **não** pode ultrapassar o valor aprovado: o gatilho `fn_enforce_payment_installment_budget_cap` limita a soma das parcelas a `approved_cost`. O dano, portanto, não é saque direto acima do aprovado — é adulteração da evidência e reabertura indevida do fluxo de aprovação.

**Comportamento esperado:**
Com o orçamento aprovado (`budget_status = 'aprovado'`), a oficina só pode registrar a execução do serviço:
- **Pode editar:** Previsão de Saída, OS da Oficina, Mecânico Responsável, Km do Veículo e as Fotos das Peças (Peças Substituídas e Peças Novas).
- **Não pode editar:** itens do orçamento (nome, sistema, quantidade, valor), desconto por item, desconto geral e o PDF do orçamento. O PDF atual continua visível ("Ver PDF atual").
- A trava vale na tela **e** no banco — requisição forjada por fora da interface também é recusada.

**Escopo adicional autorizado pelo usuário nesta sessão** (não é parte do bug, é pedido explícito registrado na conversa de 2026-08-21): quando a OS estiver em `Orçamento aprovado`, a oficina deve enxergar isso e poder **iniciar o serviço por conta própria**, através de uma ação dedicada que muda o status para `Serviço em execução` — e a partir daí continuar podendo anexar as fotos das evidências. Hoje só o cliente (Fleet Assistant+) faz essa transição, pelo formulário completo.

**Condições de reprodução:**
1. Logar como `Workshop` com perfil completo (`canWorkshopActOnOrders` verdadeiro).
2. Abrir Manutenção e localizar uma OS com `budget_status = 'aprovado'` e `status = 'Serviço em execução'`.
3. Clicar em "Preencher OS" (ícone de lápis).
4. Alterar o valor de qualquer linha do orçamento (ex.: 780 → 1780) e clicar em "Enviar Orçamento".
5. Reabrir a OS: o item gravado é o novo. Conferir no Financeiro → "Itens/PDF": a soma dos itens não bate mais com o valor aprovado exibido.

**Impacto:**
Todas as oficinas parceiras, em todos os tenants. Severidade alta: é integridade de dado financeiro e de evidência de aprovação. Não é vazamento de dado nem acesso cross-tenant.

## Causa raiz identificada

São três pontos, na mesma cadeia:

1. **`src/components/MaintenanceForm.tsx:266`** — `const discountsLocked = order?.budgetStatus === 'aprovado' || order?.budgetStatus === 'reprovado';`
   Essa é a única trava pós-aprovação existente, e ela cobre **apenas as duas caixas de desconto** (`BudgetItemsTable`, linhas 239 e 280). Item, sistema, quantidade, valor, "Adicionar linha", "Remover linha" e o input de PDF permanecem habilitados no modo Workshop (`src/components/MaintenanceForm.tsx:420-470`).

2. **`src/services/maintenanceService.ts:112-137`** — `saveMaintenanceOrder` executa, em toda edição que tenha itens significativos ou arquivo novo:
   ```
   .from('maintenance_budget_items').delete().eq('maintenance_order_id', orderId)
   ```
   seguido de um `insert` com o conteúdo da tela. Não existe nenhuma verificação de `budget_status` antes desse `delete`/`insert`. A mesma função, nas linhas 100-110, força `budget_status: 'pendente'` e `status: 'Aguardando aprovação'` sempre que há `budgetFile`, sem olhar se a OS já estava aprovada.

3. **Banco sem trava correspondente** — as policies `budget_items_update`, `budget_items_delete` e `budget_items_insert` (`supabase/migrations/20260404000000_workshop_partnership.sql`, seção 13) liberam a oficina com base apenas no vínculo com a OS; nenhuma olha o `budget_status`. E o gatilho `enforce_workshop_maintenance_columns` (`supabase/migrations/20260625000200_...`) protege `approved_cost`, `budget_reviewed_by` e `budget_reviewed_at`, mas **não** protege `budget_pdf_url` nem `budget_discount`, e permite explicitamente que a oficina devolva `budget_status` para `'pendente'`.

Ou seja: a regra "orçamento aprovado é imutável" nunca foi escrita — nem na camada de tela (só o desconto foi coberto), nem na camada de serviço, nem na camada de banco.

## Estado dos testes antes da correção — baseline

Executado nesta sessão, em 2026-08-21:

- **Typecheck** (`npx tsc --noEmit`): **0 erros**.
- **Lint** (`npx eslint src/`): **0 erros, 258 avisos** (`warning`). Os avisos são pré-existentes e não são responsabilidade desta correção; não limpar avisos de código não relacionado.
- **Testes unitários** (`npm run test:unit`): **212 arquivos, 1.919 testes — todos passando, 0 falhando.**
- **Testes de fumaça** (`npm run test:smoke`): **NÃO EXECUTADOS.** O usuário optou por rodar depois. Ver a seção "O que não foi possível validar".
- Testes falhando relacionados ao bug: **nenhum** — o bug não é coberto por teste algum hoje.
- Testes falhando não relacionados ao bug: nenhum nas suítes executadas. Continuam registradas em `docs/MEMORY.md` as falhas pré-existentes de E2E (`checklist-offline-fill.spec.ts` teste B.1 e `checklist-offline-reload.spec.ts`, e 4 specs de Revisão de Garantia), que não são tocadas por esta correção.

### Mapa de cobertura do bug (Verificação 5)

- **Testes unitários que cobrem os arquivos defeituosos:**
  - `src/services/maintenanceService.test.ts` — 4 testes, **todos sobre `getMaintenanceBudgetApprovalDetails`**. `saveMaintenanceOrder` **não tem nenhum teste**.
  - `src/components/BudgetItemsTable.test.tsx` — cobre `discountsLocked` (desabilita as duas caixas de desconto), mas nada sobre travar item/quantidade/valor.
  - `src/lib/maintenanceWorkshop.test.ts` — cobre `canWorkshopFillOrder` por status e o limite de fotos.
- **Testes de integração do fluxo quebrado:** nenhum.
- **E2E:** `e2e/completed/role-workshop.spec.ts` verifica apenas que o botão "Preencher OS" aparece para o papel Workshop. Não abre o formulário nem valida o que é editável.
- **O que NÃO está coberto hoje:** a regra "orçamento aprovado é imutável para a oficina" em qualquer camada; o payload que `saveMaintenanceOrder` monta em modo Workshop; a transição de status feita pela oficina.

> Este bug não está protegido por cobertura automatizada suficiente em nenhuma camada. Os testes novos estão especificados na seção "Testes novos a escrever" e são obrigatórios.

## Dependências mapeadas

| Arquivo a modificar | Quem depende dele | Por que a correção não afeta os demais usos |
|---|---|---|
| `src/lib/maintenanceWorkshop.ts` | `src/pages/Maintenance.tsx` (`canWorkshopFillOrder`), `src/components/PartPhotosSection.tsx` (limites de foto) | A correção **acrescenta** funções puras novas. `WORKSHOP_FILLABLE_STATUSES`, `canWorkshopFillOrder`, `PART_PHOTO_LIMIT`, `canAddMorePartPhotos` e `remainingPartPhotoSlots` ficam **intactos** — inclusive `canWorkshopFillOrder('Orçamento aprovado') === false`, que continua correto porque a nova ação da oficina é um botão separado, não o formulário de preenchimento. |
| `src/components/BudgetItemsTable.tsx` | `MaintenanceForm.tsx` (2 chamadas: modo Workshop e modo padrão), `MaintenanceDetailModal.tsx` e telas de Financeiro que já usam `readOnly` | A correção **não altera nenhuma prop existente nem o comportamento default**. Apenas passa `readOnly` (prop que já existe e já é usada) a partir do `MaintenanceForm` quando o orçamento estiver travado. Nenhum consumidor atual muda de comportamento. |
| `src/components/MaintenanceForm.tsx` | `src/pages/Maintenance.tsx` (único consumidor) | A mudança fica dentro do ramo `isWorkshopMode`. O **modo padrão (`mode='default'`) não é tocado** — Fleet Assistant+ continua editando exatamente como hoje. |
| `src/services/maintenanceService.ts` | `src/pages/Maintenance.tsx` (único chamador de `saveMaintenanceOrder`, linha 290). Mockado em `Maintenance.exportButton.test.tsx` e `Maintenance.lastRoute.test.tsx` | O parâmetro novo é **opcional** (`budgetLocked?: boolean`), com default `false`. Quem não passa o parâmetro tem o comportamento de hoje, byte a byte. Os dois testes que mockam a função não se importam com a assinatura. |
| `src/pages/Maintenance.tsx` | Rota `/manutencao` | A correção acrescenta um botão condicionado a `canFillWorkshop` e adiciona um argumento na chamada de `saveMaintenanceOrder`. Os ramos `canWriteMaintenance` (cliente) e o dropdown "Ações" **não são tocados**. |
| Migration nova (banco) | Todas as escritas em `maintenance_orders` e `maintenance_budget_items` | O gatilho só age quando o papel do autor é `Workshop` (mesmo padrão do gatilho existente). Para qualquer outro papel, retorna `NEW` imediatamente — Fleet Assistant+, Financeiro, Admin Master e os jobs de aprovação seguem inalterados. |

**Comportamentos adjacentes que precisam continuar funcionando (verificar após a correção):**
- Oficina enviando o **primeiro** orçamento (`budget_status = 'sem_orcamento'` / `'pendente'`): fluxo inalterado, com itens, desconto e PDF editáveis.
- Oficina **reenviando** orçamento **reprovado** (`budget_status = 'reprovado'`): fluxo inalterado — continua podendo alterar itens e subir PDF novo, o que devolve a OS para `Aguardando aprovação`. A trava só existe para `'aprovado'`.
- Cliente (Fleet Assistant+) editando a OS pelo formulário completo: inalterado.
- Aprovação/reprovação em `src/pages/BudgetApprovals.tsx`: inalterada.
- Cadastro de parcelas no Financeiro, limitado por `approved_cost`: inalterado.

## O que NÃO fazer — restrições absolutas

- **Não** alterar o comportamento do modo `default` do `MaintenanceForm` (edição pelo cliente). O fato de o cliente também conseguir editar itens de um orçamento aprovado está registrado como observação para sessão futura — **não corrigir agora**.
- **Não** remover nem afrouxar o gatilho `enforce_workshop_maintenance_columns` existente. A migration nova o **substitui preservando integralmente todas as proteções atuais** e apenas acrescenta regras.
- **Não** alterar as policies RLS de `maintenance_budget_items`. A trava vai por gatilho, para não mexer numa policy compartilhada por 4 papéis e já reescrita por 3 migrations diferentes.
- **Não** alterar `approved_cost` em lugar nenhum, nem recalcular custo a partir dos itens.
- **Não** mexer no gatilho `fn_enforce_payment_installment_budget_cap` nem nos gatilhos de exclusividade de desconto.
- **Não** alterar `canWorkshopFillOrder` nem `WORKSHOP_FILLABLE_STATUSES`, e **não** alterar `src/lib/maintenanceWorkshop.test.ts` — as asserções atuais continuam válidas.
- **Não** aplicar migration em PROD. O agente entrega o arquivo `.sql`; a aplicação é manual pelo usuário, em DEV primeiro, conforme `agent/AGENT-DATABASE.md`.
- **Não** instalar dependências novas.

## Correção

Ordem obrigatória: Passo 1 → verificar → Passo 2 → verificar → ... Uma mudança por vez.

---

### Passo 1 — Criar as regras puras da trava

**Arquivo:** `src/lib/maintenanceWorkshop.ts`

**Causa que justifica tocar neste arquivo:** é o módulo onde já vivem as regras puras de permissão da oficina sobre a OS (`canWorkshopFillOrder`, limites de foto). A regra nova pertence ao mesmo lugar e precisa ser testável sem renderizar componente (o projeto não tem Testing Library — ver `docs/MEMORY.md`, seção Observações).

**O que mudar:** acrescentar duas funções exportadas, sem tocar em nada do que já existe:

```ts
/**
 * Orçamento aprovado é imutável para a oficina: itens, descontos e PDF do
 * orçamento ficam congelados. A oficina segue registrando a execução
 * (previsão de saída, OS da oficina, mecânico, km) e as fotos das peças.
 */
export function isWorkshopBudgetLocked(budgetStatus: BudgetStatus | undefined | null): boolean {
  return budgetStatus === 'aprovado';
}

/**
 * A oficina pode iniciar o serviço por conta própria quando o orçamento já
 * foi aprovado e a OS ainda não saiu de 'Orçamento aprovado'.
 */
export function canWorkshopStartService(
  status: MaintenanceStatus,
  budgetStatus: BudgetStatus | undefined | null,
): boolean {
  return status === 'Orçamento aprovado' && budgetStatus === 'aprovado';
}
```

Importar `BudgetStatus` de `../types/maintenance` junto do `MaintenanceStatus` já importado (usar `import type`).

**O que NÃO mudar neste arquivo:** `PART_PHOTO_LIMIT`, `WORKSHOP_FILLABLE_STATUSES`, `canWorkshopFillOrder`, `canAddMorePartPhotos`, `remainingPartPhotoSlots`.

**Impacto em dependências:** nenhum — são funções novas, ainda não consumidas por ninguém ao fim deste passo.

**Como verificar este passo:**
```bash
npx tsc --noEmit
```
Resultado esperado: 0 erros.

---

### Passo 2 — Testes unitários das regras puras

**Arquivo:** `src/lib/maintenanceWorkshop.test.ts`

**Causa que justifica tocar neste arquivo:** é o arquivo de teste do módulo do Passo 1.

**O que mudar:** **acrescentar** dois blocos `it(...)` novos dentro do `describe` existente:

1. `'trava o orçamento da oficina somente quando aprovado'`
   - `isWorkshopBudgetLocked('aprovado')` → `true`
   - `isWorkshopBudgetLocked('pendente')` → `false`
   - `isWorkshopBudgetLocked('reprovado')` → `false`
   - `isWorkshopBudgetLocked('sem_orcamento')` → `false`
   - `isWorkshopBudgetLocked(undefined)` → `false`
2. `'permite a oficina iniciar o serviço só a partir de Orçamento aprovado'`
   - `canWorkshopStartService('Orçamento aprovado', 'aprovado')` → `true`
   - `canWorkshopStartService('Serviço em execução', 'aprovado')` → `false`
   - `canWorkshopStartService('Aguardando aprovação', 'aprovado')` → `false`
   - `canWorkshopStartService('Orçamento aprovado', 'pendente')` → `false`
   - `canWorkshopStartService('Concluído', 'aprovado')` → `false`

**O que NÃO mudar neste arquivo:** os 3 testes existentes, incluindo `expect(canWorkshopFillOrder('Orçamento aprovado')).toBe(false)` — continua correto e deve permanecer.

**Impacto em dependências:** nenhum.

**Como verificar este passo:**
```bash
npx vitest run src/lib/maintenanceWorkshop.test.ts
```
Resultado esperado: todos os testes do arquivo passando (3 antigos + 2 novos).

---

### Passo 3 — Congelar o orçamento na tela da oficina

**Arquivo:** `src/components/MaintenanceForm.tsx`

**Causa que justifica tocar neste arquivo:** é onde a trava pós-aprovação já existe pela metade (linha 266, só descontos) e onde estão os campos que hoje permanecem editáveis.

**O que mudar:**

1. Importar `isWorkshopBudgetLocked` de `../lib/maintenanceWorkshop`.
2. Logo abaixo da linha 266, derivar:
   ```ts
   const workshopBudgetLocked = isWorkshopMode && isWorkshopBudgetLocked(order?.budgetStatus);
   ```
3. No ramo `isWorkshopMode`, quando `workshopBudgetLocked` for verdadeiro:
   - **Bloco do PDF** (linhas ~421-447): não renderizar o `<input type="file" id="budgetPdf">` nem o `Label` "PDF do Orçamento" como campo obrigatório. Manter visível o botão "Ver PDF atual" (`openPrivateDocument`) quando `existingBudgetPdfUrl` existir, sob um rótulo estático "PDF do Orçamento aprovado".
   - **`BudgetItemsTable`** (linha ~455): passar `readOnly` (a prop já existe e já renderiza a tabela como leitura, sem inputs, sem "Adicionar linha" e sem lixeira). Continuar passando `items` e `orderDiscount`; **não** passar `onChange` nem `onOrderDiscountChange` neste caso.
   - **Aviso ao usuário**, imediatamente acima da tabela, no padrão visual já usado no arquivo para avisos (`rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800`), com o texto exato:
     `Orçamento aprovado — os itens, os descontos e o PDF não podem mais ser alterados. Registre a execução do serviço e anexe as fotos das peças.`
   - **Rótulo do botão de envio** (linha ~762): quando `workshopBudgetLocked`, exibir `Salvar Evidências` em vez de `Enviar Orçamento`.
4. Em `handleSubmit`, quando `workshopBudgetLocked` for verdadeiro:
   - Pular as validações de orçamento: `hasBudgetItemWithoutSystem` e `validateBudgetDiscounts` (nada de orçamento está sendo enviado).
   - Pular a exigência `if (!budgetFile && !existingBudgetPdfUrl)` — o PDF já existe e não é reenviado.
   - **Manter** a exigência dos 4 campos operacionais (Previsão de Saída, OS da Oficina, Mecânico, Km), que continuam editáveis por decisão do usuário.
5. Repassar o estado da trava para a página, para que ela informe o serviço: alterar a assinatura da prop `onSave` para
   `onSave: (order, budgetItems, budgetFile, pendingPartPhotos, budgetLocked: boolean) => Promise<void>` e chamar `await onSave(formData, budgetItems, budgetFile, partPhotoDrafts, workshopBudgetLocked)`.

**O que NÃO mudar neste arquivo:** todo o ramo `mode === 'default'` (linhas ~477 em diante), incluindo a segunda chamada de `BudgetItemsTable` (linha ~689) e o `discountsLocked` que ela recebe. `validateBudgetDiscounts` continua exportada e com o mesmo comportamento. A seção `PartPhotosSection` permanece exatamente como está — é justamente o que a oficina precisa continuar fazendo.

**Impacto em dependências:** o único consumidor é `src/pages/Maintenance.tsx`, ajustado no Passo 5. A mudança em `BudgetItemsTable` é só de props passadas — o componente não é alterado.

**Como verificar este passo:**
```bash
npx tsc --noEmit
```
Resultado esperado: apenas o erro de assinatura de `onSave` em `src/pages/Maintenance.tsx`, que o Passo 5 resolve. Nenhum outro erro. (Se preferir, faça os Passos 3 e 5 e só então rode o typecheck.)

---

### Passo 4 — Impedir que o serviço reescreva o orçamento aprovado

**Arquivo:** `src/services/maintenanceService.ts`

**Causa que justifica tocar neste arquivo:** é aqui que o `delete` + `insert` dos itens acontece sem verificar `budget_status`, e é aqui que o upload de PDF devolve a OS para a fila de aprovação. Bloquear só na tela repetiria o risco já registrado em `docs/MEMORY.md` ("trava pós-aprovação do desconto só na UI").

**O que mudar:**

1. Acrescentar o campo opcional à interface:
   ```ts
   export interface SaveMaintenancePayload {
     // ...campos existentes...
     /** true quando a oficina edita uma OS com orçamento já aprovado: só evidências e campos operacionais são gravados. */
     budgetLocked?: boolean;
   }
   ```
2. No início de `saveMaintenanceOrder`, desestruturar `budgetLocked = false`.
3. Quando `budgetLocked` for verdadeiro, o caminho é **exclusivo e curto** — e obrigatoriamente exige `data.id` (é sempre edição):
   ```ts
   if (budgetLocked) {
     if (!data.id) throw new Error('Orçamento aprovado só pode ser atualizado em edição.');
     const { error } = await supabase
       .from('maintenance_orders')
       .update({
         expected_exit_date: data.expectedExitDate ?? null,
         workshop_os_number: data.workshopOs ?? null,
         mechanic_name: data.mechanicName ?? null,
         current_km: data.currentKm ?? null,
       })
       .eq('id', data.id);
     if (error) throw error;
     return data.id;
   }
   ```
   Este bloco vem **antes** da montagem de `commonFields` e retorna cedo, de modo que nada do fluxo atual (upload de PDF, `delete`/`insert` de itens, `budget_discount`) é executado.

> **Por que payload restrito e não apenas "não mandar os itens":** hoje `commonFields` envia `budget_discount: 0` em toda edição. Numa OS aprovada com desconto geral, isso seria uma alteração real de valor — e o gatilho do Passo 6 recusaria a gravação inteira, quebrando o salvamento das fotos. O payload restrito evita esse choque e é a forma mais cirúrgica de expressar "só isto pode mudar".

**O que NÃO mudar neste arquivo:** todo o fluxo atual quando `budgetLocked` é falso — inserção de OS nova, upload de PDF com `budget_status: 'pendente'`, substituição de itens e `budget_discount`. `getMaintenanceBudgetApprovalDetails`, `updateMaintenanceStatus`, `cancelMaintenanceOrder` e `generateOSNumber` permanecem intactos.

4. **Acrescentar** no mesmo arquivo o serviço da ação nova da oficina (escopo adicional autorizado):
   ```ts
   /**
    * Oficina inicia o serviço de uma OS com orçamento aprovado.
    * Só muda o status — nenhuma outra coluna é tocada.
    */
   export async function startWorkshopService(id: string): Promise<void> {
     const { error } = await supabase
       .from('maintenance_orders')
       .update({ status: 'Serviço em execução' })
       .eq('id', id);
     if (error) throw error;
   }
   ```
   Não reutilizar `updateMaintenanceStatus`: ela também grava `actual_exit_date: null`, coluna que não tem por que ser tocada aqui.

**Impacto em dependências:** o parâmetro é opcional com default `false`; o único chamador é `src/pages/Maintenance.tsx`. `Maintenance.exportButton.test.tsx` e `Maintenance.lastRoute.test.tsx` mockam o módulo inteiro e não dependem da assinatura.

**Como verificar este passo:**
```bash
npx tsc --noEmit && npx vitest run src/services/maintenanceService.test.ts
```
Resultado esperado: 0 erros de tipo (exceto o de `onSave` pendente do Passo 5) e os 4 testes existentes continuam passando.

---

### Passo 5 — Ligar a tela ao serviço e criar a ação "Iniciar serviço"

**Arquivo:** `src/pages/Maintenance.tsx`

**Causa que justifica tocar neste arquivo:** é o único consumidor de `MaintenanceForm` e de `saveMaintenanceOrder`, e é onde ficam os botões de ação da linha da OS.

**O que mudar:**

1. Importar `canWorkshopStartService` de `../lib/maintenanceWorkshop` e `startWorkshopService` de `../services/maintenanceService`.
2. Em `saveMutation`, aceitar `budgetLocked: boolean` no objeto de variáveis e repassá-lo para `saveMaintenanceOrder({ ..., budgetLocked })`. No `onSave` do `MaintenanceForm` (linha ~805), repassar o quinto argumento recebido.
3. Criar uma mutation dedicada, ao lado de `updateStatusMutation`:
   ```ts
   const startServiceMutation = useMutation({
     mutationFn: async (id: string) => { await startWorkshopService(id); },
     onSuccess: () => {
       void queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
     },
   });
   ```
4. Na coluna de ações da linha (junto ao bloco `canFillWorkshop && canWorkshopFillOrder(o.status)`, linha ~704), acrescentar um botão **novo e separado**:
   ```tsx
   {canFillWorkshop && canWorkshopStartService(o.status, o.budgetStatus) && (
     <button
       onClick={(e) => { e.stopPropagation(); startServiceMutation.mutate(o.id); }}
       disabled={startServiceMutation.isPending}
       title="Iniciar serviço"
       className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-purple-50 hover:text-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
     >
       <PlayCircle className="h-4 w-4" />
     </button>
   )}
   ```
   Importar `PlayCircle` de `lucide-react` (o arquivo já importa vários ícones dessa biblioteca).

**O que NÃO mudar neste arquivo:** o botão "Editar" do cliente (`canWriteMaintenance`), o dropdown "Ações", o botão "Cancelar OS", o botão "Reabrir", a query de listagem, os filtros e os cards. O botão "Preencher OS" permanece com a condição atual (`canWorkshopFillOrder`), que segue não incluindo `Orçamento aprovado` — a oficina primeiro inicia o serviço, e só então preenche as evidências.

**Impacto em dependências:** nenhum outro módulo consome estes trechos.

**Como verificar este passo:**
```bash
npx tsc --noEmit && npm run lint
```
Resultado esperado: 0 erros de tipo e 0 erros de lint (avisos pré-existentes podem permanecer; não devem aumentar de forma relacionada aos arquivos tocados).

---

### Passo 6 — Trava no banco (migration)

**Arquivo:** `supabase/migrations/20260821000000_lock_approved_budget_for_workshop.sql` (arquivo novo)

**Causa que justifica criar este arquivo:** a trava de tela não impede requisição forjada. Sem regra no banco, o bug continua explorável por fora da interface — exatamente o risco já registrado em `docs/MEMORY.md` para o desconto.

**O que a migration deve conter, nesta ordem:**

**(A) Substituir `public.enforce_workshop_maintenance_columns`** — `CREATE OR REPLACE`, mantendo `SECURITY DEFINER` e `SET search_path = public`, preservando **todas** as verificações atuais (`client_id`, `vehicle_id`, `workshop_id`, `os_number`, `created_by_id`, `approved_cost`, `budget_reviewed_by`, `budget_reviewed_at`, `cancelled_at`, `cancelled_by_id`) e **acrescentando**:

1. Se `OLD.budget_status = 'aprovado'` e o papel for `Workshop`, recusar alteração de `budget_pdf_url`, `budget_discount`, `estimated_cost` e `budget_status`:
   ```sql
   IF OLD.budget_status = 'aprovado' AND (
        NEW.budget_pdf_url  IS DISTINCT FROM OLD.budget_pdf_url
     OR NEW.budget_discount IS DISTINCT FROM OLD.budget_discount
     OR NEW.estimated_cost  IS DISTINCT FROM OLD.estimated_cost
     OR NEW.budget_status   IS DISTINCT FROM OLD.budget_status
   ) THEN
     RAISE EXCEPTION 'Orcamento aprovado: a oficina nao pode alterar orcamento, desconto ou PDF';
   END IF;
   ```
2. Substituir a regra de status atual por uma que também permita iniciar o serviço:
   ```sql
   IF NEW.status IS DISTINCT FROM OLD.status
      AND NOT (
        NEW.status = 'Aguardando aprovação'
        OR (NEW.status = 'Serviço em execução'
            AND OLD.status = 'Orçamento aprovado'
            AND OLD.budget_status = 'aprovado')
      )
   THEN
     RAISE EXCEPTION 'Workshop so pode enviar para aprovacao ou iniciar servico de orcamento aprovado';
   END IF;
   ```
   Atenção: a regra de `budget_status` existente (`só pode ir para 'pendente'`) **permanece**, e agora convive com a regra (1), que a bloqueia por completo quando o orçamento está aprovado. A ordem importa: a verificação (1) vem antes.
3. Recriar o trigger `trg_enforce_workshop_maintenance_columns` com `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER BEFORE UPDATE`, idêntico ao atual.

**(B) Criar `public.fn_lock_approved_budget_items()`** — `SECURITY DEFINER`, `SET search_path = public`, para `maintenance_budget_items`:

```sql
CREATE OR REPLACE FUNCTION public.fn_lock_approved_budget_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  editor_role TEXT;
  target_order UUID;
  order_budget_status TEXT;
BEGIN
  SELECT role INTO editor_role FROM public.profiles WHERE id = auth.uid();
  IF editor_role IS DISTINCT FROM 'Workshop' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_order := COALESCE(NEW.maintenance_order_id, OLD.maintenance_order_id);

  SELECT budget_status INTO order_budget_status
    FROM public.maintenance_orders WHERE id = target_order;

  IF order_budget_status = 'aprovado' THEN
    RAISE EXCEPTION 'Orcamento aprovado: os itens nao podem mais ser alterados pela oficina';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_approved_budget_items ON public.maintenance_budget_items;
CREATE TRIGGER trg_lock_approved_budget_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.maintenance_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_approved_budget_items();
```

**(C)** Encerrar com `NOTIFY pgrst, 'reload schema';` e, em comentário, o **rollback exato** (restaurar a versão anterior de `enforce_workshop_maintenance_columns` conforme `20260625000200_...` e dropar `trg_lock_approved_budget_items` + `fn_lock_approved_budget_items`), seguindo o padrão de `20260803000000_add_budget_discounts.sql`.

**O que NÃO mudar:** nenhuma policy RLS; nenhum outro gatilho; nenhuma coluna; nenhum dado existente. A migration é só de funções e gatilhos.

**Impacto em dependências:** o gatilho (B) roda em toda escrita em `maintenance_budget_items`, mas sai imediatamente para qualquer papel diferente de `Workshop` — o custo é uma leitura em `profiles` por linha, mesmo padrão do gatilho já em produção desde 2026-06-25. Aprovação, reprovação, edição pelo cliente e Admin Master não são afetados.

**Como verificar este passo:**
1. O agente **não aplica** a migration. Entrega o arquivo e informa o usuário.
2. O usuário aplica em **DEV** (Supabase SQL Editor) e roda a consulta de conferência:
   ```sql
   SELECT tgname, tgrelid::regclass AS tabela, tgenabled
     FROM pg_trigger
    WHERE tgname IN ('trg_enforce_workshop_maintenance_columns', 'trg_lock_approved_budget_items');
   ```
   Resultado esperado: 2 linhas, `tgenabled = 'O'`, nas tabelas `maintenance_orders` e `maintenance_budget_items`.
3. Só depois de validado em DEV e com autorização expressa do usuário, aplicar em PROD.

---

### Passo 7 — Teste do payload restrito no serviço

**Arquivo:** `src/services/maintenanceService.test.ts`

**Causa que justifica tocar neste arquivo:** `saveMaintenanceOrder` é o ponto exato da causa raiz e hoje não tem teste nenhum. Sem esse teste, a correção regride em silêncio.

**O que mudar:** acrescentar um `describe('saveMaintenanceOrder — orçamento aprovado')` novo, reaproveitando o padrão de mock (`fromMock` via `vi.hoisted`) já usado no arquivo, com dois testes:

1. `'com budgetLocked grava só os campos operacionais e não toca nos itens'`
   - Chamar `saveMaintenanceOrder({ data: { id: 'os-1', clientId: 'c1', expectedExitDate: '2026-08-30', workshopOs: 'OS-9', mechanicName: 'Paulo', currentKm: 92000, budgetDiscount: 50 }, budgetItems: [ /* um item qualquer */ ], budgetFile: null, profileId: 'p1', budgetLocked: true })`.
   - Asserções: `fromMock` foi chamado **apenas** com `'maintenance_orders'`; **nunca** com `'maintenance_budget_items'`; o objeto passado ao `update` contém exatamente as 4 chaves `expected_exit_date`, `workshop_os_number`, `mechanic_name`, `current_km` — e **não** contém `budget_discount`, `status`, `approved_cost` nem `budget_status`.
2. `'sem budgetLocked mantém a substituição de itens'`
   - Mesma chamada sem `budgetLocked`, com um item significativo.
   - Asserções: `fromMock` foi chamado com `'maintenance_budget_items'` e o `delete` seguido de `insert` ocorreu — garantindo que o fluxo legítimo de primeiro orçamento e de reorçamento após reprovação não foi quebrado.

**O que NÃO mudar neste arquivo:** os 4 testes existentes de `getMaintenanceBudgetApprovalDetails`.

**Como verificar este passo:**
```bash
npx vitest run src/services/maintenanceService.test.ts
```
Resultado esperado: 6 testes passando (4 antigos + 2 novos).

---

## Testes novos a escrever

Resumo consolidado do que os Passos 2 e 7 exigem, mais a validação manual obrigatória:

| Camada | Arquivo | O que valida |
|---|---|---|
| Unitário (regra) | `src/lib/maintenanceWorkshop.test.ts` | `isWorkshopBudgetLocked` trava só em `'aprovado'`; `canWorkshopStartService` só libera de `Orçamento aprovado` + `aprovado`. |
| Unitário (serviço) | `src/services/maintenanceService.test.ts` | Com `budgetLocked`, `saveMaintenanceOrder` não toca em `maintenance_budget_items` e grava só os 4 campos operacionais. Sem `budgetLocked`, o comportamento atual é preservado. |
| Banco | validação manual em DEV (roteiro abaixo) | Os dois gatilhos recusam a alteração forjada e permitem o caminho legítimo. |

**Por que não há teste automatizado de componente:** o projeto não tem Testing Library instalada (registrado em `docs/MEMORY.md`, seção Observações). A trava visual do `MaintenanceForm` é coberta pela validação manual guiada abaixo. **Não** instalar Testing Library nesta sessão.

### Validação manual guiada (obrigatória, em DEV, após aplicar a migration)

Com um usuário `Workshop` de perfil completo:

1. OS com `budget_status = 'aprovado'` e `status = 'Serviço em execução'` → clicar em "Preencher OS". **Esperado:** tabela de itens em modo leitura (sem inputs, sem "Adicionar linha", sem lixeira), sem seletor de arquivo de PDF, com "Ver PDF atual" presente, aviso azul de orçamento aprovado visível e botão "Salvar Evidências".
2. Alterar Km e Mecânico, anexar uma foto em "Peças Substituídas" e salvar. **Esperado:** salva sem erro; ao reabrir, Km/Mecânico atualizados, foto presente e itens idênticos aos de antes.
3. OS com `budget_status = 'aprovado'` e `status = 'Orçamento aprovado'` → **esperado:** botão "Iniciar serviço" visível; ao clicar, o status vira `Serviço em execução` na lista e o botão "Preencher OS" aparece.
4. OS com `budget_status = 'pendente'` (primeiro orçamento) → **esperado:** tudo editável como hoje, botão "Enviar Orçamento", upload de PDF disponível.
5. OS com `budget_status = 'reprovado'` → **esperado:** tudo editável, oficina consegue subir PDF novo e a OS volta para `Aguardando aprovação`.
6. Com usuário Fleet Assistant+ (cliente): abrir "Editar OS / Orçamento" de uma OS aprovada → **esperado:** comportamento idêntico ao de antes desta correção (o modo padrão não foi tocado).
7. Teste da trava de banco (SQL Editor em DEV, autenticado como o usuário Workshop de teste — via `set local role`/JWT de teste, ou pela aba Network reemitindo a requisição): `UPDATE public.maintenance_budget_items SET value = value + 1000 WHERE maintenance_order_id = '<OS aprovada>';` **Esperado:** erro `Orcamento aprovado: os itens nao podem mais ser alterados pela oficina`.

## Verificação final

Após todos os passos:

1. Testes específicos do bug:
   ```bash
   npx vitest run src/lib/maintenanceWorkshop.test.ts src/services/maintenanceService.test.ts src/components/BudgetItemsTable.test.tsx
   ```
   Resultado esperado: todos passando, incluindo os 4 testes novos. `BudgetItemsTable.test.tsx` deve continuar passando **sem nenhuma alteração** — é a prova de que o componente não foi tocado.

2. Suíte completa:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run test:unit
   ```
   Resultado esperado: 0 erros de tipo; 0 erros de lint (avisos pré-existentes permanecem, sem aumento nos arquivos tocados); **pelo menos 1.923 testes unitários passando** (1.919 do baseline + 4 novos) e **nenhum teste que passava antes falhando**.

3. Protocolo oficial de fumaça:
   ```bash
   npm run test:smoke
   ```
   Resultado esperado: 7/7 passando (referência do baseline registrado em `docs/MEMORY.md` em 2026-08-21).

4. E2E de navegação Motoristas/Veículos: **não se aplica.** Nenhum dos gatilhos do roteamento por impacto foi atingido — a correção não toca `Drivers.tsx`, `Vehicles.tsx`, os modais de detalhe, `LinkedRecordLink`, `linkedRecordNavigation.ts`, o parâmetro `open`, deep links, nem permissões de Fleet Analyst/Fleet Assistant. Confirmar com `git diff --name-only` antes de decidir.

5. E2E do papel Workshop (recomendado, por tocar o papel diretamente):
   ```bash
   npx playwright test e2e/completed/role-workshop.spec.ts --project=chromium
   ```
   Resultado esperado: passando sem alteração no spec.

Se qualquer verificação falhar: pare, informe o usuário com o resultado exato e aguarde instrução. Não tente corrigir por conta própria sem comunicar.

## O que não foi possível validar nesta sessão (Verificação 7)

| O que não foi validado | Por quê | Risco de seguir sem isso | Como validar depois |
|---|---|---|---|
| `npm run test:smoke` | O usuário optou por rodar depois; as 4 pré-condições operacionais (app em `http://localhost:3000`, variáveis do smoke, execução agora, ambiente de pé) não foram confirmadas nesta sessão. | Médio-baixo: não há baseline de fumaça desta sessão. O último registro conhecido é 7/7 em 2026-08-21 (`docs/MEMORY.md`), e typecheck/lint/1.919 unitários passaram agora. Se o smoke já estiver quebrado por outra causa, isso só será descoberto depois da correção e pode ser atribuído a ela por engano. | Rodar `npm run test:smoke` **antes** de começar a implementar, para fixar o baseline, e de novo ao final. |
| Comportamento real dos gatilhos no banco | Migrations neste projeto são aplicadas manualmente no SQL Editor; o agente não aplica DDL. | Alto se pulado: a trava de banco é metade da correção. Sem aplicá-la, o bug continua explorável por fora da interface. | Aplicar em DEV, rodar a consulta de conferência do Passo 6 e o teste 7 da validação manual; só então aplicar em PROD com autorização expressa. |
| Existência de OS de teste em DEV nos 4 estados de orçamento | Não foi consultado banco nesta sessão (diagnóstico feito por leitura de código e migrations). | Baixo: apenas pode atrasar a validação manual. | Antes da validação manual, conferir em DEV se há OS em `sem_orcamento`/`pendente`, `aprovado` + `Orçamento aprovado`, `aprovado` + `Serviço em execução` e `reprovado`; criar as que faltarem. |

## Observações para sessões futuras

1. **O cliente (Fleet Assistant+) também consegue editar itens de um orçamento já aprovado**, pelo modo `default` do `MaintenanceForm` — com o mesmo efeito de divergência em relação a `approved_cost`. Não é o bug relatado (que é sobre a oficina) e está **fora do escopo desta correção**. Merece uma sessão com `evolucao.md` para decidir a regra: bloquear, exigir reaprovação, ou recalcular `approved_cost`.
2. **Não existe trilha de rodadas de orçamento.** Quando uma OS é reorçada, a decisão anterior é sobrescrita e some do Histórico (já documentado em `docs/SPEC.md`). Uma tabela de histórico de rodadas resolveria de vez a rastreabilidade — é evolução, não correção.
3. **Não há auditoria de quem alterou itens de orçamento.** Já consta em `docs/MEMORY.md` como risco aceito ("sem auditoria de desconto"). Com a trava desta sessão o risco diminui, mas segue sem registro de autoria nas alterações pré-aprovação.
4. **`saveMaintenanceOrder` faz `delete` + `insert` de todos os itens a cada salvamento**, mesmo quando nada mudou. Funciona, mas apaga e recria linhas desnecessariamente (e invalidaria qualquer FK futura para itens). Refatoração para `upsert` por `sort_order` fica para uma sessão de evolução — **não fazer agora** (Regra 2: nunca refatorar durante correção de bug).
5. **Sem testes de renderização de componente React** no projeto (Testing Library ausente). A trava visual do `MaintenanceForm` depende de validação manual. Avaliar `@testing-library/react` numa sessão dedicada — já registrado em `docs/MEMORY.md`.

## Registro para o docs/MEMORY.md

Após a correção confirmada, adicionar ao `docs/MEMORY.md`:

```
Bug corrigido: oficina conseguia alterar itens, descontos e PDF de um orçamento já aprovado ao anexar as evidências do serviço em execução, fazendo a lista de itens divergir do valor aprovado (approved_cost).
Causa raiz: a regra "orçamento aprovado é imutável" só existia para os campos de desconto e só na UI (MaintenanceForm discountsLocked). saveMaintenanceOrder apagava e reinseria todos os itens sem consultar budget_status, e nem as policies de maintenance_budget_items nem o gatilho enforce_workshop_maintenance_columns olhavam budget_status.
Correção aplicada: trava em três camadas — regras puras (isWorkshopBudgetLocked / canWorkshopStartService), formulário da oficina em modo leitura para o orçamento (tabela readOnly, sem upload de PDF, botão "Salvar Evidências"), payload restrito no serviço (só expected_exit_date, workshop_os_number, mechanic_name, current_km) e migration com gatilhos recusando alteração de itens/PDF/desconto/budget_status de OS aprovada pelo papel Workshop. Escopo adicional autorizado: ação "Iniciar serviço" permite a oficina levar a OS de "Orçamento aprovado" para "Serviço em execução" (liberada também no gatilho).
Arquivos modificados: src/lib/maintenanceWorkshop.ts, src/lib/maintenanceWorkshop.test.ts, src/components/MaintenanceForm.tsx, src/services/maintenanceService.ts, src/services/maintenanceService.test.ts, src/pages/Maintenance.tsx, supabase/migrations/20260821000000_lock_approved_budget_for_workshop.sql
Testes adicionados: 2 em maintenanceWorkshop.test.ts (trava por budget_status e transição de status da oficina) e 2 em maintenanceService.test.ts (payload restrito com budgetLocked e preservação do fluxo normal sem budgetLocked).
Decisão vigente nova: orçamento aprovado é imutável para a oficina — itens, descontos e PDF congelados; a oficina segue editando previsão de saída, OS da oficina, mecânico, km e fotos das peças. Reenvio de orçamento continua permitido enquanto budget_status for 'pendente', 'reprovado' ou 'sem_orcamento'.
```

Registrar também, em `docs/SPEC.md`, que o gatilho `enforce_workshop_maintenance_columns` deixou de permitir o retorno de `budget_status` para `'pendente'` **quando a OS está aprovada** — o trecho da seção "Histórico de orçamentos aprovados e reprovados" que descreve o reorçamento sobrescrevendo a decisão anterior passa a valer apenas para orçamentos ainda não aprovados.

## Sugestão de commit

Quando todos os critérios de conclusão estiverem atendidos e o bug estiver confirmado como corrigido:

```
git add docs/MEMORY.md docs/MEMORY-HISTORY.md docs/SPEC.md \
        src/lib/maintenanceWorkshop.ts src/lib/maintenanceWorkshop.test.ts \
        src/components/MaintenanceForm.tsx \
        src/services/maintenanceService.ts src/services/maintenanceService.test.ts \
        src/pages/Maintenance.tsx \
        supabase/migrations/20260821000000_lock_approved_budget_for_workshop.sql

git commit -m "fix(manutencao): congela orçamento aprovado para a oficina e libera início do serviço"
```

`IMPLEMENTATION_FIXBUG.md` é artefato transitório de sessão e **não** entra no commit, salvo pedido explícito do usuário. Evitar `git add .`.
