ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS checklist_templates_context_check;

ALTER TABLE public.checklist_templates
  ADD CONSTRAINT checklist_templates_context_check
  CHECK (context IN ('Rotina','Auditoria','Reboque','Entrada em Oficina','Saída de Oficina','Segurança','Atualização de Hodômetro'));

NOTIFY pgrst, 'reload schema';
