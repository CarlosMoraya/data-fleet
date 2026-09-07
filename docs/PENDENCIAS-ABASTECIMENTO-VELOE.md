# Pendências — Módulo de Abastecimento (integração Veloe)

> Documento de continuidade. Se você é um agente retomando este trabalho em
> outra sessão: leia isto inteiro antes de tocar em qualquer arquivo. Ele
> substitui o `IMPLEMENTATION.md` da sessão original (2026-09-06), que é
> transitório e pode já ter sido sobrescrito.
>
> Última atualização: 2026-09-06.

## Status em uma frase

**Código e infraestrutura de leitura estão 100% em produção e a tela já
aparece para a Deluna.** Falta só a parte que depende de terceiro: as
credenciais da API Veloe, sem as quais não há dado real chegando na tabela.

## O que já está pronto (não refazer)

- [x] Tabela `public.fuel_supplies` + RLS aplicada em **DEV e PROD**.
- [x] Edge Function `veloe-fuel-sync` publicada em **DEV e PROD**
      (`supabase functions deploy veloe-fuel-sync --project-ref <ref>`).
      Slug confirmado correto nos dois (`401`, não `404`, em `curl` sem token).
- [x] Código do frontend commitado (`f42401c`) e em produção.
- [x] `VITE_VELOE_CLIENT_ID` configurada nos **três lugares** que importam:
  - `.env.local` → `6c5daeb6-df37-4e61-93c4-41975bf846c6` (id da Deluna no banco **DEV**)
  - `.env.production` (referência local, não lida pelo Vercel) → `da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4` (id da Deluna no banco **PROD**)
  - **Vercel → Project Settings → Environment Variables (Production)** → `da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4`
- [x] Redeploy em produção feito (`vercel redeploy ... --target production`) e confirmado por inspeção do bundle JS: a lógica do gate de tenant está corretamente compilada.
- [x] Interface confirmada visível em produção para a Deluna (validado pelo usuário em 2026-09-06).
- [x] E-mail rascunhado para o representante Veloe solicitando as 4 credenciais (não confirmado se já foi enviado).

## O que falta, em ordem

1. **Enviar/aguardar resposta do representante Veloe** com as 4 credenciais:
   `x-ibm-client-id`, `x-ibm-client-secret`, `ClientId`, número do **contrato**.
   Documentado em `public/veloeApi/API fuel-supply-data.pdf`, páginas 2–3.
   **Bloqueia todos os itens abaixo.**

2. **Cadastrar os 5 secrets da Edge Function em DEV** (Dashboard → Edge Functions
   → `veloe-fuel-sync` → Secrets):

   | Secret | Valor (DEV) |
   | :--- | :--- |
   | `VELOE_CLIENT_ID` | `6c5daeb6-df37-4e61-93c4-41975bf846c6` |
   | `VELOE_API_BASE_URL` | `https://api.alelo.com.br/alelo/prd/auto/partner/api/fuel-supply-data` |
   | `VELOE_IBM_CLIENT_ID` | (da credencial) |
   | `VELOE_IBM_CLIENT_SECRET` | (da credencial) |
   | `VELOE_CONTRACT` | (da credencial) |

3. **Validar a integração real em DEV** — roteiro manual (Etapa 3 do plano original):
   - `curl -i -X POST .../veloe-fuel-sync -d '{}'` sem token → `401` (função existe, slug ok — já confirmado).
   - Logado como Manager da Deluna, disparar sync de **1 dia**. Esperado `200` com `fetched`/`upserted` coerentes.
   - Disparar a **mesma janela duas vezes**. `upserted` deve ser igual e a contagem de linhas em `fuel_supplies` **não pode mudar** — prova de idempotência.
   - Logado como usuário de outro tenant, disparar sync → esperado `403`.
   - Conferir logs da função: nenhum CPF, cartão, token ou payload deve aparecer.

4. **Descobrir e registrar o comportamento real de `vehiclePlates`.**
   O PDF marca como obrigatório na tabela de parâmetros, mas o exemplo de
   request não o envia. O código (`veloeClient.ts`) já trata os dois casos
   (tenta sem, cai para fallback com placas em lotes de 200 se vier `400`).
   Depois do primeiro teste real, anotar aqui qual dos dois comportamentos
   se confirmou — isso também determina se algum dia vai existir registro
   "não identificado" vindo da própria Veloe.

5. **Replicar os 5 secrets em PROD**, só depois do item 3 validado em DEV.
   Valor de `VELOE_CLIENT_ID` em PROD: `da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4`.

6. **Criar os dois secrets no Supabase Vault**, em DEV e depois em PROD
   (passo manual, não versionado — SQL Editor):
   ```sql
   SELECT vault.create_secret('<SERVICE_ROLE_KEY_DO_AMBIENTE>', 'veloe_sync_service_key');
   SELECT vault.create_secret('<URL_DO_PROJETO_DO_AMBIENTE>', 'veloe_sync_project_url');
   ```
   URLs: DEV = `https://vvbnbzzhpiksacqudmfu.supabase.co`, PROD = `https://oajfjdadcicgoxrfrnny.supabase.co`.

7. **Aplicar a migration `supabase/migrations/20260906000100_schedule_veloe_fuel_sync.sql`**
   em DEV e depois PROD — só depois do item 6, senão o job de `pg_cron` fica
   ativo mas falha todo dia às 06:00 UTC sem produzir nada.

8. **Rodar a carga histórica de 12 meses**: `npx tsx scripts/backfill-veloe-fuel.ts`
   (dry-run primeiro, sem flag) e depois `--apply`. **Atenção:** o script lê
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` de `.env.local` — para rodar
   contra PROD, apontar essas variáveis para o projeto PROD antes de chamar
   com `--apply` (ou duplicar o `.env` temporariamente).

9. **Validação final**: conferir dados reais aparecendo na tabela em
   `/abastecimento`, KPIs e filtros funcionando com volume real.

## Fatos-chave para quem for continuar

| Item | DEV | PROD |
| :--- | :--- | :--- |
| Projeto Supabase | `vvbnbzzhpiksacqudmfu` | `oajfjdadcicgoxrfrnny` |
| `client_id` da Deluna | `6c5daeb6-df37-4e61-93c4-41975bf846c6` | `da9ad1ff-9a9a-43ba-96c5-05f14fd5f5b4` |
| Projeto Vercel | `carlosmorayas-projects/betafleet` (`app.betafleet.com.br`) | idem |

## Armadilhas já pisadas nesta sessão (não repetir)

- **`.env.production` local é só referência — o Vercel nunca lê esse arquivo**
  (está no `.gitignore`, e o build roda a partir do checkout do GitHub). Toda
  variável `VITE_*` que precisa valer em produção tem que estar em
  **Vercel → Project Settings → Environment Variables**, escopo *Production*.
- **O Vite grava o valor da env var dentro do JavaScript no momento do build.**
  Adicionar/mudar uma variável no Vercel não muda um deploy já existente —
  é preciso `vercel redeploy <url-do-deploy> --target production` (ou um novo
  push) depois de mexer nas env vars.
- **DEV e PROD são bancos Supabase totalmente separados** — a mesma Deluna
  tem UUIDs diferentes em cada `clients`. Nunca copiar o UUID de um ambiente
  para o outro sem conferir.
- **`buildExternalKey` usa os 4 últimos dígitos do cartão, não o número
  completo** — desvio deliberado do plano original (que mandava concatenar
  o cartão inteiro), decidido com o usuário em 2026-09-06 porque a regra
  literal violaria a restrição de LGPD do próprio módulo e o teste de
  segurança obrigatório. Não "corrigir" isso de volta.
- Os três arquivos da Edge Function (`index.ts`, `veloeClient.ts`,
  `veloeMapping.ts`) têm que estar **juntos na mesma pasta** no deploy —
  a CLI (`supabase functions deploy`) já cuida disso sozinha; só é risco
  se alguém publicar pelo Dashboard copiando arquivo por arquivo.

## Onde ver mais contexto

- `docs/MEMORY.md` (seção "Estado Atual") — resumo da entrega original.
- `docs/MEMORY-HISTORY.md` — sessão completa de 2026-09-06, com todas as
  9 etapas detalhadas.
- `public/veloeApi/API fuel-supply-data.pdf` — contrato oficial da API
  (v1.4.0), páginas 2–3 para os parâmetros de autenticação.
- Código: `supabase/functions/veloe-fuel-sync/`, `src/pages/FuelSupplies.tsx`,
  `src/hooks/useFuelSupplyAccess.ts`, `src/lib/fuelSupplyFilters.ts`,
  `src/lib/fuelSupplyKpi.ts`.
