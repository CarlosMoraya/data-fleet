-- ============================================================
-- DIAGNÓSTICO: motivo obrigatório no cancelamento de OS
-- Migration: 20260919000000_maintenance_cancellation_reason
-- Roda em DEV e em PROD. Somente leitura.
-- Resultado esperado: as 5 seções com confere = t
--
-- ⚠️ Este diagnóstico verifica ESTRUTURA, não comportamento.
--    O escape hatch `auth.uid() IS NULL` faz toda escrita pelo SQL Editor
--    passar pelo gatilho sem validação. Comportamento só se valida com
--    sessão autenticada — ver IMPLEMENTATION.md, Etapa 6, passos 2 e 3.
-- ============================================================

-- 1. A coluna existe, é TEXT e é nullable
SELECT 'coluna' AS secao,
       column_name, data_type, is_nullable,
       (data_type = 'text' AND is_nullable = 'YES') AS confere
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'maintenance_orders'
  AND column_name = 'cancellation_reason';

-- 2. A função do gatilho existe e é SECURITY DEFINER com search_path fixo
SELECT 'funcao' AS secao,
       p.proname, p.prosecdef, p.proconfig,
       (p.prosecdef AND p.proconfig @> ARRAY['search_path=public']) AS confere
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fn_enforce_maintenance_cancellation_reason';

-- 3. O gatilho está ligado à tabela, BEFORE UPDATE, FOR EACH ROW
SELECT 'gatilho' AS secao,
       t.tgname,
       pg_get_triggerdef(t.oid) AS definicao,
       (pg_get_triggerdef(t.oid) ILIKE '%BEFORE UPDATE ON public.maintenance_orders%'
        AND pg_get_triggerdef(t.oid) ILIKE '%FOR EACH ROW%') AS confere
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'maintenance_orders'
  AND t.tgname = 'trg_enforce_maintenance_cancellation_reason';

-- 4. cancellation_reason está na lista protegida contra Workshop
SELECT 'protecao_workshop' AS secao,
       (p.prosrc ILIKE '%NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason%') AS confere
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'enforce_workshop_maintenance_columns';

-- 5. Nenhuma OS cancelada carrega motivo em branco
--
--    Invariante verdadeira nos dois ambientes e estável no tempo: o gatilho
--    nunca deixa passar string vazia. As contagens ficam visíveis para leitura
--    humana, mas NÃO entram no `confere` — elas mudam legitimamente conforme
--    novas OS são canceladas, e `com_autor` é menor que `canceladas` em DEV por
--    causa da fixture OS-2609-2003, cancelada por SQL de propósito (ver MEMORY.md).
--    `com_motivo` menor que `canceladas` é ESPERADO: é o legado sem backfill.
SELECT 'motivo_nunca_em_branco' AS secao,
       count(*) AS canceladas,
       count(cancellation_reason) AS com_motivo,
       count(cancelled_by_id) AS com_autor,
       count(*) FILTER (
         WHERE cancellation_reason IS NOT NULL AND btrim(cancellation_reason) = ''
       ) AS em_branco,
       (count(*) FILTER (
         WHERE cancellation_reason IS NOT NULL AND btrim(cancellation_reason) = ''
       ) = 0) AS confere
FROM public.maintenance_orders
WHERE status = 'Cancelado';
