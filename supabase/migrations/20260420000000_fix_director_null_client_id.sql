-- ============================================================
-- MIGRATION: fix_director_null_client_id
-- Descrição: Corrige perfis de Diretor criados com client_id = NULL
--            devido ao bug no frontend Users.tsx que não enviava
--            client_id ao Edge Function create-user.
--
-- Como usar:
-- 1. Execute a query abaixo para encontrar o UUID do cliente Deluna:
--    SELECT id, name FROM public.clients WHERE name ILIKE '%deluna%';
--
-- 2. Substitua '<DELUNA_CLIENT_UUID>' pelo UUID real e execute:
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- Passo 1: identificar clientes (para obter o UUID do Deluna)
-- SELECT id, name FROM public.clients WHERE name ILIKE '%deluna%';

-- Passo 2: corrigir o(s) perfil(is) de Diretor com client_id nulo
-- Substitua '<DELUNA_CLIENT_UUID>' pelo UUID real encontrado no passo 1.
UPDATE public.profiles
SET client_id = '<DELUNA_CLIENT_UUID>'
WHERE role = 'Director'
  AND client_id IS NULL;
