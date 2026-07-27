-- ============================================================
-- MIGRATION: create_vehicle_loans
-- Data: 2026-07-26
-- Descrição: Registra o empréstimo temporário de veículos
--            (vehicle_loans) + notificações in-app
--            (vehicle_loan_notifications). Toda escrita passa por
--            RPCs SECURITY DEFINER (Etapa 2); nenhuma policy de
--            INSERT/UPDATE direto é criada para o cliente.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- Tabela: public.vehicle_loans
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_loans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES public.clients(id),
  vehicle_id            UUID NOT NULL REFERENCES public.vehicles(id),
  driver_id             UUID NOT NULL REFERENCES public.drivers(id),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ,
  delivery_checklist_id UUID REFERENCES public.checklists(id),
  return_checklist_id   UUID REFERENCES public.checklists(id),
  status                TEXT NOT NULL CHECK (status IN ('active','completed','cancelled')),
  notes                 TEXT NOT NULL CHECK (char_length(btrim(notes)) >= 10),
  ended_notes           TEXT,
  created_by            UUID NOT NULL REFERENCES public.profiles(id),
  ended_by              UUID REFERENCES public.profiles(id),
  ended_reason          TEXT CHECK (ended_reason IN ('return_checklist','driver_changed','cancelled','other')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_loans_vehicle ON public.vehicle_loans(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_loans_driver  ON public.vehicle_loans(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_loans_status  ON public.vehicle_loans(status);

-- Singleton guard: no máximo 1 empréstimo ativo por veículo no banco
-- (defesa contra corrida — a aplicação não consegue garantir sozinha).
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_loans_active_unique
  ON public.vehicle_loans(vehicle_id) WHERE status = 'active';

-- Trigger de updated_at (reutiliza a função genérica public.set_updated_at()).
DROP TRIGGER IF EXISTS vehicle_loans_updated_at ON public.vehicle_loans;
CREATE TRIGGER vehicle_loans_updated_at
  BEFORE UPDATE ON public.vehicle_loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vehicle_loans ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os papéis do tenant que já têm acesso a checklists veem
-- o histórico de empréstimos (Decisão 6) — cliente + Admin Master.
DROP POLICY IF EXISTS "vehicle_loans_select" ON public.vehicle_loans;
CREATE POLICY "vehicle_loans_select" ON public.vehicle_loans
  FOR SELECT USING (
    client_id = (SELECT p.client_id FROM public.profiles p WHERE p.id = auth.uid())
    OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'Admin Master'
  );

-- Nenhuma policy de INSERT/UPDATE direto: toda escrita é feita pelas
-- RPCs SECURITY DEFINER create_vehicle_loan / complete_vehicle_loan,
-- que centralizam a autorização (inclui o gate Yard Auditor).

-- ────────────────────────────────────────────────────────────────
-- Tabela: public.vehicle_loan_notifications
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_loan_notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES public.clients(id),
  loan_id              UUID NOT NULL REFERENCES public.vehicle_loans(id) ON DELETE CASCADE,
  recipient_driver_id UUID NOT NULL REFERENCES public.drivers(id),
  kind                 TEXT NOT NULL CHECK (kind IN ('loan_created','loan_ended_driver_changed')),
  payload              JSONB NOT NULL,
  read_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vln_recipient_unread
  ON public.vehicle_loan_notifications(recipient_driver_id) WHERE read_at IS NULL;

ALTER TABLE public.vehicle_loan_notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: motorista destinatário (via drivers.profile_id = auth.uid())
-- OU rank >= Fleet Assistant do mesmo tenant OU Admin Master.
DROP POLICY IF EXISTS "vehicle_loan_notifications_select" ON public.vehicle_loan_notifications;
CREATE POLICY "vehicle_loan_notifications_select" ON public.vehicle_loan_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = vehicle_loan_notifications.recipient_driver_id
        AND d.profile_id = auth.uid()
    )
    OR (
      vehicle_loan_notifications.client_id = (SELECT p.client_id FROM public.profiles p WHERE p.id = auth.uid())
      AND public.role_rank(public.get_my_role()) >= public.role_rank('Fleet Assistant')
    )
    OR public.is_admin_master()
  );

-- Nenhuma policy de UPDATE/INSERT direto: marcação de leitura e criação
-- passam pelas RPCs SECURITY DEFINER (mark_vehicle_loan_notification_read
-- / create_vehicle_loan) para garantir isolamento por perfil.

NOTIFY pgrst, 'reload schema';