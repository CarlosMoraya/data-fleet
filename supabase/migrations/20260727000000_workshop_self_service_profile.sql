-- ============================================================
-- MIGRATION: workshop_self_service_profile
-- Descrição: Permite que a oficina convidada complete o próprio
--            cadastro com segurança:
--            3.1 amplia o CHECK de auditoria com
--                'workshop_name_changed';
--            3.2 protege cnpj/active/profile_id contra
--                auto-edição (trigger BEFORE UPDATE);
--            3.3 propaga os dados cadastrais da conta global
--                (workshop_accounts) para os registros legados
--                (workshops) das transportadoras parceiras;
--            3.4 audita troca de nome em
--                workshop_partnership_audit (append-only).
--
--            NÃO cria tabela nova, NÃO altera policies existentes,
--            NÃO toca em maintenance_orders.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor
-- ⚠️ Aplicar SOMENTE no DEV (vvbnbzzhpiksacqudmfu).
--    Promoção a PROD exige autorização expressa do usuário.
-- ============================================================

-- ─── 3.1 Ampliar o CHECK da auditoria ────────────────────────

ALTER TABLE public.workshop_partnership_audit
  DROP CONSTRAINT IF EXISTS workshop_partnership_audit_action_check;

ALTER TABLE public.workshop_partnership_audit
  ADD CONSTRAINT workshop_partnership_audit_action_check
  CHECK (action IN ('created', 'activated', 'deactivated', 'reactivated', 'workshop_name_changed'));

-- ─── 3.2 Trigger de proteção contra auto-edição ──────────────
-- A Edge Function `workshop-accept-invitation` usa service role,
-- onde `auth.uid()` é NULL — por isso ela continua podendo criar
-- e ajustar a conta normalmente. Este guard atinge exclusivamente
-- a própria oficina autenticada (auth.uid() = OLD.profile_id).

CREATE OR REPLACE FUNCTION public.protect_workshop_account_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.profile_id THEN
    NEW.cnpj := OLD.cnpj;
    NEW.active := OLD.active;
    NEW.profile_id := OLD.profile_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_workshop_account_self_update ON public.workshop_accounts;

CREATE TRIGGER trg_protect_workshop_account_self_update
  BEFORE UPDATE ON public.workshop_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_workshop_account_self_update();

-- ─── 3.3 Trigger de propagação para os registros legados ─────
-- Mantém a cópia legada em `workshops` coerente com a fonte de
-- verdade (`workshop_accounts`), sem reescrever as consultas de
-- Manutenção/Financeiro. PROIBIDO propagar `active` (decisão por
-- transportadora), `cnpj`, `client_id`, `profile_id` ou `id`.

CREATE OR REPLACE FUNCTION public.sync_workshop_account_to_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.workshops
     SET name                 = NEW.name,
         phone                = NEW.phone,
         email                = NEW.email,
         contact_person       = NEW.contact_person,
         address_street       = NEW.address_street,
         address_number       = NEW.address_number,
         address_complement   = NEW.address_complement,
         address_neighborhood = NEW.address_neighborhood,
         address_city         = NEW.address_city,
         address_state        = NEW.address_state,
         address_zip          = NEW.address_zip,
         specialties          = NEW.specialties,
         notes                = NEW.notes
   WHERE id IN (
     SELECT legacy_workshop_id
     FROM public.workshop_partnerships
     WHERE workshop_account_id = NEW.id
       AND status = 'active'
       AND legacy_workshop_id IS NOT NULL
   );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_workshop_account_to_legacy ON public.workshop_accounts;

CREATE TRIGGER trg_sync_workshop_account_to_legacy
  AFTER UPDATE ON public.workshop_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workshop_account_to_legacy();

-- ─── 3.4 Trigger de auditoria de troca de nome ───────────────
-- Append-only: uma linha por parceria ativa quando o nome muda.
-- `performed_by` usa COALESCE porque a coluna é NOT NULL com FK
-- para auth.users e a Edge Function (service role) tem
-- auth.uid() nulo.

CREATE OR REPLACE FUNCTION public.audit_workshop_account_name_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.workshop_partnership_audit (partnership_id, action, performed_by, details)
    SELECT p.id,
           'workshop_name_changed',
           COALESCE(auth.uid(), NEW.profile_id),
           jsonb_build_object('from', OLD.name, 'to', NEW.name)
    FROM public.workshop_partnerships p
    WHERE p.workshop_account_id = NEW.id
      AND p.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_workshop_account_name_change ON public.workshop_accounts;

CREATE TRIGGER trg_audit_workshop_account_name_change
  AFTER UPDATE ON public.workshop_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_workshop_account_name_change();
