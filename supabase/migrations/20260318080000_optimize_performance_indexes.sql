-- ============================================================
-- MIGRATION: optimize_performance_indexes
-- Data: 2026-03-18
-- Descrição: Adiciona índices estratégicos para melhorar a 
--            performance de subqueries em RLS e filtros 
--            multi-tenant frequentes.
-- ============================================================

-- 1. Otimização de Perfis (Profiles)
-- Frequentemente usado em subqueries de RLS para checar client_id e role do usuário logado.
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. Otimização de Veículos (Vehicles)
-- Melhora significativamente a velocidade de carregamento da listagem de veículos por cliente.
CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON public.vehicles(client_id);

-- 3. Otimização de Respostas de Checklist
-- Útil para dashboards e relatórios de conformidade.
CREATE INDEX IF NOT EXISTS idx_checklist_responses_status ON public.checklist_responses(status);

-- 4. Otimização de Manutenção (Se a tabela existir)
-- Nota: Checando se existe antes de criar (baseado em referências do código)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'maintenance_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_maintenance_logs_client_id ON public.maintenance_logs(client_id);
    END IF;
END $$;
