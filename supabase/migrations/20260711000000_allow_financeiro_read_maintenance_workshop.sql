-- ============================================================
-- MIGRATION: allow_financeiro_read_maintenance_workshop
-- Data: 2026-07-11
-- Descrição: O papel 'Financeiro' (rank 1, fora da escada
--            role_rank >= N) nunca foi incluído nas policies de
--            SELECT de maintenance_orders e workshops. Isso faz
--            o embed aninhado usado por payment_installments
--            (maintenance_orders -> workshops) voltar vazio para
--            esse papel, escondendo Cliente/Fornecedor e
--            CNPJ/CPF na tela Financeiro -> Pagamentos e no CSV.
--            Esta migration apenas acrescenta 'Financeiro' às
--            duas listas de papéis já existentes, mantendo a
--            mesma restrição de client_id (mesmo tenant).
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_orders;
CREATE POLICY "maintenance_select" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'Fleet Assistant',
        'Fleet Analyst',
        'Supervisor',
        'Coordinator',
        'Manager',
        'Director',
        'Financeiro'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND public.workshop_profile_can_access_maintenance_order_id(auth.uid(), id)
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_vehicle_id(auth.uid(), vehicle_id)
    )
  );

DROP POLICY IF EXISTS "workshops_select" ON public.workshops;
CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT TO authenticated
  USING (
    (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'Driver',
        'Yard Auditor',
        'Fleet Assistant',
        'Fleet Analyst',
        'Supervisor',
        'Coordinator',
        'Manager',
        'Director',
        'Financeiro'
      )
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND profile_id = auth.uid()
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND id IN (
        SELECT wp.legacy_workshop_id
        FROM public.workshop_partnerships wp
        JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
        WHERE wa.profile_id = auth.uid()
          AND wp.status = 'active'
          AND wp.legacy_workshop_id IS NOT NULL
      )
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Operations Manager'
      AND public.operations_manager_can_access_workshop_id(auth.uid(), id)
    )
  );

NOTIFY pgrst, 'reload schema';
