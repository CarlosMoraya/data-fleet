-- ============================================================
-- MIGRATION: workshop_partnership
-- Descrição: Transforma oficinas em entidades independentes
--            multi-transportadora com modelo de parceria.
--            Uma oficina pode atender múltiplas transportadoras
--            com um único login.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ============================================================

-- ─── 1. workshop_accounts ──────────────────────────────────
-- Entidade independente da oficina, desacoplada de client_id.

CREATE TABLE IF NOT EXISTS public.workshop_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  cnpj                 TEXT NOT NULL UNIQUE,  -- CNPJ globalmente único
  phone                TEXT,
  email                TEXT,
  contact_person       TEXT,
  address_street       TEXT,
  address_number       TEXT,
  address_complement   TEXT,
  address_neighborhood TEXT,
  address_city         TEXT,
  address_state        TEXT,
  address_zip          TEXT,
  specialties          TEXT[],
  notes                TEXT,
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_accounts ENABLE ROW LEVEL SECURITY;

-- ─── 2. workshop_partnerships ──────────────────────────────
-- Relação M:N entre oficinas e transportadoras.
-- legacy_workshop_id: ponte com a tabela workshops existente
-- (necessária pois maintenance_orders.workshop_id → workshops.id).

CREATE TABLE IF NOT EXISTS public.workshop_partnerships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_account_id UUID NOT NULL REFERENCES public.workshop_accounts(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  legacy_workshop_id  UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at         TIMESTAMPTZ,
  deactivated_at      TIMESTAMPTZ,
  deactivated_by      UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_account_id, client_id)
);

ALTER TABLE public.workshop_partnerships ENABLE ROW LEVEL SECURITY;

-- ─── 3. workshop_invitations ──────────────────────────────
-- Convites gerados pelas transportadoras para oficinas.

CREATE TABLE IF NOT EXISTS public.workshop_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  accepted_by UUID REFERENCES public.workshop_accounts(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_invitations ENABLE ROW LEVEL SECURITY;

-- ─── 4. workshop_partnership_audit ─────────────────────────
-- Registro de auditoria de mudanças em partnerships.

CREATE TABLE IF NOT EXISTS public.workshop_partnership_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.workshop_partnerships(id),
  action         TEXT NOT NULL CHECK (action IN ('created', 'activated', 'deactivated', 'reactivated')),
  performed_by   UUID NOT NULL REFERENCES auth.users(id),
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_partnership_audit ENABLE ROW LEVEL SECURITY;

-- ─── 5. Adicionar workshop_account_id em profiles ──────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workshop_account_id UUID REFERENCES public.workshop_accounts(id) ON DELETE SET NULL;

-- ─── 6. Índices ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wp_account  ON public.workshop_partnerships(workshop_account_id);
CREATE INDEX IF NOT EXISTS idx_wp_client   ON public.workshop_partnerships(client_id);
CREATE INDEX IF NOT EXISTS idx_wp_legacy   ON public.workshop_partnerships(legacy_workshop_id);
CREATE INDEX IF NOT EXISTS idx_wp_status   ON public.workshop_partnerships(status);
CREATE INDEX IF NOT EXISTS idx_wi_token    ON public.workshop_invitations(token);
CREATE INDEX IF NOT EXISTS idx_wa_cnpj     ON public.workshop_accounts(cnpj);
CREATE INDEX IF NOT EXISTS idx_wa_profile  ON public.workshop_accounts(profile_id);

-- ─── 7. RPC validate_workshop_token (pública, SECURITY DEFINER) ──
-- Valida token de convite e retorna dados da transportadora
-- para exibição na landing page (sem necessidade de autenticação).

CREATE OR REPLACE FUNCTION public.validate_workshop_token(p_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_invitation RECORD;
  v_client     RECORD;
BEGIN
  SELECT wi.id, wi.status, wi.expires_at, wi.client_id
  INTO v_invitation
  FROM public.workshop_invitations wi
  WHERE wi.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'reason', 'Token não encontrado');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN json_build_object('valid', false, 'reason', 'Convite já utilizado ou revogado');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE public.workshop_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN json_build_object('valid', false, 'reason', 'Convite expirado');
  END IF;

  SELECT c.id, c.name, c.logo_url INTO v_client
  FROM public.clients c WHERE c.id = v_invitation.client_id;

  RETURN json_build_object(
    'valid',        true,
    'invitationId', v_invitation.id,
    'clientId',     v_client.id,
    'clientName',   v_client.name,
    'clientLogoUrl', v_client.logo_url
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 8. RLS: workshop_accounts ─────────────────────────────

-- Workshop vê sua própria conta
CREATE POLICY "wa_self_select" ON public.workshop_accounts
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Fleet Assistant+ vê contas de oficinas com parceria ativa no seu cliente
CREATE POLICY "wa_client_select" ON public.workshop_accounts
  FOR SELECT TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    AND id IN (
      SELECT workshop_account_id FROM public.workshop_partnerships
      WHERE client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
        AND status = 'active'
    )
  );

-- Admin Master vê tudo
CREATE POLICY "wa_admin_select" ON public.workshop_accounts
  FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master');

-- Workshop pode atualizar sua própria conta
CREATE POLICY "wa_self_update" ON public.workshop_accounts
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ─── 9. RLS: workshop_partnerships ────────────────────────

-- Workshop vê suas partnerships
-- Usa profiles.workshop_account_id diretamente para evitar cross-reference
-- com workshop_accounts (que causaria recursão infinita via wa_client_select)
CREATE POLICY "wpart_workshop_select" ON public.workshop_partnerships
  FOR SELECT TO authenticated
  USING (
    workshop_account_id = (
      SELECT workshop_account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Fleet Assistant+ vê partnerships do seu cliente
CREATE POLICY "wpart_client_select" ON public.workshop_partnerships
  FOR SELECT TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- Admin Master vê tudo
CREATE POLICY "wpart_admin_select" ON public.workshop_partnerships
  FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master');

-- ─── 10. RLS: workshop_invitations ────────────────────────

-- Fleet Assistant+ vê convites do seu cliente
CREATE POLICY "winv_client_select" ON public.workshop_invitations
  FOR SELECT TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- Fleet Assistant+ cria convites para seu cliente
CREATE POLICY "winv_client_insert" ON public.workshop_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  );

-- Fleet Assistant+ revoga convites do seu cliente
CREATE POLICY "winv_client_update" ON public.workshop_invitations
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
  );

-- Admin Master vê e gerencia tudo
CREATE POLICY "winv_admin_select" ON public.workshop_invitations
  FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master');

-- ─── 11. RLS: workshop_partnership_audit ──────────────────

-- Admin Master vê tudo
CREATE POLICY "audit_admin_select" ON public.workshop_partnership_audit
  FOR SELECT TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master');

-- Fleet Assistant+ vê audits de partnerships do seu cliente
CREATE POLICY "audit_client_select" ON public.workshop_partnership_audit
  FOR SELECT TO authenticated
  USING (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    AND partnership_id IN (
      SELECT id FROM public.workshop_partnerships
      WHERE client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ─── 12. Atualizar RLS de maintenance_orders para Workshop multi-parceria ──
-- Adiciona suporte ao novo modelo de partnerships além do modelo legado.

DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_orders;
DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_orders;

CREATE POLICY "maintenance_select" ON public.maintenance_orders
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND workshop_id IN (
        -- Modelo legado: workshop diretamente vinculada ao profile
        SELECT id FROM public.workshops WHERE profile_id = auth.uid()
        UNION
        -- Novo modelo: workshop via partnership
        SELECT wp.legacy_workshop_id
        FROM public.workshop_partnerships wp
        JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
        WHERE wa.profile_id = auth.uid()
          AND wp.status = 'active'
          AND wp.legacy_workshop_id IS NOT NULL
      )
    )
  );

CREATE POLICY "maintenance_update" ON public.maintenance_orders
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND workshop_id IN (
        SELECT id FROM public.workshops WHERE profile_id = auth.uid()
        UNION
        SELECT wp.legacy_workshop_id
        FROM public.workshop_partnerships wp
        JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
        WHERE wa.profile_id = auth.uid()
          AND wp.status = 'active'
          AND wp.legacy_workshop_id IS NOT NULL
      )
    )
  )
  WITH CHECK (
    (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
  );

-- ─── 13. Atualizar RLS de maintenance_budget_items ─────────

DROP POLICY IF EXISTS "budget_items_select" ON public.maintenance_budget_items;
DROP POLICY IF EXISTS "budget_items_insert" ON public.maintenance_budget_items;
DROP POLICY IF EXISTS "budget_items_update" ON public.maintenance_budget_items;
DROP POLICY IF EXISTS "budget_items_delete" ON public.maintenance_budget_items;

CREATE POLICY "budget_items_select" ON public.maintenance_budget_items
  FOR SELECT TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid()
            AND wp.status = 'active'
            AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
  );

CREATE POLICY "budget_items_insert" ON public.maintenance_budget_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid()
            AND wp.status = 'active'
            AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
  );

CREATE POLICY "budget_items_update" ON public.maintenance_budget_items
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid()
            AND wp.status = 'active'
            AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
  );

CREATE POLICY "budget_items_delete" ON public.maintenance_budget_items
  FOR DELETE TO authenticated
  USING (
    (
      (SELECT public.role_rank(role) FROM public.profiles WHERE id = auth.uid()) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.workshop_id IN (
          SELECT id FROM public.workshops WHERE profile_id = auth.uid()
          UNION
          SELECT wp.legacy_workshop_id
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid()
            AND wp.status = 'active'
            AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
  );

-- ─── 14. Migração de dados existentes ─────────────────────────────────────────
-- Converte oficinas legadas com login para o novo modelo de partnership.

-- 14.1 Criar workshop_accounts a partir de workshops com profile_id
-- DISTINCT ON garante uma conta por profile_id (caso improvável de duplicatas)
INSERT INTO public.workshop_accounts (
  profile_id, name, cnpj, phone, email, contact_person,
  address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, address_zip,
  specialties, notes, active, created_at, updated_at
)
SELECT DISTINCT ON (w.profile_id)
  w.profile_id, w.name, w.cnpj, w.phone, w.email, w.contact_person,
  w.address_street, w.address_number, w.address_complement,
  w.address_neighborhood, w.address_city, w.address_state, w.address_zip,
  w.specialties, w.notes, w.active, w.created_at, now()
FROM public.workshops w
WHERE w.profile_id IS NOT NULL
ORDER BY w.profile_id, w.created_at
ON CONFLICT (cnpj) DO NOTHING;

-- 14.2 Criar partnerships a partir das workshops existentes
INSERT INTO public.workshop_partnerships (
  workshop_account_id, client_id, legacy_workshop_id, status, accepted_at, invited_at
)
SELECT wa.id, w.client_id, w.id, 'active', w.created_at, w.created_at
FROM public.workshops w
JOIN public.workshop_accounts wa ON wa.profile_id = w.profile_id
ON CONFLICT (workshop_account_id, client_id) DO NOTHING;

-- 14.3 Atualizar profiles para apontar para workshop_account
UPDATE public.profiles p
SET workshop_account_id = wa.id
FROM public.workshop_accounts wa
WHERE wa.profile_id = p.id;
