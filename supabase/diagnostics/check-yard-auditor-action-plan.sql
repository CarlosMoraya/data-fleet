-- ============================================================
-- DIAGNÓSTICO ESTRUTURAL: Yard Auditor responsável por plano de ação
-- Data: 2026-09-14 — acompanha 20260914100000_yard_auditor_action_plan_responsible.sql
-- SOMENTE LEITURA. Rodar em DEV e em PROD.
--
-- LIMITAÇÃO: verifica ESTRUTURA. O SQL Editor roda como service_role, que não
-- passa por RLS e cai no escape hatch do gatilho (auth.uid() NULL). Comportamento
-- é validado pela spec que autentica como usuário real:
--   PLAYWRIGHT_INCLUDE_PENDING=1 npx playwright test e2e/pending/action-plan-auditor-flow.spec.ts --project=auditor
-- ============================================================

-- 1) Inventário de policies
SELECT count(*) AS total_policies
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'action_plans';
-- Esperado: 6. Mais de 6 = policy permissiva extra, que ALARGA acesso em silêncio.

-- 2) As 4 policies originais continuam byte a byte iguais
SELECT policyname,
       md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) AS impressao,
       CASE policyname
         WHEN 'action_plans_delete' THEN 'c1a4f32e4a3d9aa44a190a7aa150035e'
         WHEN 'action_plans_insert' THEN 'f0ce15eee62a67ea706b60955a390720'
         WHEN 'action_plans_select' THEN 'a4b0341c49b9f394a489fdcae2122625'
         WHEN 'action_plans_update' THEN '0ff3b08edc8685ff3d33411b98e2e2eb'
       END AS esperado
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename = 'action_plans'
   AND policyname IN ('action_plans_delete', 'action_plans_insert', 'action_plans_select', 'action_plans_update')
 ORDER BY policyname;
-- Esperado: 4 linhas, impressao = esperado em todas.

-- 3) As 2 policies novas existem, no comando certo, com as 3 cláusulas nos dois lados
SELECT policyname,
       cmd,
       roles::text AS papeis,
       qual ILIKE '%responsible_id = auth.uid()%'              AS using_responsavel,
       qual ILIKE '%get_my_client_id()%'                       AS using_tenant,
       qual ILIKE '%''Yard Auditor''%'                         AS using_papel,
       (cmd = 'SELECT' OR with_check IS NOT DISTINCT FROM qual) AS check_igual_using
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename = 'action_plans'
   AND policyname IN ('action_plans_select_yard_auditor_responsible', 'action_plans_update_yard_auditor_responsible')
 ORDER BY policyname;
-- Esperado: 2 linhas.
--   select_…: cmd SELECT, papeis {authenticated}, t · t · t · t
--   update_…: cmd UPDATE, papeis {authenticated}, t · t · t · t

-- 4) Gatilho ativo, BEFORE UPDATE, por linha
SELECT t.tgname,
       t.tgenabled                         AS habilitado,
       (t.tgtype & 2)  <> 0                AS before,
       (t.tgtype & 16) <> 0                AS on_update,
       (t.tgtype & 1)  <> 0                AS por_linha,
       p.proname
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE t.tgrelid = 'public.action_plans'::regclass
   AND t.tgname = 'trg_enforce_yard_auditor_action_plan_update';
-- Esperado: 1 linha — O · t · t · t · fn_enforce_yard_auditor_action_plan_update

-- 5) Sondas do corpo do gatilho
SELECT prosrc ILIKE '%to_jsonb(NEW) - v_allowed_keys%'        AS allowlist_colunas,
       prosrc ILIKE '%OLD.responsible_id IS DISTINCT FROM auth.uid()%' AS exige_responsavel,
       prosrc ILIKE '%YARD_AUDITOR_TRANSITION_NOT_ALLOWED%'   AS recusa_por_padrao,
       prosrc ILIKE '%starts_with(NEW.conclusion_evidence_url%' AS trava_caminho_evidencia,
       prosecdef                                               AS security_definer
  FROM pg_proc
 WHERE proname = 'fn_enforce_yard_auditor_action_plan_update'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: t · t · t · t · f  (o gatilho é SECURITY INVOKER de propósito)

-- 6) Função de nomes: SECURITY DEFINER, search_path fixo, grants corretos, autorização reimposta
SELECT prosecdef                                                     AS security_definer,
       proconfig::text                                               AS config,
       prosrc ILIKE '%ap.responsible_id = auth.uid()%'               AS filtra_responsavel,
       prosrc ILIKE '%get_my_client_id()%'                           AS filtra_tenant,
       prosrc ILIKE '%''Yard Auditor''%'                             AS filtra_papel,
       has_function_privilege('anon', 'public.get_yard_auditor_action_plan_labels(uuid[])', 'EXECUTE')          AS anon_executa,
       has_function_privilege('authenticated', 'public.get_yard_auditor_action_plan_labels(uuid[])', 'EXECUTE') AS authenticated_executa
  FROM pg_proc
 WHERE proname = 'get_yard_auditor_action_plan_labels'
   AND pronamespace = 'public'::regnamespace;
-- Esperado: t · {search_path=public} · t · t · t · f · t

-- 7) Informativo: planos hoje sob responsabilidade de Auditor
SELECT count(*) AS planos_com_auditor_responsavel
  FROM public.action_plans ap
  JOIN public.profiles p ON p.id = ap.responsible_id
 WHERE p.role = 'Yard Auditor';
-- Em 2026-09-14, antes da migration: 0 em DEV e 0 em PROD.
