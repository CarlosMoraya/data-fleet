-- ============================================================
-- Migration: Módulo de Oficinas Parceiras
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. Tabela workshops ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workshops (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  cnpj             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  contact_person   TEXT,
  address_street   TEXT,
  address_number   TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city     TEXT,
  address_state    TEXT,
  address_zip      TEXT,
  specialties      TEXT[],
  notes            TEXT,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, cnpj)
);

-- ─── 2. Coluna can_delete_workshops em profiles ───────────────
-- (deve vir ANTES das políticas RLS que referenciam esta coluna)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_delete_workshops BOOLEAN NOT NULL DEFAULT false;

-- ─── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant (rank 3)+ do mesmo tenant, ou Admin Master (rank 7)
CREATE POLICY "workshops_select" ON public.workshops
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Fleet Assistant (rank 3)+ do mesmo tenant, ou Admin Master
CREATE POLICY "workshops_insert" ON public.workshops
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Fleet Analyst (rank 4)+ do mesmo tenant, ou Admin Master
CREATE POLICY "workshops_update" ON public.workshops
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- DELETE: Manager (rank 5)+ OU Fleet Analyst com can_delete_workshops = true
CREATE POLICY "workshops_delete" ON public.workshops
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = workshops.client_id AND role IN ('Manager','Director'))
        OR role = 'Admin Master'
        OR (client_id = workshops.client_id AND role = 'Fleet Analyst' AND can_delete_workshops = true)
      )
    )
  );

-- ─── 4. Índices ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS workshops_client_id_idx ON public.workshops (client_id);
CREATE INDEX IF NOT EXISTS workshops_name_idx ON public.workshops (client_id, name);
