-- Fix: permitir que Driver e Yard Auditor LEIAM os pneus do próprio tenant.
-- Motivo: a inspeção de pneus é realizada por Driver/Yard Auditor (vide
-- tire_inspections_insert), mas a política tires_select exigia role_rank >= 3,
-- ocultando todos os pneus para esses perfis e bloqueando a inspeção com a
-- mensagem "É necessário cadastrar todos os pneus desse veículo...".
-- Escopo: apenas SELECT. INSERT/UPDATE/DELETE permanecem inalterados.

DROP POLICY IF EXISTS "tires_select" ON public.tires;

CREATE POLICY "tires_select" ON public.tires
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Driver','Yard Auditor')
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );