-- Permite que Fleet Assistant+ leia todos os perfis do mesmo cliente
-- Necessário para exibir nomes em "Assumido por" e "Aprovado por" no módulo de Plano de Ação,
-- onde o responsável pode ter rank igual ou superior ao do visualizador.
-- A política anterior (tenant_managers_read_profiles) só permitia leitura de perfis
-- com rank MENOR que o do usuário, bloqueando a resolução de nomes em ação plans.

DROP POLICY IF EXISTS "fleet_assistant_read_same_client_profiles" ON public.profiles;

CREATE POLICY "fleet_assistant_read_same_client_profiles" ON public.profiles
  FOR SELECT
  USING (
    client_id = public.get_my_client_id()
    AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
  );
