-- ============================================================
-- MIGRATION: add_financeiro_role
-- Data: 2026-07-08
-- Descrição: Registra o cargo "Financeiro" no banco.
--            Rank 1 (fora da escada de hierarquia operacional);
--            o acesso à tela financeira é sempre por cláusula explícita
--            role = 'Financeiro', nunca por role_rank >= N.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- (a) Constraint de papéis do profiles: 12 papéis atuais + 'Financeiro'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'Coupling Agent',
    'Driver',
    'Yard Auditor',
    'Workshop',
    'Fleet Assistant',
    'Fleet Analyst',
    'Supervisor',
    'Operations Manager',
    'Coordinator',
    'Manager',
    'Director',
    'Admin Master',
    'Financeiro'
  ));

-- (b) Fonte única de rank: role_ranks (colunas confirmadas: role, rank).
--     Apenas insere a linha; NÃO reescreve a função role_rank().
INSERT INTO public.role_ranks (role, rank) VALUES
  ('Financeiro', 1)
ON CONFLICT (role) DO UPDATE SET rank = EXCLUDED.rank;

NOTIFY pgrst, 'reload schema';
