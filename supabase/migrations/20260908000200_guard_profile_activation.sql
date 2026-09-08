-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
--
-- POR QUE UM GATILHO E NÃO UMA POLICY: RLS no Postgres é por linha, não por
-- coluna. A policy tenant_managers_update_profiles precisa continuar permitindo
-- que um gestor edite nome, papel e limite de aprovação de perfis abaixo do
-- dele; ela não consegue dizer "pode editar esta linha, mas não pode mexer no
-- campo active". O gatilho enxerga OLD e NEW e é o único ponto por onde toda
-- escrita passa, inclusive requisição forjada por DevTools ou curl.
--
-- POR QUE A REGRA ESTÁ SEPARADA DO GATILHO: a Edge Function precisa saber se a
-- operação é permitida ANTES de banir a conta no Auth, para não banir alguém e
-- descobrir só depois que a escrita seria recusada. Sem esta separação, a
-- regra teria de ser reescrita em TypeScript e as duas cópias divergiriam.


-- ─── 3.1 A regra, em um lugar só ──────────────────────────────────────────
-- Devolve NULL quando a operação é permitida, ou a mensagem de recusa em
-- português, pronta para exibição ao usuário final.

CREATE OR REPLACE FUNCTION public.fn_profile_activation_denial_reason(
  p_actor_id    UUID,
  p_target_id   UUID,
  p_next_active BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_rank    INT;
  v_target_role   TEXT;
  v_target_rank   INT;
  v_required_rank INT;
  v_remaining     INT;
BEGIN
  IF p_actor_id IS NULL THEN
    RETURN NULL;  -- escape hatch: ver 3.2
  END IF;

  -- INVARIANTE 1 — ninguém inativa nem reativa a si mesmo.
  IF p_target_id = p_actor_id THEN
    RETURN 'Você não pode alterar o seu próprio status de ativação.';
  END IF;

  SELECT public.role_rank(p.role) INTO v_actor_rank
  FROM public.profiles p WHERE p.id = p_actor_id;

  SELECT p.role, public.role_rank(p.role) INTO v_target_role, v_target_rank
  FROM public.profiles p WHERE p.id = p_target_id;

  IF v_target_role IS NULL THEN
    RETURN 'Usuário não encontrado.';
  END IF;

  -- INVARIANTE 2 — piso de papel.
  -- Perfis de papel 'Driver' são registros operacionais da frota e mantêm o
  -- piso histórico de Fleet Analyst, preservando a tela Cadastros → Motoristas,
  -- onde Fleet Analyst e Supervisor já inativam motorista hoje. Qualquer outro
  -- papel é conta administrativa e exige Coordinator.
  IF v_target_role = 'Driver' THEN
    v_required_rank := public.role_rank('Fleet Analyst');
  ELSE
    v_required_rank := public.role_rank('Coordinator');
  END IF;

  IF COALESCE(v_actor_rank, 0) < v_required_rank THEN
    RETURN 'Seu papel não tem permissão para inativar ou reativar este usuário.';
  END IF;

  -- INVARIANTE 3 — hierarquia: só perfis estritamente abaixo do seu.
  IF COALESCE(v_actor_rank, 0) <= v_target_rank THEN
    RETURN 'Você só pode inativar ou reativar usuários de papel inferior ao seu.';
  END IF;

  -- INVARIANTE 4 — piso de segurança: o sistema nunca fica sem Admin Master.
  IF v_target_role = 'Admin Master' AND p_next_active = false THEN
    SELECT count(*) INTO v_remaining
    FROM public.profiles p
    WHERE p.role = 'Admin Master' AND p.active = true AND p.id <> p_target_id;

    IF v_remaining = 0 THEN
      RETURN 'Não é possível inativar o último Admin Master ativo do sistema.';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;


-- Superficie de execucao: esta funcao aceita p_actor_id ARBITRARIO. Exposta via
-- PostgREST ela vira um oraculo — distingue 'Usuario nao encontrado.' de uma
-- mensagem de papel e revela se um UUID e um perfil, sem autenticacao. Nao ha
-- escalonamento de privilegio (toda escrita usa auth.uid()), mas nenhum cliente
-- precisa dela: os dois chamadores legitimos sao o gatilho (3.2) e o wrapper
-- (3.3), ambos SECURITY DEFINER, que executam com a identidade do dono.
-- Descoberto na validacao em DEV de 2026-09-08.

REVOKE ALL ON FUNCTION public.fn_profile_activation_denial_reason(UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;


-- ─── 3.2 O gatilho, que barra a escrita ───────────────────────────────────
-- Escape hatch deliberado: SQL Editor e service_role (auth.uid() IS NULL)
-- passam livres. É o único caminho de reparo de dados e não é alcançável pela
-- aplicação, que sempre atua com JWT de usuário. Segue o precedente já vigente
-- nos gatilhos de orçamento aprovado (docs/MEMORY.md).

CREATE OR REPLACE FUNCTION public.fn_guard_profile_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  v_reason := public.fn_profile_activation_denial_reason(auth.uid(), NEW.id, NEW.active);

  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_activation ON public.profiles;
CREATE TRIGGER trg_guard_profile_activation
  BEFORE UPDATE OF active ON public.profiles
  FOR EACH ROW
  WHEN (OLD.active IS DISTINCT FROM NEW.active)
  EXECUTE FUNCTION public.fn_guard_profile_activation();


-- ─── 3.3 A consulta, para a Edge Function perguntar antes de agir ─────────

CREATE OR REPLACE FUNCTION public.profile_activation_denial_reason(
  p_target_id   UUID,
  p_next_active BOOLEAN
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_profile_activation_denial_reason(auth.uid(), p_target_id, p_next_active);
$$;

REVOKE ALL ON FUNCTION public.profile_activation_denial_reason(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_activation_denial_reason(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
