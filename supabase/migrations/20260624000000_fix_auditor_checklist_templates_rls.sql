-- Migration: fix_auditor_checklist_templates_rls
-- Data: 2026-06-24
-- Bug: Yard Auditor não consegue visualizar templates de checklist com contexto "Auditoria"
--       na tela /checklists, mesmo existindo templates publicados para a categoria do veículo.
-- Causa raiz: A RLS policy "checklist_templates_select" (criada em add_supervisor_coordinator_roles.sql)
--             não inclui o role 'Yard Auditor' na lista de roles permitidos para SELECT,
--             ainda que a policy de INSERT em "checklists" permita que Auditors criem checklists.
-- Correção: DROP e RECREATE da policy "checklist_templates_select" adicionando 'Yard Auditor'
--           à lista de roles permitidos (mesmo client_id). Demais policies (INSERT/UPDATE/DELETE)
--           não são alteradas. Isolamento multi-tenant via client_id é preservado.

DROP POLICY IF EXISTS "checklist_templates_select" ON public.checklist_templates;

-- SELECT: Yard Auditor (rank 2)+ Fleet Assistant (rank 3)
-- Yard Auditor ganha leitura para executar auditorias.
-- Drivers continuam SEM permissão (não estão no allowlist).
-- Admin Master mantém acesso cross-tenant.
CREATE POLICY "checklist_templates_select" ON public.checklist_templates
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Yard Auditor','Fleet Assistant','Fleet Analyst','Supervisor','Manager','Coordinator','Director'))
        OR role = 'Admin Master'
      )
    )
  );