-- ============================================================
-- MIGRATION: enforce_budget_gate_on_maintenance_status
-- Data: 2026-09-20
-- Descrição: Trava de orçamento na mudança de status da Ordem de Serviço.
--
--   Regra A — bloqueio duro: `status = 'Orçamento aprovado'` só pode ser
--             gravado quando `budget_status = 'aprovado'`. Vale em INSERT e
--             em UPDATE. Não existe motivo que libere: o status é consequência
--             da aprovação do orçamento no Financeiro.
--
--   Regra B — inalterada: com `budget_status` em 'pendente' ou 'reaberto' a OS
--             não entra nem anda na faixa operacional. Continua a cargo de
--             fn_enforce_maintenance_status_budget_coherence (20260827000000),
--             que NÃO é tocada aqui.
--
--   Regra C — exceção auditada: ENTRAR na faixa operacional ('Serviço em
--             execução', 'Concluído', 'Veículo retirado') vindo de fora dela,
--             com `budget_status` em 'sem_orcamento' ou 'reprovado', exige
--             motivo escrito não-vazio de até 500 caracteres. Autor e data são
--             carimbados pelo banco a partir de auth.uid() e now(), ignorando
--             o que o cliente enviar. Transições DENTRO da faixa não exigem
--             nada — é o que mantém a retirada automática do veículo pelo
--             checklist de Saída de Oficina funcionando.
--
-- Migration 100% ADITIVA: nenhuma coluna existente muda de tipo, nenhum dado é
-- reescrito, NÃO HÁ BACKFILL. As OS que hoje já estão na faixa operacional sem
-- orçamento ficam com os três campos NULL e exibem "Não informado" /
-- "Não identificado". A auditoria vale a partir da aplicação.
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ─── 1. Colunas aditivas ──────────────────────────────────────

ALTER TABLE public.maintenance_orders
  ADD COLUMN IF NOT EXISTS budget_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS budget_override_by_id  UUID,
  ADD COLUMN IF NOT EXISTS budget_override_at     TIMESTAMPTZ;

-- O nome da constraint é literal e obrigatório: o embed do PostgREST
-- (profiles!maintenance_orders_budget_override_by_id_fkey) depende dele.
ALTER TABLE public.maintenance_orders
  DROP CONSTRAINT IF EXISTS maintenance_orders_budget_override_by_id_fkey;
ALTER TABLE public.maintenance_orders
  ADD CONSTRAINT maintenance_orders_budget_override_by_id_fkey
  FOREIGN KEY (budget_override_by_id) REFERENCES public.profiles(id);

COMMENT ON COLUMN public.maintenance_orders.budget_override_reason IS
  'Motivo da excecao registrado ao ENTRAR na faixa operacional sem orcamento aprovado. NULL nas OS que entraram na faixa antes de 2026-09-20 (sem backfill); a interface exibe "Nao informado" nesses casos.';
COMMENT ON COLUMN public.maintenance_orders.budget_override_by_id IS
  'Autor da excecao de orcamento. Carimbado pelo gatilho a partir de auth.uid(); nao e forjavel pelo cliente.';
COMMENT ON COLUMN public.maintenance_orders.budget_override_at IS
  'Data da excecao de orcamento. Carimbada pelo gatilho a partir de now(); nao e forjavel pelo cliente.';

-- ─── 2. Gatilho das Regras A e C ──────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_enforce_maintenance_budget_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status        TEXT;
  v_requires_override BOOLEAN := false;
BEGIN
  -- Sem usuario autenticado (SQL Editor / service_role): reparo manual liberado.
  -- Mesmo escape hatch de fn_enforce_maintenance_cancellation_reason.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_old_status := NULL;
  ELSE
    v_old_status := OLD.status;
  END IF;

  v_requires_override :=
        NEW.status IS DISTINCT FROM v_old_status
    AND NEW.status IN ('Serviço em execução', 'Concluído', 'Veículo retirado')
    AND NEW.budget_status NOT IN ('aprovado', 'pendente', 'reaberto')
    AND (
      v_old_status IS NULL
      OR v_old_status NOT IN ('Serviço em execução', 'Concluído', 'Veículo retirado')
    );

  -- Regra A — 'Orçamento aprovado' e consequencia da aprovacao no Financeiro.
  IF NEW.status IS DISTINCT FROM v_old_status
     AND NEW.status = 'Orçamento aprovado'
     AND NEW.budget_status IS DISTINCT FROM 'aprovado'
  THEN
    RAISE EXCEPTION 'Status Orcamento aprovado exige aprovacao do orcamento no Financeiro';
  END IF;

  -- Regra C — validacao do motivo e carimbo nao forjavel de autoria.
  IF v_requires_override THEN
    IF NEW.budget_override_reason IS NULL OR btrim(NEW.budget_override_reason) = '' THEN
      RAISE EXCEPTION 'Motivo obrigatorio: a OS entra em execucao sem orcamento aprovado';
    END IF;

    IF char_length(btrim(NEW.budget_override_reason)) > 500 THEN
      RAISE EXCEPTION 'Motivo da excecao de orcamento excede 500 caracteres';
    END IF;

    NEW.budget_override_reason := btrim(NEW.budget_override_reason);
    NEW.budget_override_by_id  := auth.uid();
    NEW.budget_override_at     := now();

    RETURN NEW;
  END IF;

  -- Blindagem fora da transicao qualificada: os tres campos sao intocaveis.
  -- Sobrescreve em silencio, de proposito: a aplicacao nunca envia estas
  -- colunas fora da porta, entao um RAISE aqui so produziria falha
  -- inexplicavel para o usuario. O efeito pratico e o mesmo.
  IF TG_OP = 'INSERT' THEN
    NEW.budget_override_reason := NULL;
    NEW.budget_override_by_id  := NULL;
    NEW.budget_override_at     := NULL;
  ELSE
    NEW.budget_override_reason := OLD.budget_override_reason;
    NEW.budget_override_by_id  := OLD.budget_override_by_id;
    NEW.budget_override_at     := OLD.budget_override_at;
  END IF;

  RETURN NEW;
END;
$$;

-- Um unico gatilho para INSERT e UPDATE. O nome dispara antes de
-- trg_enforce_maintenance_cancellation_reason e de
-- trg_enforce_maintenance_status_budget_coherence na ordem alfabetica.
-- Isso e inofensivo e nao intencional: os tres decidem sobre condicoes
-- disjuntas ('Cancelado', faixa operacional com pendente/reaberto, e as
-- Regras A/C). Nenhum depende do resultado do outro.
DROP TRIGGER IF EXISTS trg_enforce_maintenance_budget_gate ON public.maintenance_orders;
CREATE TRIGGER trg_enforce_maintenance_budget_gate
  BEFORE INSERT OR UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_maintenance_budget_gate();

-- ─── 3. Recarga do schema no PostgREST ────────────────────────

NOTIFY pgrst, 'reload schema';

-- ─── 4. Conferencia pos-aplicacao ─────────────────────────────
-- Rodar apos a migration. Esperado: o gatilho novo aparece e os CINCO
-- gatilhos pre-existentes continuam com tgenabled = 'O'.
--
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgrelid = 'public.maintenance_orders'::regclass
--   AND NOT tgisinternal
-- ORDER BY tgname;
--
-- Diagnostico completo em:
--   supabase/diagnostics/check-maintenance-budget-gate.sql

-- ─── 5. Rollback ──────────────────────────────────────────────
-- Arquivo separado em:
--   supabase/migrations/rollback/20260920000000_rollback_budget_gate_on_maintenance_status.sql
--
-- DROP TRIGGER IF EXISTS trg_enforce_maintenance_budget_gate ON public.maintenance_orders;
-- DROP FUNCTION IF EXISTS public.fn_enforce_maintenance_budget_gate();
-- -- As colunas NAO sao removidas: podem ja conter motivos reais de excecao.
-- -- Remocao so sob decisao explicita do usuario:
-- -- ALTER TABLE public.maintenance_orders
-- --   DROP CONSTRAINT IF EXISTS maintenance_orders_budget_override_by_id_fkey,
-- --   DROP COLUMN IF EXISTS budget_override_reason,
-- --   DROP COLUMN IF EXISTS budget_override_by_id,
-- --   DROP COLUMN IF EXISTS budget_override_at;
-- NOTIFY pgrst, 'reload schema';
