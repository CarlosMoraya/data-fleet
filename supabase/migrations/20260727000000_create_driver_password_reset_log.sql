-- ============================================================
-- MIGRATION: create_driver_password_reset_log
-- Data: 2026-07-27
-- Descrição: Auditoria de redefinições administrativas de senha
--            de motoristas, feitas pelo time de frota via painel.
--            NUNCA armazena a senha — apenas quem, para quem e quando.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.driver_password_reset_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  driver_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL,
  reset_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reset_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.driver_password_reset_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dprl_driver_profile
  ON public.driver_password_reset_log(driver_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dprl_client
  ON public.driver_password_reset_log(client_id, created_at DESC);

-- ============================================================
-- RLS: leitura para Fleet Analyst+ (rank >= 4) do mesmo tenant,
--      ou Admin Master (client_id = NULL, cross-tenant).
--      Escrita: nenhuma policy — apenas service role (edge function).
-- ============================================================

DROP POLICY IF EXISTS "dprl_select" ON public.driver_password_reset_log;
CREATE POLICY "dprl_select" ON public.driver_password_reset_log
  FOR SELECT
  USING (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 4
    AND (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );
