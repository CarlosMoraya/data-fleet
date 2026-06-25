-- ============================================================
-- MIGRATION: create_maintenance_part_photos
-- Data: 2026-06-25
-- Descrição: Tabela de fotos das peças trocadas em uma OS.
--            Tipos 'broken' (quebradas) e 'new' (novas).
--            Origem rastreada via uploaded_by.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_part_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_order_id UUID NOT NULL REFERENCES public.maintenance_orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('broken', 'new')),
  url TEXT NOT NULL,
  caption TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.maintenance_part_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mpp_order  ON public.maintenance_part_photos(maintenance_order_id);
CREATE INDEX IF NOT EXISTS idx_mpp_client ON public.maintenance_part_photos(client_id);

-- SELECT: Fleet Assistant+ (próprio tenant) OU Admin Master OU Workshop (OS da sua oficina)
CREATE POLICY "part_photos_select" ON public.maintenance_part_photos
  FOR SELECT TO authenticated
  USING (
    (
      public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
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
          WHERE wa.profile_id = auth.uid() AND wp.status = 'active' AND wp.legacy_workshop_id IS NOT NULL
        )
      )
    )
  );

-- INSERT: mesmas condições do SELECT + uploaded_by deve ser o próprio usuário
CREATE POLICY "part_photos_insert" ON public.maintenance_part_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      (
        public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
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
            WHERE wa.profile_id = auth.uid() AND wp.status = 'active' AND wp.legacy_workshop_id IS NOT NULL
          )
        )
      )
    )
  );

-- DELETE: Fleet Assistant+ (próprio tenant) e Admin Master sempre;
--         Workshop SOMENTE enquanto a OS ainda não foi enviada para aprovação
CREATE POLICY "part_photos_delete" ON public.maintenance_part_photos
  FOR DELETE TO authenticated
  USING (
    (
      public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
      AND maintenance_order_id IN (
        SELECT mo.id FROM public.maintenance_orders mo
        WHERE mo.status IN ('Aguardando orçamento', 'Serviço em execução')
          AND mo.workshop_id IN (
            SELECT id FROM public.workshops WHERE profile_id = auth.uid()
            UNION
            SELECT wp.legacy_workshop_id
            FROM public.workshop_partnerships wp
            JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
            WHERE wa.profile_id = auth.uid() AND wp.status = 'active' AND wp.legacy_workshop_id IS NOT NULL
          )
      )
    )
  );
