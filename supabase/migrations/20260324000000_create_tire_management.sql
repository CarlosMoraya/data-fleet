-- ============================================================
-- MIGRATION: create_tire_management
-- Descrição: Módulo completo de Gestão de Pneus (βetaFleet)
--   - tires: cadastro principal de pneus
--   - tire_position_history: log append-only de movimentações
--   - vehicle_tire_configs: template de eixos por tipo de veículo
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- ─── 1. Tabela tires ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tires (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id              UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id             UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  tire_code              TEXT NOT NULL,
  specification          TEXT NOT NULL,
  dot                    TEXT,
  fire_marking           TEXT,  
  manufacturer           TEXT,
  brand                  TEXT,
  rotation_interval_km   INTEGER,
  useful_life_km         INTEGER,
  retread_interval_km    INTEGER,
  visual_classification  TEXT NOT NULL DEFAULT 'Novo'
    CHECK (visual_classification IN ('Novo', 'Meia vida', 'Troca')),
  current_position       TEXT NOT NULL,
  last_position          TEXT,
  position_type          TEXT NOT NULL DEFAULT 'single'
    CHECK (position_type IN ('single', 'dual_external', 'dual_internal', 'spare')),
  active                 BOOLEAN NOT NULL DEFAULT true,
  created_by             UUID REFERENCES public.profiles(id),
  updated_by             UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT tires_code_unique UNIQUE(client_id, tire_code)
);

-- Garante um pneu ativo por posição por veículo
CREATE UNIQUE INDEX IF NOT EXISTS idx_tires_active_position
  ON public.tires(vehicle_id, current_position) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_tires_client ON public.tires(client_id);
CREATE INDEX IF NOT EXISTS idx_tires_vehicle ON public.tires(vehicle_id);

-- ─── 2. Tabela tire_position_history ──────────────────────────

CREATE TABLE IF NOT EXISTS public.tire_position_history (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tire_id           UUID NOT NULL REFERENCES public.tires(id) ON DELETE CASCADE,
  vehicle_id        UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  previous_position TEXT,
  new_position      TEXT NOT NULL,
  moved_at          TIMESTAMPTZ DEFAULT now(),
  moved_by          UUID NOT NULL REFERENCES public.profiles(id),
  reason            TEXT,
  odometer_km       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tph_tire ON public.tire_position_history(tire_id);
CREATE INDEX IF NOT EXISTS idx_tph_vehicle ON public.tire_position_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tph_moved_at ON public.tire_position_history(moved_at DESC);

-- ─── 3. Tabela vehicle_tire_configs ───────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicle_tire_configs (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_type        TEXT NOT NULL UNIQUE CHECK (vehicle_type IN (
    'Passeio','Utilitário','Van','Moto','Vuc','Toco','Truck','Cavalo'
  )),
  default_axles       INTEGER NOT NULL DEFAULT 2,
  default_spare_count INTEGER NOT NULL DEFAULT 1,
  dual_axles          JSONB NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO public.vehicle_tire_configs (vehicle_type, default_axles, default_spare_count, dual_axles)
VALUES
  ('Moto',        1, 0, '[]'),
  ('Passeio',     2, 1, '[]'),
  ('Utilitário',  2, 1, '[]'),
  ('Van',         2, 1, '[]'),
  ('Vuc',         2, 1, '[]'),
  ('Toco',        2, 1, '[2]'),
  ('Truck',       3, 1, '[2,3]'),
  ('Cavalo',      3, 2, '[2,3]')
ON CONFLICT (vehicle_type) DO NOTHING;

-- ─── 4. RLS ───────────────────────────────────────────────────

ALTER TABLE public.tires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_position_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_tire_configs ENABLE ROW LEVEL SECURITY;

-- ── tires: SELECT (Fleet Assistant+ do próprio tenant OU Admin Master) ──
CREATE POLICY "tires_select" ON public.tires
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- ── tires: INSERT (Manager, Coordinator, Director, Admin Master) ──
CREATE POLICY "tires_insert" ON public.tires
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Manager','Coordinator','Director','Admin Master')
    AND (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

-- ── tires: UPDATE (Manager, Coordinator, Director, Admin Master) ──
CREATE POLICY "tires_update" ON public.tires
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Manager','Coordinator','Director','Admin Master')
    AND (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

-- ── tires: DELETE (Director, Admin Master apenas) ──
CREATE POLICY "tires_delete" ON public.tires
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Director','Admin Master')
    AND (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

-- ── tire_position_history: SELECT ──
CREATE POLICY "tire_history_select" ON public.tire_position_history
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- ── tire_position_history: INSERT (Manager, Coordinator, Director, Admin Master) ──
CREATE POLICY "tire_history_insert" ON public.tire_position_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN
      ('Manager','Coordinator','Director','Admin Master')
    AND (
      client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );

-- ── vehicle_tire_configs: SELECT (qualquer autenticado) ──
CREATE POLICY "tire_configs_select" ON public.vehicle_tire_configs
  FOR SELECT TO authenticated
  USING (true);

-- ── vehicle_tire_configs: INSERT/UPDATE/DELETE (Admin Master apenas) ──
CREATE POLICY "tire_configs_insert" ON public.vehicle_tire_configs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "tire_configs_update" ON public.vehicle_tire_configs
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

CREATE POLICY "tire_configs_delete" ON public.vehicle_tire_configs
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
  );

-- ─── 5. Comentários ───────────────────────────────────────────

COMMENT ON TABLE public.tires IS 'Cadastro principal de pneus da frota. tire_code é imutável após criação.';
COMMENT ON TABLE public.tire_position_history IS 'Log append-only de movimentações de pneus entre posições.';
COMMENT ON TABLE public.vehicle_tire_configs IS 'Template de configuração de eixos por tipo de veículo.';
COMMENT ON COLUMN public.tires.tire_code IS 'Código único imutável do pneu (ex: PNE-001, ABC1234-E1).';
COMMENT ON COLUMN public.tires.current_position IS 'Posição atual: E1, D2I, D2E, Step 1, etc.';
COMMENT ON COLUMN public.vehicle_tire_configs.dual_axles IS 'Array JSON dos eixos com rodagem dupla (ex: [2,3]).';
