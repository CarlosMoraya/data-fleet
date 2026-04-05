-- ============================================================
-- MIGRATION: fix_workshop_partnership_rls
-- Descrição: Corrige recursão infinita (código 42P17) entre as
--            policies "wpart_workshop_select" (workshop_partnerships)
--            e "wa_client_select" (workshop_accounts).
--
-- Raiz do problema:
--   wpart_workshop_select acessa workshop_accounts
--   wa_client_select acessa workshop_partnerships
--   → ciclo infinito ao consultar qualquer tabela que indiretamente
--     acesse maintenance_orders (ex: vehicles via workshop_vehicle_select)
--
-- Solução:
--   Reescrever wpart_workshop_select para usar
--   profiles.workshop_account_id (FK adicionado em 20260404000000)
--   em vez de fazer join em workshop_accounts.
--   Isso quebra o ciclo mantendo o comportamento correto.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "wpart_workshop_select" ON public.workshop_partnerships;

-- Workshop vê suas partnerships consultando profiles diretamente
-- (evita cross-reference com workshop_accounts que causava recursão)
CREATE POLICY "wpart_workshop_select" ON public.workshop_partnerships
  FOR SELECT TO authenticated
  USING (
    workshop_account_id = (
      SELECT workshop_account_id FROM public.profiles WHERE id = auth.uid()
    )
  );
