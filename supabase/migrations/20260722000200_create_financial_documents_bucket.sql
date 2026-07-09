-- ============================================================
-- MIGRATION: create_financial_documents_bucket
-- Data: 2026-07-08
-- Descrição: Bucket PRIVADO para boleto e nota fiscal das parcelas.
--            Acesso somente via signed URL (nunca URL pública).
--            Escopo por client_id no path: {client_id}/payments/{order_id}/{file}
--            → foldername[1] = client_id.
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-documents', 'financial-documents', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT: Fleet Assistant+ (tenant), Admin Master, Financeiro (tenant, leitura)
--         e Workshop (client_id de parceria ativa). Sempre via signed URL.
DROP POLICY IF EXISTS "Financial Documents Select" ON storage.objects;
CREATE POLICY "Financial Documents Select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'financial-documents'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
        AND public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Financeiro'
        AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
      )
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
        AND (storage.foldername(name))[1] IN (
          SELECT wp.client_id::text
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid() AND wp.status = 'active'
        )
      )
    )
  );

-- INSERT: Fleet Assistant+ (tenant), Admin Master e Workshop (parceria ativa).
--         Financeiro NÃO faz upload.
DROP POLICY IF EXISTS "Financial Documents Insert" ON storage.objects;
CREATE POLICY "Financial Documents Insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'financial-documents'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
        AND public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Workshop'
        AND (storage.foldername(name))[1] IN (
          SELECT wp.client_id::text
          FROM public.workshop_partnerships wp
          JOIN public.workshop_accounts wa ON wa.id = wp.workshop_account_id
          WHERE wa.profile_id = auth.uid() AND wp.status = 'active'
        )
      )
    )
  );
