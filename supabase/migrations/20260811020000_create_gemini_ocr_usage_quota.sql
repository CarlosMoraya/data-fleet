-- ============================================================
-- MIGRATION: create_gemini_ocr_usage_quota
-- Data: 2026-08-11
-- Achado: V-06 — A06:2025 Design Inseguro / CWE-770
-- Descrição: Cota atômica por usuário para a Edge Function
--            'gemini-ocr'. Janela fixa de 1 hora em UTC, com
--            limite de 20 chamadas e 104857600 bytes (100 MB).
--
-- O processamento de documentos pelo Gemini foi autorizado pelo
-- usuário; esta migration impõe apenas os limites aprovados.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ── 1. Tabela de janela de consumo (uma linha por usuário) ──

CREATE TABLE IF NOT EXISTS public.gemini_ocr_usage_windows (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start  timestamptz NOT NULL,
  call_count    integer NOT NULL DEFAULT 0,
  bytes_used    bigint NOT NULL DEFAULT 0,
  last_call_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gemini_ocr_usage_windows IS
  'Janela de consumo do OCR Gemini por usuário. Acesso apenas via RPC public.consume_gemini_ocr_quota.';

-- RLS habilitado SEM nenhuma policy: a tabela fica inacessível
-- diretamente para 'authenticated' e 'anon'. Só a RPC SECURITY
-- DEFINER abaixo pode ler e escrever (least privilege).
ALTER TABLE public.gemini_ocr_usage_windows ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gemini_ocr_usage_windows FROM anon, authenticated;

-- ── 2. RPC atômica de consumo da cota ───────────────────────
-- Contrato:
--   * usa auth.uid(); nunca recebe user_id do frontend;
--   * rejeita usuário anônimo e bytes negativos;
--   * máximo de 20 chamadas e 104857600 bytes por janela de 1h;
--   * incrementa a contagem ANTES da chamada ao Gemini (fail closed);
--   * retorna motivo e segundos para nova tentativa ao bloquear;
--   * bloqueia a linha do usuário (FOR UPDATE) para ser atômica.

CREATE OR REPLACE FUNCTION public.consume_gemini_ocr_quota(p_file_bytes bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_max_calls      constant integer := 20;
  v_max_bytes      constant bigint  := 104857600; -- 100 MB
  v_window_seconds constant integer := 3600;
  v_now            timestamptz := now();
  v_window_start   timestamptz;
  v_row            public.gemini_ocr_usage_windows%ROWTYPE;
  v_retry_after    integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  IF p_file_bytes IS NULL OR p_file_bytes < 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_size');
  END IF;

  IF p_file_bytes > v_max_bytes THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_size');
  END IF;

  -- Janela fixa de 1 hora em UTC.
  v_window_start := date_trunc('hour', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  INSERT INTO public.gemini_ocr_usage_windows (user_id, window_start, call_count, bytes_used, last_call_at)
  VALUES (v_user_id, v_window_start, 0, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.gemini_ocr_usage_windows
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Janela expirada: zera os contadores antes de avaliar os limites.
  IF v_row.window_start < v_window_start THEN
    v_row.window_start := v_window_start;
    v_row.call_count := 0;
    v_row.bytes_used := 0;
  END IF;

  v_retry_after := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM (v_row.window_start + make_interval(secs => v_window_seconds) - v_now)))::integer
  );

  IF v_row.call_count + 1 > v_max_calls THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'call_quota_exceeded',
      'retry_after_seconds', v_retry_after
    );
  END IF;

  IF v_row.bytes_used + p_file_bytes > v_max_bytes THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'byte_quota_exceeded',
      'retry_after_seconds', v_retry_after
    );
  END IF;

  UPDATE public.gemini_ocr_usage_windows
  SET window_start = v_row.window_start,
      call_count   = v_row.call_count + 1,
      bytes_used   = v_row.bytes_used + p_file_bytes,
      last_call_at = v_now
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'calls_remaining', v_max_calls - (v_row.call_count + 1),
    'bytes_remaining', v_max_bytes - (v_row.bytes_used + p_file_bytes)
  );
END;
$$;

-- ── 3. Least privilege na execução da RPC ───────────────────

REVOKE ALL ON FUNCTION public.consume_gemini_ocr_quota(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_gemini_ocr_quota(bigint) TO authenticated;
