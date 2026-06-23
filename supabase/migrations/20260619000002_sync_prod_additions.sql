-- ============================================================
-- SYNC: PROD — adicionar colunas/constraints do DEV que faltam
-- Descrição: Torna o PROD compatível com o DEV de forma
--            aditiva (zero risco de quebrar dados existentes).
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (PROD)
-- ============================================================

-- ─── 1. Adicionar coluna status em vehicles ─────────────────
-- Todos os veículos existentes recebem 'Available' automaticamente.

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available';

-- Garante que linhas existentes (caso o DEFAULT não tenha sido aplicado)
UPDATE public.vehicles SET status = 'Available' WHERE status IS NULL;

-- Torna obrigatório para novos registros
ALTER TABLE public.vehicles ALTER COLUMN status SET NOT NULL;

-- Constraint de validação
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('Available', 'Maintenance', 'In Use'));

-- ─── 2. Adicionar coluna is_free_form em checklist_templates ─
-- Todos os templates existentes recebem false automaticamente.

ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS is_free_form BOOLEAN DEFAULT false;

UPDATE public.checklist_templates SET is_free_form = false WHERE is_free_form IS NULL;

ALTER TABLE public.checklist_templates ALTER COLUMN is_free_form SET NOT NULL;

-- ─── 3. Tornar vehicle_category nullable ────────────────────
-- Necessário para suportar is_free_form = true (categoria livre).

ALTER TABLE public.checklist_templates ALTER COLUMN vehicle_category DROP NOT NULL;

-- ─── 4. Adicionar constraint check_free_form_or_category ────
-- Garante consistência: ou é categoria livre (is_free_form=true, category=NULL)
-- ou tem categoria definida (is_free_form=false, category NOT NULL).

ALTER TABLE public.checklist_templates ADD CONSTRAINT check_free_form_or_category
  CHECK (
    (is_free_form = true AND vehicle_category IS NULL)
    OR (is_free_form = false AND vehicle_category IS NOT NULL)
  );

-- ─── 5. Criar função handle_updated_at ──────────────────────
-- Função padrão para triggers de updated_at (já usada no PROD
-- pelo trigger set_maintenance_updated_at).

CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
