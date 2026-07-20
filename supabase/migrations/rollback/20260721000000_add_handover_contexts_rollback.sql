-- ROLLBACK de 20260721000000_add_handover_contexts
-- ATENÇÃO: só execute se NÃO existirem templates ou checklists
-- usando os contextos 'Entrega'/'Devolução'. Verifique antes:
--   SELECT count(*) FROM public.checklist_templates
--    WHERE context IN ('Entrega','Devolução');

DROP INDEX IF EXISTS public.idx_checklists_driver_id;

ALTER TABLE public.checklists DROP COLUMN IF EXISTS signature_url;
ALTER TABLE public.checklists DROP COLUMN IF EXISTS cnh_photo_url;
ALTER TABLE public.checklists DROP COLUMN IF EXISTS driver_id;

ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS checklist_templates_context_check;

ALTER TABLE public.checklist_templates
  ADD CONSTRAINT checklist_templates_context_check
  CHECK (context IN (
    'Rotina','Auditoria','Guincho','Engate','Desengate',
    'Entrada em Oficina','Saída de Oficina','Segurança',
    'Atualização de Hodômetro'
  ));
