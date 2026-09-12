-- ============================================================
-- DIAGNÓSTICO: quatro políticas de payment_installments
-- Data: 2026-09-12
-- SOMENTE LEITURA. Rodar em DEV e em PROD.
--
-- LIMITAÇÃO do método de substring: cláusula presente na expressão não prova
-- cláusula no ramo certo; é a seção 7 (impressão digital) que cobre esse vão.
--
-- LIMITAÇÃO: este arquivo verifica ESTRUTURA. Não tente testar a
-- policy com INSERT aqui: o SQL Editor roda como service_role, que
-- não passa por RLS, e o teste passaria sempre. Comportamento é
-- validado pela spec E2E, que autentica como usuário real:
--   PLAYWRIGHT_INCLUDE_PENDING=1 npx playwright test e2e/pending/payment-installment-insert-status.spec.ts --project=chromium
-- ============================================================

-- 1) Inventario da tabela
SELECT c.relrowsecurity AS rls_ativo,
       c.relforcerowsecurity AS rls_forcado,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = 'public.payment_installments'::regclass) AS total_policies
  FROM pg_class c
 WHERE c.oid = 'public.payment_installments'::regclass;
-- Esperado: rls_ativo = t, rls_forcado = f, total_policies = 4.
-- total_policies > 4 significa policy permissiva extra — ALARGA o acesso em
-- silêncio, porque policies do mesmo comando se somam por OR. Investigar antes
-- de seguir.

-- 2) As quatro politicas existem, com comando e papel corretos
SELECT pol.polname,
       CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                       WHEN '*' THEN 'ALL — ACHADO GRAVE, ver comentário' ELSE pol.polcmd::text END AS comando,
       (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid = ANY(pol.polroles)) AS roles
  FROM pg_policy pol
 WHERE pol.polrelid = 'public.payment_installments'::regclass
 ORDER BY pol.polname;
-- Esperado: exatamente 4 linhas, todas com roles = {authenticated}:
--   payment_installments_delete  | DELETE
--   payment_installments_insert  | INSERT
--   payment_installments_select  | SELECT
--   payment_installments_update  | UPDATE
-- Uma policy com comando 'ALL' vale para os quatro comandos de uma vez e
-- substitui as regras específicas de cada um. Se aparecer, PARAR: as seções
-- 3 a 6 estarão medindo uma policy que já não é a que decide.

-- 3) SELECT: clausulas
SELECT
  position('role_rank' IN expr) > 0 AS sel_role_rank,
  position('client_id' IN expr) > 0 AS sel_tenant,
  position('''Admin Master''' IN expr) > 0 AS sel_admin_master,
  position('''Financeiro''' IN expr) > 0 AS sel_financeiro,
  position('''Workshop''' IN expr) > 0 AS sel_workshop,
  position('''maintenance_order''' IN expr) > 0 AS sel_workshop_so_manutencao,
  position('workshops.profile_id = auth.uid()' IN expr) > 0 AS sel_workshop_oficina_propria,
  position('workshop_partnerships' IN expr) > 0 AS sel_workshop_parceria,
  position('''aprovado''' IN expr) > 0 AS sel_financeiro_status_aprovado,
  position('''pago''' IN expr) > 0 AS sel_financeiro_status_pago
  FROM (
    SELECT pg_get_expr(pol.polqual, pol.polrelid) AS expr
      FROM pg_policy pol
     WHERE pol.polrelid = 'public.payment_installments'::regclass
       AND pol.polname = 'payment_installments_select'
  ) s;
-- Esperado: 1 linha com TODAS as 10 colunas = t.
-- Qualquer f significa que a policy de leitura foi recriada incompleta — uma
-- regra de papel ou a trava de tenant sumiu.

-- 4) INSERT: clausulas
SELECT
  position('status = ''pendente_aprovacao''' IN expr) > 0        AS has_status_lock,
  position('payment_approved_by IS NULL' IN expr) > 0            AS has_approved_by_lock,
  position('payment_approved_at IS NULL' IN expr) > 0            AS has_approved_at_lock,
  position('paid_by IS NULL' IN expr) > 0                        AS has_paid_by_lock,
  position('paid_at IS NULL' IN expr) > 0                        AS has_paid_at_lock,
  position('cancelled_by IS NULL' IN expr) > 0                   AS has_cancelled_by_lock,
  position('cancelled_at IS NULL' IN expr) > 0                   AS has_cancelled_at_lock,
  position('cancellation_reason IS NULL' IN expr) > 0            AS has_reason_lock,
  position('created_by_id = auth.uid()' IN expr) > 0             AS keeps_author_check,
  position('''maintenance_order''' IN expr) > 0                  AS keeps_maintenance_branch,
  position('''extra_payment''' IN expr) > 0                      AS keeps_extra_branch,
  position('''Admin Master''' IN expr) > 0                       AS keeps_admin_master,
  position('''Workshop''' IN expr) > 0                           AS keeps_workshop_branch,
  position('role_rank' IN expr) > 0                              AS keeps_role_rank,
  position('client_id' IN expr) > 0                              AS keeps_tenant_check
  FROM (
    SELECT pg_get_expr(pol.polwithcheck, pol.polrelid) AS expr
      FROM pg_policy pol
     WHERE pol.polrelid = 'public.payment_installments'::regclass
       AND pol.polname = 'payment_installments_insert'
  ) s;
-- Esperado: 1 linha com TODAS as 15 colunas = t.

-- 5) UPDATE: clausulas nos DOIS lados
SELECT
  position('role_rank' IN expr_usando) > 0 AS upd_using_role_rank,
  position('client_id' IN expr_usando) > 0 AS upd_using_tenant,
  position('''Admin Master''' IN expr_usando) > 0 AS upd_using_admin_master,
  position('''Financeiro''' IN expr_usando) > 0 AS upd_using_financeiro,
  position('''Workshop''' IN expr_usando) > 0 AS upd_using_workshop,
  position('''maintenance_order''' IN expr_usando) > 0 AS upd_using_workshop_so_manutencao,
  position('workshop_partnerships' IN expr_usando) > 0 AS upd_using_workshop_parceria,
  position('role_rank' IN expr_checagem) > 0 AS upd_check_role_rank,
  position('client_id' IN expr_checagem) > 0 AS upd_check_tenant,
  position('''Admin Master''' IN expr_checagem) > 0 AS upd_check_admin_master,
  position('''Financeiro''' IN expr_checagem) > 0 AS upd_check_financeiro,
  position('''Workshop''' IN expr_checagem) > 0 AS upd_check_workshop,
  position('''maintenance_order''' IN expr_checagem) > 0 AS upd_check_workshop_so_manutencao,
  position('workshop_partnerships' IN expr_checagem) > 0 AS upd_check_workshop_parceria,
  md5(coalesce(expr_usando, '')) = md5(coalesce(expr_checagem, '')) AS upd_using_igual_ao_check
  FROM (
    SELECT pg_get_expr(pol.polqual, pol.polrelid) AS expr_usando,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS expr_checagem
      FROM pg_policy pol
     WHERE pol.polrelid = 'public.payment_installments'::regclass
       AND pol.polname = 'payment_installments_update'
  ) s;
-- Esperado: 1 linha com TODAS as 15 colunas = t.
-- upd_using_igual_ao_check = f é o achado mais grave desta seção: um WITH CHECK
-- mais frouxo que o USING permite MOVER uma parcela para outro client_id, isto é,
-- furar o isolamento entre clientes numa operação que o USING deixou passar.

-- 6) DELETE: clausulas, incluindo a trava de status
SELECT
  position('role_rank' IN expr) > 0 AS del_role_rank,
  position('client_id' IN expr) > 0 AS del_tenant,
  position('''Admin Master''' IN expr) > 0 AS del_admin_master,
  position('''Workshop''' IN expr) > 0 AS del_workshop,
  position('''maintenance_order''' IN expr) > 0 AS del_workshop_so_manutencao,
  position('status = ''pendente_aprovacao''' IN expr) > 0 AS del_workshop_so_pendente,
  position('workshop_partnerships' IN expr) > 0 AS del_workshop_parceria,
  position('''Financeiro''' IN expr) = 0 AS del_sem_financeiro
  FROM (
    SELECT pg_get_expr(pol.polqual, pol.polrelid) AS expr
      FROM pg_policy pol
     WHERE pol.polrelid = 'public.payment_installments'::regclass
       AND pol.polname = 'payment_installments_delete'
  ) s;
-- Esperado: 1 linha com TODAS as 8 colunas = t.
-- del_workshop_so_pendente = f é a falha silenciosa desta tabela: sem essa
-- cláusula a oficina apaga parcela JÁ APROVADA ou JÁ PAGA das OS dela, e nenhum
-- teste do projeto acusa.
-- del_sem_financeiro = f significa que o papel Financeiro ganhou porta de
-- exclusão, que ele nunca teve por desenho.

-- 7) Impressao digital das oito expressoes
-- ATENÇÃO ao sentido do JOIN: a tabela de referência é a que MANDA (LEFT JOIN
-- a partir dela). Se a consulta partisse das policies existentes, uma policy
-- APAGADA sumiria da saída em silêncio e as linhas restantes viriam todas em
-- 'confere = t' — exatamente a falha que esta seção existe para pegar.
-- Do jeito abaixo, policy ausente aparece como linha com confere = f.
SELECT ref.polname,
       base.md5_usando,
       base.md5_checagem,
       (base.polname IS NOT NULL
        AND base.md5_usando = ref.md5_usando_ref
        AND base.md5_checagem = ref.md5_checagem_ref) AS confere,
       (base.polname IS NULL) AS policy_ausente
  FROM (
    SELECT 'payment_installments_delete' AS polname, 'c55e3d6d1d143e9fec7a0627034f251d' AS md5_usando_ref, 'd41d8cd98f00b204e9800998ecf8427e' AS md5_checagem_ref
    UNION ALL SELECT 'payment_installments_insert', 'd41d8cd98f00b204e9800998ecf8427e', '12a7e96d3af80578e6e9388dff3e541b'
    UNION ALL SELECT 'payment_installments_select', '6d5d556388e051f66997f3e5a9d59b10', 'd41d8cd98f00b204e9800998ecf8427e'
    UNION ALL SELECT 'payment_installments_update', '75f634d012434edbc827820d5b29f79e', '75f634d012434edbc827820d5b29f79e'
  ) ref
  LEFT JOIN (
    SELECT pol.polname,
           md5(coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')) AS md5_usando,
           md5(coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')) AS md5_checagem
      FROM pg_policy pol
     WHERE pol.polrelid = 'public.payment_installments'::regclass
  ) base ON base.polname = ref.polname
 ORDER BY ref.polname;
-- Esperado: 4 linhas, todas com confere = t e policy_ausente = f.
-- confere = f significa que a expressão mudou, AINDA QUE todas as sondas das
-- seções 3 a 6 continuem em t. É esta seção que pega reordenação de ramo,
-- troca de OR por AND, negação invertida e qualquer coisa que a busca por
-- substring não enxerga.
-- Mudança legítima de policy EXIGE atualizar esta tabela na mesma migration,
-- e isso é deliberado: o valor aparece no diff do commit.

-- 8) Inventario de gatilhos
SELECT t.tgname,
       CASE WHEN (t.tgtype & 2) = 2 THEN 'BEFORE' ELSE 'AFTER' END AS momento,
       CASE WHEN (t.tgtype & 4) = 4 THEN 'INSERT'
            WHEN (t.tgtype & 16) = 16 THEN 'UPDATE'
            WHEN (t.tgtype & 8) = 8 THEN 'DELETE' END AS evento
  FROM pg_trigger t
 WHERE t.tgrelid = 'public.payment_installments'::regclass
   AND NOT t.tgisinternal
 ORDER BY t.tgname;
SELECT count(*) AS total_gatilhos,
       count(*) FILTER (WHERE (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4) AS total_before_insert
  FROM pg_trigger t
 WHERE t.tgrelid = 'public.payment_installments'::regclass
   AND NOT t.tgisinternal;
-- Esperado: 7 gatilhos, 3 deles BEFORE INSERT.
--   trg_audit_payment_installment_insert            AFTER  INSERT
--   trg_audit_payment_installment_status            AFTER  UPDATE
--   trg_enforce_payment_installment_budget_cap      BEFORE INSERT
--   trg_enforce_payment_installment_source_payable  BEFORE INSERT
--   trg_sync_extra_payment_request_paid_status      AFTER  UPDATE
--   trg_validate_payment_installment_source_integrity BEFORE INSERT
--   trg_validate_payment_installment_transition     BEFORE UPDATE
-- Um 4º BEFORE INSERT significa que alguém acrescentou gatilho contra a decisão
-- registrada de 2026-09-12: a trava de status é por POLICY, não por gatilho.

-- 9) Controle historico
SELECT count(*) FILTER (WHERE new_value->>'status' IS DISTINCT FROM 'pendente_aprovacao') AS criadas_fora_do_pendente,
       count(*) AS total_eventos_created
  FROM public.payment_installment_events
 WHERE event_type = 'created';
SELECT pr.role,
       count(*) AS total_parcelas,
       min(pi.created_at) AS primeira,
       max(pi.created_at) AS ultima
  FROM public.payment_installments pi
  LEFT JOIN public.profiles pr ON pr.id = pi.created_by_id
 GROUP BY pr.role
 ORDER BY total_parcelas DESC;
-- Esperado (a): criadas_fora_do_pendente = 0.
-- Esperado (b): distribuição informativa, sem valor "correto". Medida em PROD
-- em 2026-09-12: Fleet Analyst 91, Coordinator 43, Manager 12, Admin Master 3,
-- Workshop 1 (2026-08-05). Total 150.
-- A linha 'Workshop' é ESPERADA e INTENCIONAL — ver docs/MEMORY.md, "Decisões
-- Vigentes". Não é achado, não é brecha, não tratar como incidente.
-- Obs.: payment_installment_events só existe desde a migration 20260824000000,
-- por isso há 53 eventos 'created' para 150 parcelas. Não é lacuna de auditoria.

-- 10) CONTROLE NEGATIVO (obrigatorio)
SELECT
  (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.extra_payment_requests'::regclass) AS total_policies,
  EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.extra_payment_requests'::regclass AND polcmd = 'd') AS tem_policy_delete,
  (SELECT position('''Workshop''' IN pg_get_expr(pol.polqual, pol.polrelid)) > 0 FROM pg_policy pol WHERE polrelid = 'public.extra_payment_requests'::regclass AND polname = 'extra_payment_requests_select') AS select_cita_workshop,
  (SELECT position('status = ''pendente_aprovacao''' IN pg_get_expr(pol.polwithcheck, pol.polrelid)) > 0 FROM pg_policy pol WHERE polrelid = 'public.extra_payment_requests'::regclass AND polname = 'extra_payment_requests_insert') AS insert_trava_status;
-- Esperado: total_policies = 3 · tem_policy_delete = f ·
--           select_cita_workshop = f · insert_trava_status = t
--
-- ESTA SEÇÃO É A PROVA DE QUE O INSTRUMENTO ENXERGA.
-- Se ela devolver tudo verde, as sondas deste arquivo NÃO SABEM DIZER NÃO e o
-- diagnóstico inteiro é inútil — as seções 1 a 9 estarão relatando conformidade
-- que não verificaram. Nesse caso o resultado do arquivo é INVÁLIDO.
