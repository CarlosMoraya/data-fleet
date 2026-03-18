-- ============================================================
-- MIGRATION: fix_workshops_roles_rls
-- Descrição: A migration add_supervisor_coordinator_roles.sql
--            recriou workshops_select sem incluir Driver e
--            Yard Auditor, quebrando a seleção de oficina nos
--            contextos "Entrada em Oficina" e "Saída de Oficina"
--            em ChecklistFill.tsx.
--
--            REGRA: Ao atualizar workshops_select, SEMPRE incluir
--            todos os roles que precisam ler oficinas:
--            Driver, Yard Auditor, Fleet Assistant, Fleet Analyst,
--            Supervisor, Manager, Coordinator, Director + Admin Master.
-- ============================================================

DROP POLICY IF EXISTS "workshops_select" ON public.workshops;

CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id
          AND role IN (
            'Driver',
            'Yard Auditor',
            'Fleet Assistant',
            'Fleet Analyst',
            'Supervisor',
            'Manager',
            'Coordinator',
            'Director'
          )
        )
        OR role = 'Admin Master'
      )
    )
  );
