-- ============================================================
-- MIGRATION: make_document_buckets_private
-- Data: 2026-08-11
-- Achado: V-01 — A01:2025 Controle de Acesso Quebrado / CWE-862
-- Descrição: Fecha a leitura ANÔNIMA dos buckets de documentos
--            'vehicle-documents' e 'driver-documents'. Os buckets
--            passam a ser privados e a leitura exige usuário
--            autenticado e autorizado; a aplicação gera URLs
--            assinadas de curta duração (3600s).
--
-- Escopo: NÃO altera 'checklist-photos' (fotos operacionais,
--         permanece público), 'client-logos', 'financial-documents'
--         nem 'fleet-ticket-attachments' (já privados).
--
-- ⚠️ EXECUTAR NO SUPABASE DASHBOARD → SQL Editor (DEV antes de PROD)
-- ============================================================

-- ── 1. Buckets deixam de ser públicos ───────────────────────
-- Com public = false, o endpoint /object/public/... para de servir
-- os objetos e só /object/sign/... (URL assinada) funciona.

UPDATE storage.buckets SET public = false WHERE id = 'vehicle-documents';
UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';

-- ── 2. Remove as policies de leitura sem autenticação ───────

DROP POLICY IF EXISTS "Vehicle Documents Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Driver Documents Public Access" ON storage.objects;

-- ── 3. Leitura autenticada de 'vehicle-documents' ───────────
-- Mesmas exceções já vigentes nas policies de escrita deste bucket
-- (ver 20260625000100_fix_vehicle_documents_workshop_storage.sql):
-- tenant do próprio client_id, Admin Master ou oficina com parceria ativa.

DROP POLICY IF EXISTS "Vehicle Documents Authenticated Read" ON storage.objects;
CREATE POLICY "Vehicle Documents Authenticated Read" ON storage.objects
  FOR SELECT USING (
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

-- ── 4. Leitura autenticada de 'driver-documents' ────────────
-- Reutiliza public.can_access_driver_path (tenant OU Admin Master),
-- criada em fix_admin_master_drivers_permissions.sql e já usada
-- pelas policies de INSERT/UPDATE/DELETE deste bucket.

DROP POLICY IF EXISTS "Driver Documents Authenticated Read" ON storage.objects;
CREATE POLICY "Driver Documents Authenticated Read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND public.can_access_driver_path(name)
  );
