-- ============================================================
-- MIGRATION: fix_vehicle_documents_workshop_storage
-- Data: 2026-06-25
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- INSERT: tenant (folder[1]=client) OU Admin Master OU Workshop (parceria ativa)
DROP POLICY IF EXISTS "Vehicle Documents Authenticated Upload" ON storage.objects;
CREATE POLICY "Vehicle Documents Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vehicle-documents'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
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

-- UPDATE: mesma condição (necessário para upsert do PDF de orçamento)
DROP POLICY IF EXISTS "Vehicle Documents Authenticated Update" ON storage.objects;
CREATE POLICY "Vehicle Documents Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vehicle-documents'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
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

-- DELETE específico para fotos de peças: {client}/maintenance/{order}/parts/...
-- Libera Fleet Assistant+ (rank>=3) no próprio tenant e Admin Master.
-- NÃO substitui a policy de DELETE genérica do bucket (CRLV continua Fleet Analyst+).
DROP POLICY IF EXISTS "Maintenance Part Photos Delete" ON storage.objects;
CREATE POLICY "Maintenance Part Photos Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vehicle-documents'
    AND (storage.foldername(name))[2] = 'maintenance'
    AND (storage.foldername(name))[4] = 'parts'
    AND (
      (
        public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= 3
        AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin Master'
    )
  );
