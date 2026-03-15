-- ============================================================
-- Migration: Módulo de Checklists + Plano de Ação
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. checklist_item_suggestions (sugestões globais, sem client_id) ────────

CREATE TABLE IF NOT EXISTS public.checklist_item_suggestions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_category       TEXT NOT NULL CHECK (vehicle_category IN ('Leve','Médio','Pesado','Elétrico')),
  title                  TEXT NOT NULL,
  description            TEXT,
  is_mandatory           BOOLEAN NOT NULL DEFAULT false,
  require_photo_if_issue BOOLEAN NOT NULL DEFAULT false,
  default_action         TEXT,
  order_number           INT NOT NULL DEFAULT 0
);

-- RLS: SELECT para qualquer autenticado (leitura pública das sugestões)
ALTER TABLE public.checklist_item_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suggestions_select" ON public.checklist_item_suggestions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── 2. checklist_templates (templates por cliente) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_category      TEXT CHECK (vehicle_category IN ('Leve','Médio','Pesado','Elétrico')),
  is_free_form          BOOLEAN NOT NULL DEFAULT false,
  name                  TEXT NOT NULL,
  description           TEXT,
  current_version       INT NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','deprecated')),
  allow_driver_actions  BOOLEAN NOT NULL DEFAULT true,
  allow_auditor_actions BOOLEAN NOT NULL DEFAULT false,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Apenas 1 template published por (client, category) para categorias de veículo
  CONSTRAINT unique_published_category
    EXCLUDE USING btree (client_id WITH =, vehicle_category WITH =)
    WHERE (status = 'published' AND vehicle_category IS NOT NULL AND is_free_form = false),

  -- Integridade: Livre não tem categoria, e vice-versa
  CONSTRAINT check_free_form_or_category
    CHECK (
      (is_free_form = true AND vehicle_category IS NULL)
      OR (is_free_form = false AND vehicle_category IS NOT NULL)
    )
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant (rank 3)+ do mesmo tenant, ou Admin Master
CREATE POLICY "templates_select" ON public.checklist_templates
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Manager (rank 5)+ do mesmo tenant, ou Admin Master
CREATE POLICY "templates_insert" ON public.checklist_templates
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Fleet Analyst (rank 4)+ pode editar draft; Manager+ pode publicar
CREATE POLICY "templates_update" ON public.checklist_templates
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- DELETE: Manager+ pode excluir apenas drafts (validado na aplicação)
CREATE POLICY "templates_delete" ON public.checklist_templates
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklist_templates.client_id AND role IN ('Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- ─── 3. checklist_template_versions (snapshots imutáveis) ────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_template_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (template_id, version_number)
);

ALTER TABLE public.checklist_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_versions_select" ON public.checklist_template_versions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_template_versions.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

CREATE POLICY "template_versions_insert" ON public.checklist_template_versions
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_template_versions.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- ─── 4. checklist_items (itens por template/versão) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id            UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  version_number         INT NOT NULL DEFAULT 1,
  title                  TEXT NOT NULL,
  description            TEXT,
  is_mandatory           BOOLEAN NOT NULL DEFAULT false,
  require_photo_if_issue BOOLEAN NOT NULL DEFAULT false,
  default_action         TEXT,
  order_number           INT NOT NULL DEFAULT 0
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select" ON public.checklist_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

CREATE POLICY "checklist_items_insert" ON public.checklist_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

CREATE POLICY "checklist_items_update" ON public.checklist_items
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

CREATE POLICY "checklist_items_delete" ON public.checklist_items
  FOR DELETE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklist_templates t ON t.id = checklist_items.template_id
      WHERE (
        (p.client_id = t.client_id AND p.role IN ('Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

-- ─── 5. checklists (instâncias preenchidas) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklists (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id    UUID NOT NULL REFERENCES public.checklist_templates(id),
  version_number INT NOT NULL,
  vehicle_id     UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  filled_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  device_info    TEXT,
  notes          TEXT
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- SELECT: Driver/Auditor vê os próprios; Fleet Assistant+ vê todos do tenant
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (id = checklists.filled_by AND role IN ('Driver','Yard Auditor'))
        OR (client_id = checklists.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Qualquer usuário autenticado do tenant
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = checklists.client_id AND role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Apenas quem criou, enquanto in_progress
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    auth.uid() = checklists.filled_by
    AND checklists.status = 'in_progress'
  );

-- DELETE: APENAS Admin Master
CREATE POLICY "checklists_delete" ON public.checklists
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'Admin Master'
    )
  );

-- ─── 6. checklist_responses (respostas por item) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES public.checklist_items(id),
  status       TEXT NOT NULL CHECK (status IN ('ok','issue','skipped','not_applicable')),
  observation  TEXT,
  photo_url    TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, item_id)
);

ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responses_select" ON public.checklist_responses
  FOR SELECT USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE (
        (p.id = c.filled_by AND p.role IN ('Driver','Yard Auditor'))
        OR (p.client_id = c.client_id AND p.role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE (
        (p.client_id = c.client_id AND p.role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR p.role = 'Admin Master'
      )
    )
  );

CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT p.id FROM public.profiles p
      JOIN public.checklists c ON c.id = checklist_responses.checklist_id
      WHERE p.id = c.filled_by AND c.status = 'in_progress'
    )
  );

-- ─── 7. action_plans (plano de ação) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.action_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checklist_id          UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  checklist_response_id UUID REFERENCES public.checklist_responses(id) ON DELETE SET NULL,
  vehicle_id            UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  reported_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  suggested_action      TEXT NOT NULL,
  observed_issue        TEXT,
  photo_url             TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  work_order_number     TEXT,
  completion_notes      TEXT,
  completed_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at          TIMESTAMPTZ,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: Fleet Assistant+ do tenant, ou Admin Master
CREATE POLICY "action_plans_select" ON public.action_plans
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = action_plans.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- INSERT: Qualquer role do tenant (validação de permissão via aplicação)
CREATE POLICY "action_plans_insert" ON public.action_plans
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = action_plans.client_id AND role IN ('Driver','Yard Auditor','Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- UPDATE: Fleet Assistant+ do tenant
CREATE POLICY "action_plans_update" ON public.action_plans
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE (
        (client_id = action_plans.client_id AND role IN ('Fleet Assistant','Fleet Analyst','Manager','Director'))
        OR role = 'Admin Master'
      )
    )
  );

-- DELETE: APENAS Admin Master
CREATE POLICY "action_plans_delete" ON public.action_plans
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'Admin Master'
    )
  );

-- ─── 8. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_checklists_client    ON public.checklists(client_id);
CREATE INDEX IF NOT EXISTS idx_checklists_vehicle   ON public.checklists(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_checklists_filled_by ON public.checklists(filled_by);
CREATE INDEX IF NOT EXISTS idx_checklists_status    ON public.checklists(client_id, status);

CREATE INDEX IF NOT EXISTS idx_action_plans_client_status ON public.action_plans(client_id, status);
CREATE INDEX IF NOT EXISTS idx_action_plans_vehicle       ON public.action_plans(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_checklist     ON public.action_plans(checklist_id);

CREATE INDEX IF NOT EXISTS idx_checklist_items_template ON public.checklist_items(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_templates_client         ON public.checklist_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_templates_client_status  ON public.checklist_templates(client_id, status);

CREATE INDEX IF NOT EXISTS idx_responses_checklist ON public.checklist_responses(checklist_id);

-- ─── 9. Seed: checklist_item_suggestions ─────────────────────────────────────

INSERT INTO public.checklist_item_suggestions (vehicle_category, title, description, is_mandatory, require_photo_if_issue, default_action, order_number)
VALUES
  -- ── Leve ──────────────────────────────────────────────────────────────────
  ('Leve', 'Extintor de incêndio', 'Verificar validade, lacre e carga do extintor', true,  true,  'Encaminhar para recarga/substituição imediata', 1),
  ('Leve', 'Triângulo de sinalização', 'Verificar presença e boas condições do triângulo', true,  false, 'Providenciar substituição do triângulo', 2),
  ('Leve', 'Pneus (calibragem e desgaste)', 'Verificar pressão, desgaste e condição geral dos pneus incluindo estepe', true,  true,  'Calibrar ou substituir pneus conforme necessidade', 3),
  ('Leve', 'Sistema de freios', 'Testar eficiência dos freios dianteiros e traseiros', true,  true,  'Encaminhar para revisão do sistema de freios', 4),
  ('Leve', 'Documentos do veículo', 'Verificar CRLV, CNH do motorista e documentos exigidos', true,  false, 'Regularizar documentação pendente', 5),
  ('Leve', 'Nível de óleo do motor', 'Verificar nível e qualidade do óleo do motor', false, false, 'Completar ou trocar óleo conforme necessidade', 6),
  ('Leve', 'Luzes (faróis, lanternas, pisca)', 'Verificar funcionamento de todos os faróis e sinaleiros', false, true,  'Substituir lâmpadas defeituosas', 7),
  ('Leve', 'Limpadores de para-brisa', 'Verificar funcionamento e estado das palhetas', false, false, 'Substituir palhetas desgastadas', 8),
  ('Leve', 'Cintos de segurança', 'Verificar funcionamento e integridade de todos os cintos', false, true,  'Substituir cintos com defeito', 9),
  ('Leve', 'Espelhos retrovisores', 'Verificar posicionamento e integridade dos espelhos', false, false, 'Ajustar ou substituir espelhos', 10),
  ('Leve', 'Buzina', 'Testar funcionamento da buzina', false, false, 'Verificar circuito elétrico da buzina', 11),
  ('Leve', 'Painel de instrumentos', 'Verificar indicadores de combustível, temperatura e alertas', false, true,  'Diagnosticar alertas ativos no painel', 12),
  ('Leve', 'Líquido de arrefecimento', 'Verificar nível do radiador e reservatório', false, false, 'Completar líquido de arrefecimento', 13),
  ('Leve', 'Limpeza interna e externa', 'Verificar condições de limpeza do veículo', false, false, 'Providenciar higienização do veículo', 14),

  -- ── Médio ─────────────────────────────────────────────────────────────────
  ('Médio', 'Extintor de incêndio', 'Verificar validade, lacre e carga do extintor', true,  true,  'Encaminhar para recarga/substituição imediata', 1),
  ('Médio', 'Triângulo de sinalização', 'Verificar presença e boas condições do triângulo', true,  false, 'Providenciar substituição do triângulo', 2),
  ('Médio', 'Pneus (calibragem e desgaste)', 'Verificar pressão, desgaste e condição geral de todos os pneus incluindo estepe', true,  true,  'Calibrar ou substituir pneus conforme necessidade', 3),
  ('Médio', 'Sistema de freios', 'Testar eficiência dos freios e verificar nível do fluido', true,  true,  'Encaminhar para revisão do sistema de freios', 4),
  ('Médio', 'Documentos do veículo', 'Verificar CRLV, ANTT, CNH do motorista e documentos exigidos', true,  false, 'Regularizar documentação pendente', 5),
  ('Médio', 'Nível de óleo do motor', 'Verificar nível e qualidade do óleo do motor', false, false, 'Completar ou trocar óleo conforme necessidade', 6),
  ('Médio', 'Luzes (faróis, lanternas, pisca)', 'Verificar funcionamento de todos os faróis, sinaleiros e luz de ré', false, true,  'Substituir lâmpadas defeituosas', 7),
  ('Médio', 'Limpadores de para-brisa', 'Verificar funcionamento e estado das palhetas', false, false, 'Substituir palhetas desgastadas', 8),
  ('Médio', 'Cintos de segurança', 'Verificar funcionamento e integridade de todos os cintos', false, true,  'Substituir cintos com defeito', 9),
  ('Médio', 'Espelhos retrovisores', 'Verificar posicionamento e integridade de todos os espelhos', false, false, 'Ajustar ou substituir espelhos', 10),
  ('Médio', 'Buzina', 'Testar funcionamento da buzina', false, false, 'Verificar circuito elétrico da buzina', 11),
  ('Médio', 'Painel de instrumentos', 'Verificar indicadores e alertas ativos', false, true,  'Diagnosticar alertas ativos no painel', 12),
  ('Médio', 'Líquido de arrefecimento', 'Verificar nível do radiador e reservatório', false, false, 'Completar líquido de arrefecimento', 13),
  ('Médio', 'Carroceria e amarração de carga', 'Verificar integridade da carroceria e sistema de amarração', false, true,  'Reparar danos na carroceria ou substituir cintas', 14),

  -- ── Pesado ────────────────────────────────────────────────────────────────
  ('Pesado', 'Extintor de incêndio', 'Verificar validade, lacre e carga — mínimo 2 extintores', true,  true,  'Encaminhar para recarga/substituição imediata', 1),
  ('Pesado', 'Triângulo de sinalização', 'Verificar presença e boas condições do triângulo', true,  false, 'Providenciar substituição do triângulo', 2),
  ('Pesado', 'Pneus (calibragem e desgaste)', 'Verificar pressão e desgaste de todos os pneus incluindo estepe duplo', true,  true,  'Calibrar ou substituir pneus conforme necessidade', 3),
  ('Pesado', 'Sistema de freios e pneumático', 'Testar freios de serviço, motor e de estacionamento. Verificar pressão do sistema de ar', true,  true,  'Encaminhar para revisão urgente do sistema de freios', 4),
  ('Pesado', 'Tacógrafo', 'Verificar funcionamento e disco do tacógrafo (obrigatório por lei)', true,  true,  'Encaminhar para calibração ou substituição do tacógrafo', 5),
  ('Pesado', 'Documentos do veículo', 'Verificar CRLV, ANTT, CNH (E), MOPP se carga perigosa, e demais documentos', true,  false, 'Regularizar documentação pendente', 6),
  ('Pesado', 'Nível de óleo do motor', 'Verificar nível e qualidade do óleo do motor', false, false, 'Completar ou trocar óleo conforme necessidade', 7),
  ('Pesado', 'Luzes e sinalização', 'Verificar todos os faróis, sinaleiros, luz de ré e luz de freio', false, true,  'Substituir lâmpadas defeituosas', 8),
  ('Pesado', 'Engate e 5a roda', 'Verificar estado e travamento do engate do semirreboque', false, true,  'Verificar e lubrificar sistema de engate', 9),
  ('Pesado', 'Lonas e tela de cobertura', 'Verificar integridade das lonas e sistema de fechamento', false, true,  'Reparar ou substituir lonas danificadas', 10),
  ('Pesado', 'Amarração e cantoneiras', 'Verificar cintas de amarração, ratchets e cantoneiras de proteção', false, true,  'Substituir cintas ou cantoneiras danificadas', 11),
  ('Pesado', 'Painel e instrumentos', 'Verificar indicadores, alarmes e computador de bordo', false, true,  'Diagnosticar alertas ativos', 12),
  ('Pesado', 'Liquido de arrefecimento e nível de uréia (AdBlue)', 'Verificar nível do radiador e reservatório de Arla/AdBlue', false, false, 'Completar fluidos conforme necessidade', 13),

  -- ── Elétrico ──────────────────────────────────────────────────────────────
  ('Elétrico', 'Nível de carga da bateria', 'Verificar percentual de carga e autonomia estimada para a rota', true,  true,  'Recarregar o veículo antes de prosseguir', 1),
  ('Elétrico', 'Extintor de incêndio', 'Verificar validade, lacre e carga do extintor (tipo D para veículos elétricos)', true,  true,  'Encaminhar para recarga/substituição imediata', 2),
  ('Elétrico', 'Triângulo de sinalização', 'Verificar presença e boas condições do triângulo', true,  false, 'Providenciar substituição do triângulo', 3),
  ('Elétrico', 'Pneus (calibragem e desgaste)', 'Verificar pressão e desgaste — veículos elétricos pesam mais', true,  true,  'Calibrar ou substituir pneus conforme necessidade', 4),
  ('Elétrico', 'Sistema de freios (regenerativo)', 'Testar freios de serviço e verificar sistema de freio regenerativo', true,  true,  'Encaminhar para revisão do sistema de freios', 5),
  ('Elétrico', 'Documentos do veículo', 'Verificar CRLV, CNH do motorista e documentos exigidos', true,  false, 'Regularizar documentação pendente', 6),
  ('Elétrico', 'Cabo de carregamento', 'Verificar integridade do cabo, plugue e trava do conector', false, true,  'Substituir cabo danificado. Não utilizar cabo com defeito.', 7),
  ('Elétrico', 'Luzes e sinalização', 'Verificar todos os faróis e sinaleiros', false, true,  'Substituir lâmpadas/LEDs defeituosos', 8),
  ('Elétrico', 'Recuperação de energia (regen)', 'Verificar funcionamento da frenagem regenerativa pelo painel', false, false, 'Verificar configurações ou encaminhar para diagnóstico', 9),
  ('Elétrico', 'Painel e alertas do BMS', 'Verificar alertas do sistema de gerenciamento de bateria (BMS)', false, true,  'Encaminhar imediatamente para diagnóstico se houver alertas', 10),
  ('Elétrico', 'Climatização e conforto', 'Verificar ar condicionado/aquecimento (impacta na autonomia)', false, false, 'Verificar sistema de climatização', 11),
  ('Elétrico', 'Cintos de segurança', 'Verificar funcionamento e integridade de todos os cintos', false, true,  'Substituir cintos com defeito', 12);
