-- ============================================================
-- DIAGNÓSTICO COMPORTAMENTAL: cancelamento de pagamentos aprovados
-- Data: 2026-09-11 — acompanha 20260911000000_payment_cancellation.sql
-- ⚠️ SOMENTE DEV. Nunca rodar em PROD.
--
-- Simula usuários reais (request.jwt.claims + SET LOCAL ROLE authenticated)
-- contra os gatilhos e as policies. Tudo é desfeito:
--   - cada caso termina em RAISE EXCEPTION ('CASE_OK' ou a falha real),
--     o que desfaz o sub-bloco;
--   - o bloco inteiro termina SEMPRE em RAISE EXCEPTION com o resumo.
-- Por isso a execução "falha" de propósito. O resultado está na mensagem:
--   RESULTADO: <n> PASS, <n> FAIL, <n> SKIP | <lista>
-- Esperado: RESULTADO: 15 PASS, 0 FAIL, 0 SKIP
--
-- Fixtures lidos de dados existentes do cliente com mais parcelas. Caso sem
-- fixture vira SKIP, nunca PASS.
-- ============================================================

DO $diag$
DECLARE
  -- fixtures
  v_client         UUID;
  v_os_inst        UUID;
  v_a              UUID;  -- aprovador da parcela de OS
  v_b              UUID;  -- outro Coordenador+ do cliente, diferente de A
  v_fin            UUID;  -- Financeiro do cliente
  v_am             UUID;  -- Admin Master
  v_extra          UUID;  -- pedido extra aprovado (preferência: mais parcelas)
  v_extra_approver UUID;
  v_extra_other    UUID;  -- Coordenador+ do cliente, diferente do aprovador do extra
  v_extra_inst     UUID;
  v_extra_count    INTEGER;
  v_pend           UUID;  -- pedido extra pendente com parcelas
  v_pend_creator   UUID;
  -- trabalho
  v_rows    INTEGER;
  v_msg     TEXT;
  v_status  TEXT;
  v_by      UUID;
  v_at      TIMESTAMPTZ;
  v_bad     INTEGER;
  v_cnt     INTEGER;
  v_cnt2    INTEGER;
  -- resultado
  v_results TEXT[] := ARRAY[]::TEXT[];
  v_pass    INTEGER := 0;
  v_fail    INTEGER := 0;
  v_skip    INTEGER := 0;
BEGIN
  -- ----------------------------------------------------------
  -- Fixtures (como postgres, antes de qualquer troca de usuário)
  -- ----------------------------------------------------------
  SELECT pi.id, pi.client_id, pi.payment_approved_by
    INTO v_os_inst, v_client, v_a
    FROM public.payment_installments pi
    JOIN public.profiles p ON p.id = pi.payment_approved_by
   WHERE pi.source_type = 'maintenance_order'
     AND pi.status = 'aprovado'
     AND p.role IN ('Coordinator', 'Manager', 'Director')
     AND p.client_id = pi.client_id
     AND p.active IS NOT FALSE
   ORDER BY (SELECT count(*) FROM public.payment_installments x WHERE x.client_id = pi.client_id) DESC, pi.id
   LIMIT 1;

  SELECT id INTO v_b FROM public.profiles
   WHERE client_id = v_client AND role IN ('Coordinator', 'Manager', 'Director')
     AND id <> v_a AND active IS NOT FALSE
   ORDER BY id LIMIT 1;

  SELECT id INTO v_fin FROM public.profiles
   WHERE client_id = v_client AND role = 'Financeiro' AND active IS NOT FALSE
   ORDER BY id LIMIT 1;

  SELECT id INTO v_am FROM public.profiles
   WHERE role = 'Admin Master' AND active IS NOT FALSE
   ORDER BY id LIMIT 1;

  SELECT epr.id, epr.approved_by INTO v_extra, v_extra_approver
    FROM public.extra_payment_requests epr
    JOIN public.profiles p ON p.id = epr.approved_by
   WHERE epr.client_id = v_client
     AND epr.status = 'aprovado'
     AND p.role IN ('Coordinator', 'Manager', 'Director')
     AND p.client_id = epr.client_id
     AND p.active IS NOT FALSE
     AND EXISTS (SELECT 1 FROM public.payment_installments x
                  WHERE x.extra_payment_request_id = epr.id AND x.source_type = 'extra_payment')
   ORDER BY (SELECT count(*) FROM public.payment_installments x WHERE x.extra_payment_request_id = epr.id) DESC, epr.id
   LIMIT 1;

  SELECT count(*) INTO v_extra_count FROM public.payment_installments
   WHERE extra_payment_request_id = v_extra AND source_type = 'extra_payment';

  SELECT id INTO v_extra_inst FROM public.payment_installments
   WHERE extra_payment_request_id = v_extra AND source_type = 'extra_payment' AND status = 'aprovado'
   ORDER BY id LIMIT 1;

  SELECT id INTO v_extra_other FROM public.profiles
   WHERE client_id = v_client AND role IN ('Coordinator', 'Manager', 'Director')
     AND id <> v_extra_approver AND active IS NOT FALSE
   ORDER BY id LIMIT 1;

  SELECT epr.id, epr.created_by_id INTO v_pend, v_pend_creator
    FROM public.extra_payment_requests epr
    JOIN public.profiles p ON p.id = epr.created_by_id
   WHERE epr.client_id = v_client
     AND epr.status = 'pendente_aprovacao'
     AND p.client_id = epr.client_id
     AND p.active IS NOT FALSE
     AND EXISTS (SELECT 1 FROM public.payment_installments x
                  WHERE x.extra_payment_request_id = epr.id AND x.source_type = 'extra_payment')
   ORDER BY epr.id
   LIMIT 1;

  -- ----------------------------------------------------------
  -- B1 — aprovador A cancela a parcela de OS
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B1 SKIP (sem parcela de OS aprovada)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B1' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RESET ROLE;
      SELECT status, cancelled_by, cancelled_at INTO v_status, v_by, v_at
        FROM public.payment_installments WHERE id = v_os_inst;
      IF v_rows = 1 AND v_status = 'cancelado' AND v_by = v_a AND v_at IS NOT NULL THEN
        RAISE EXCEPTION 'CASE_OK';
      END IF;
      RAISE EXCEPTION 'CASE_FAIL linhas=% status=% cancelled_by=% cancelled_at=%', v_rows, v_status, v_by, v_at;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF v_msg = 'CASE_OK' THEN v_pass := v_pass + 1; v_results := v_results || 'B1 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B1 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B2 — outro aprovador (B) tenta cancelar a parcela de A
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL OR v_b IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B2 SKIP (sem parcela de OS ou sem outro Coordenador+)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B2' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('apenas quem aprovou a parcela ou o Admin Master' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B2 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B2 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B3 — aprovador A sem motivo (só espaços)
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B3 SKIP (sem parcela de OS aprovada)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = '   ' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('Motivo do cancelamento é obrigatório.' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B3 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B3 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B4 — Financeiro tenta cancelar a parcela de OS
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL OR v_fin IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B4 SKIP (sem parcela de OS ou sem Financeiro)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B4' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('apenas quem aprovou a parcela' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B4 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B4 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B5 — Admin Master cancela a parcela de OS
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL OR v_am IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B5 SKIP (sem parcela de OS ou sem Admin Master)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_am, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B5' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RESET ROLE;
      SELECT cancelled_by INTO v_by FROM public.payment_installments WHERE id = v_os_inst;
      IF v_rows = 1 AND v_by = v_am THEN
        RAISE EXCEPTION 'CASE_OK';
      END IF;
      RAISE EXCEPTION 'CASE_FAIL linhas=% cancelled_by=%', v_rows, v_by;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF v_msg = 'CASE_OK' THEN v_pass := v_pass + 1; v_results := v_results || 'B5 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B5 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B6 — A cancela; depois o Financeiro tenta marcar como pago
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL OR v_fin IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B6 SKIP (sem parcela de OS ou sem Financeiro)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B6' WHERE id = v_os_inst;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
      UPDATE public.payment_installments SET status = 'pago' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('só é possível marcar como Pago uma parcela já aprovada' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B6 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B6 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B7 — A cancela; depois tenta alterar o motivo
  -- ----------------------------------------------------------
  IF v_os_inst IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B7 SKIP (sem parcela de OS aprovada)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B7' WHERE id = v_os_inst;
      UPDATE public.payment_installments SET cancellation_reason = 'alterado' WHERE id = v_os_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('só é possível editar parcelas pendentes' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B7 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B7 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B8 — outro Coordenador+ tenta cancelar o pedido extra aprovado
  -- ----------------------------------------------------------
  IF v_extra IS NULL OR v_extra_other IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B8 SKIP (sem extra aprovado ou sem outro Coordenador+)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_extra_other, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.extra_payment_requests SET status = 'cancelado', cancellation_reason = 'Teste B8' WHERE id = v_extra;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('apenas quem aprovou o pagamento extra' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B8 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B8 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B9 — aprovador do extra cancela o pedido; parcelas acompanham
  -- ----------------------------------------------------------
  IF v_extra IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B9 SKIP (sem extra aprovado)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_extra_approver, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.extra_payment_requests SET status = 'cancelado', cancellation_reason = 'Teste B9' WHERE id = v_extra;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RESET ROLE;
      SELECT status, cancelled_by INTO v_status, v_by FROM public.extra_payment_requests WHERE id = v_extra;
      SELECT count(*),
             count(*) FILTER (WHERE status <> 'cancelado' OR cancellation_reason IS DISTINCT FROM 'Teste B9')
        INTO v_cnt, v_bad
        FROM public.payment_installments
       WHERE extra_payment_request_id = v_extra AND source_type = 'extra_payment';
      IF v_rows = 1 AND v_status = 'cancelado' AND v_by = v_extra_approver AND v_cnt >= 1 AND v_bad = 0 THEN
        RAISE EXCEPTION 'CASE_OK';
      END IF;
      RAISE EXCEPTION 'CASE_FAIL linhas=% status=% cancelled_by=% parcelas=% fora_do_esperado=%',
        v_rows, v_status, v_by, v_cnt, v_bad;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF v_msg = 'CASE_OK' THEN v_pass := v_pass + 1; v_results := v_results || 'B9 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B9 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B10 — Financeiro lança uma parcela; aprovador tenta cancelar o pedido
  --       (exige ao menos 2 parcelas: com 1, o pedido vira 'pago' sozinho)
  -- ----------------------------------------------------------
  IF v_extra IS NULL OR v_fin IS NULL OR v_extra_inst IS NULL OR v_extra_count < 2 THEN
    v_skip := v_skip + 1; v_results := v_results || 'B10 SKIP (sem extra aprovado com 2+ parcelas ou sem Financeiro)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'pago' WHERE id = v_extra_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows <> 1 THEN
        RAISE EXCEPTION 'CASE_FAIL Financeiro não conseguiu lançar a parcela (linhas=%)', v_rows;
      END IF;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_extra_approver, 'role', 'authenticated')::text, true);
      UPDATE public.extra_payment_requests SET status = 'cancelado', cancellation_reason = 'Teste B10' WHERE id = v_extra;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('já lançada no sistema' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B10 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B10 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B11 — aprovador do extra tenta cancelar uma parcela isolada
  -- ----------------------------------------------------------
  IF v_extra IS NULL OR v_extra_inst IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B11 SKIP (sem parcela de extra aprovado)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_extra_approver, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.payment_installments SET status = 'cancelado', cancellation_reason = 'Teste B11' WHERE id = v_extra_inst;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('só são canceladas junto com o pedido' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B11 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B11 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B12 — pedido cancelado é imutável
  -- ----------------------------------------------------------
  IF v_extra IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B12 SKIP (sem extra aprovado)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_extra_approver, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.extra_payment_requests SET status = 'cancelado', cancellation_reason = 'Teste B12' WHERE id = v_extra;
      UPDATE public.extra_payment_requests SET notes = 'x' WHERE id = v_extra;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('cancelado não pode ser alterado' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B12 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B12 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B13 — Financeiro enxerga o extra cancelado que foi aprovado
  -- ----------------------------------------------------------
  IF v_extra IS NULL OR v_fin IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B13 SKIP (sem extra aprovado ou sem Financeiro)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_extra_approver, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.extra_payment_requests SET status = 'cancelado', cancellation_reason = 'Teste B13' WHERE id = v_extra;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fin, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO v_cnt FROM public.extra_payment_requests WHERE id = v_extra;
      SELECT count(*) INTO v_cnt2 FROM public.payment_installments WHERE extra_payment_request_id = v_extra;
      IF v_cnt = 1 AND v_cnt2 >= 1 THEN
        RAISE EXCEPTION 'CASE_OK';
      END IF;
      RAISE EXCEPTION 'CASE_FAIL pedido_visivel=% parcelas_visiveis=%', v_cnt, v_cnt2;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF v_msg = 'CASE_OK' THEN v_pass := v_pass + 1; v_results := v_results || 'B13 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B13 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B14 — criador do pendente cancela sem motivo
  -- ----------------------------------------------------------
  IF v_pend IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B14 SKIP (sem extra pendente com parcelas)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pend_creator, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.extra_payment_requests SET status = 'cancelado' WHERE id = v_pend;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RAISE EXCEPTION 'CASE_FAIL sem erro (linhas=%)', v_rows;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF position('Motivo do cancelamento é obrigatório.' IN v_msg) > 0 THEN
        v_pass := v_pass + 1; v_results := v_results || 'B14 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B14 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- B15 — criador do pendente cancela com motivo; parcelas acompanham
  -- ----------------------------------------------------------
  IF v_pend IS NULL THEN
    v_skip := v_skip + 1; v_results := v_results || 'B15 SKIP (sem extra pendente com parcelas)'::TEXT;
  ELSE
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pend_creator, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.extra_payment_requests SET status = 'cancelado', cancellation_reason = 'Teste B15' WHERE id = v_pend;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      RESET ROLE;
      SELECT count(*), count(*) FILTER (WHERE status <> 'cancelado')
        INTO v_cnt, v_bad
        FROM public.payment_installments
       WHERE extra_payment_request_id = v_pend AND source_type = 'extra_payment';
      IF v_rows = 1 AND v_cnt >= 1 AND v_bad = 0 THEN
        RAISE EXCEPTION 'CASE_OK';
      END IF;
      RAISE EXCEPTION 'CASE_FAIL linhas=% parcelas=% nao_canceladas=%', v_rows, v_cnt, v_bad;
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      IF v_msg = 'CASE_OK' THEN v_pass := v_pass + 1; v_results := v_results || 'B15 PASS'::TEXT;
      ELSE v_fail := v_fail + 1; v_results := v_results || ('B15 FAIL: ' || v_msg); END IF;
    END;
  END IF;

  -- ----------------------------------------------------------
  -- Resumo — SEMPRE via exceção, para desfazer tudo.
  -- ----------------------------------------------------------
  RAISE EXCEPTION 'RESULTADO: % PASS, % FAIL, % SKIP | %',
    v_pass, v_fail, v_skip, array_to_string(v_results, ' ; ');
END;
$diag$;
