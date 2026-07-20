-- ============================================================
-- MIGRATION: add_handover_contexts
-- Data: 2026-07-19
-- Descrição: Adiciona os contextos 'Entrega' e 'Devolução' a
--            checklist_templates e as colunas de evidência de
--            entrega/devolução em checklists (motorista, foto da
--            CNH e assinatura). Todas as colunas são NULLABLE:
--            a obrigatoriedade é imposta na aplicação, para não
--            invalidar o histórico existente.
-- ============================================================

-- ─── 1. Contextos novos ───
ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS checklist_templates_context_check;

ALTER TABLE public.checklist_templates
  ADD CONSTRAINT checklist_templates_context_check
  CHECK (context IN (
    'Rotina',
    'Auditoria',
    'Guincho',
    'Engate',
    'Desengate',
    'Entrega',
    'Devolução',
    'Entrada em Oficina',
    'Saída de Oficina',
    'Segurança',
    'Atualização de Hodômetro'
  ));

-- ─── 2. Colunas de evidência ───
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS driver_id UUID NULL REFERENCES public.drivers(id) ON DELETE SET NULL;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS cnh_photo_url TEXT NULL;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS signature_url TEXT NULL;

-- ─── 3. Índice para consulta de histórico por motorista ───
CREATE INDEX IF NOT EXISTS idx_checklists_driver_id
  ON public.checklists (driver_id)
  WHERE driver_id IS NOT NULL;
