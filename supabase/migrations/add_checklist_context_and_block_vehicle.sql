-- ============================================================
-- Adiciona colunas de contexto e can_block_vehicle às tabelas
-- de checklist, caso ainda não existam.
-- Executar no Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. Adicionar coluna `context` em checklist_templates ───

ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'Rotina'
    CHECK (context IN ('Rotina','Auditoria','Reboque','Entrada em Oficina','Saída de Oficina','Segurança'));

-- ─── 2. Adicionar coluna `can_block_vehicle` em checklist_items ─

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS can_block_vehicle BOOLEAN NOT NULL DEFAULT false;

-- ─── 3. Adicionar coluna `workshop_id` em checklists ────────

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL;

-- ─── 4. Atualizar EXCLUDE constraint para incluir context ───
-- Remove a constraint antiga (por categoria sem contexto)
-- e cria nova que permite 1 published por (client, category, context)

ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS unique_published_category;

ALTER TABLE public.checklist_templates
  DROP CONSTRAINT IF EXISTS unique_published_category_context;

-- Nova constraint: 1 published por (client, category, context)
ALTER TABLE public.checklist_templates
  ADD CONSTRAINT unique_published_category_context
    EXCLUDE USING btree (client_id WITH =, vehicle_category WITH =, context WITH =)
    WHERE (status = 'published' AND vehicle_category IS NOT NULL);
