-- ============================================================
-- MIGRATION: workshop_clients_rls
-- Descrição: Permite que usuários Workshop leiam os registros
--            de clients para os quais têm partnerships ativas.
--            Sem esta policy, o join clients(name) retorna null
--            quebrando o dropdown de transportadoras e a coluna
--            Cliente na tela de Manutenção.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

DROP POLICY IF EXISTS "clients_workshop_select" ON public.clients;

CREATE POLICY "clients_workshop_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT wp.client_id
      FROM public.workshop_partnerships wp
      JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
      WHERE wa.profile_id = auth.uid()
        AND wp.status = 'active'
    )
  );
