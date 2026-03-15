-- ============================================================
-- Migration: Corrigir RLS para fluxo de Checklists do Motorista
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================
--
-- Problema: Drivers não conseguiam ver veículo nem templates
-- porque as policies existentes só permitiam Fleet Assistant+.
-- Esta migration adiciona policies para que Driver/Yard Auditor
-- consigam acessar os dados necessários para preencher checklists.
--

-- 1. Driver pode ler o próprio registro em drivers (via profile_id)
CREATE POLICY IF NOT EXISTS "drivers_select_own" ON public.drivers
  FOR SELECT USING (
    profile_id = auth.uid()
  );

-- 2. Driver pode ler o veículo associado a ele (via driver_id)
CREATE POLICY IF NOT EXISTS "vehicles_select_own_driver" ON public.vehicles
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE profile_id = auth.uid()
    )
  );

-- 3. Driver e Yard Auditor podem ler templates publicados do próprio client
CREATE POLICY IF NOT EXISTS "templates_select_driver" ON public.checklist_templates
  FOR SELECT USING (
    status = 'published'
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Driver', 'Yard Auditor')
  );

-- 4. Driver visualiza os próprios checklists
CREATE POLICY IF NOT EXISTS "checklists_select_own_driver" ON public.checklists
  FOR SELECT USING (filled_by = auth.uid());

-- 5. Driver cria checklist no próprio client
CREATE POLICY IF NOT EXISTS "checklists_insert_driver" ON public.checklists
  FOR INSERT WITH CHECK (
    filled_by = auth.uid()
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Driver', 'Yard Auditor')
  );

-- 6. Driver atualiza o próprio checklist (ex: status in_progress → completed)
--    WITH CHECK explícito para permitir mudança de status
CREATE POLICY IF NOT EXISTS "checklists_update_own_driver" ON public.checklists
  FOR UPDATE USING (
    filled_by = auth.uid() AND status = 'in_progress'
  ) WITH CHECK (
    filled_by = auth.uid()
  );

-- 7. Driver insere respostas para os próprios checklists
CREATE POLICY IF NOT EXISTS "responses_insert_driver" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    checklist_id IN (SELECT id FROM public.checklists WHERE filled_by = auth.uid())
  );

-- 8. Driver visualiza as próprias respostas
CREATE POLICY IF NOT EXISTS "responses_select_driver" ON public.checklist_responses
  FOR SELECT USING (
    checklist_id IN (SELECT id FROM public.checklists WHERE filled_by = auth.uid())
  );

-- 9. Driver atualiza as próprias respostas
CREATE POLICY IF NOT EXISTS "responses_update_driver" ON public.checklist_responses
  FOR UPDATE USING (
    checklist_id IN (SELECT id FROM public.checklists WHERE filled_by = auth.uid())
  );
