-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
--
-- SECURITY INVOKER é OBRIGATÓRIO e não é detalhe: a função precisa rodar com a
-- identidade de quem chamou, para que (a) as policies de UPDATE de profiles e
-- drivers continuem valendo, (b) auth.uid() esteja preenchido e o gatilho
-- trg_guard_profile_activation aplique as quatro invariantes, e (c) o autor do
-- evento de auditoria seja a pessoa real. Trocar para SECURITY DEFINER
-- desligaria as três coisas de uma vez.

CREATE OR REPLACE FUNCTION public.set_profile_activation(
  p_target_id   UUID,
  p_next_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now      TIMESTAMPTZ := now();
  v_stamp_at TIMESTAMPTZ;
  v_stamp_by UUID;
  v_rows     INT;
BEGIN
  IF p_next_active THEN
    v_stamp_at := NULL;
    v_stamp_by := NULL;
  ELSE
    v_stamp_at := v_now;
    v_stamp_by := auth.uid();
  END IF;

  UPDATE public.profiles
     SET active         = p_next_active,
         inactivated_at = v_stamp_at,
         inactivated_by = v_stamp_by
   WHERE id = p_target_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Usuário não encontrado ou fora do seu escopo de permissão.'
      USING ERRCODE = '42501';
  END IF;

  -- Motorista vinculado, quando existe. Zero linhas aqui é caso normal:
  -- a maioria dos perfis não é motorista.
  UPDATE public.drivers
     SET active         = p_next_active,
         inactivated_at = v_stamp_at,
         inactivated_by = v_stamp_by
   WHERE profile_id = p_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_activation(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_activation(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
