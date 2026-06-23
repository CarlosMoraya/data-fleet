-- ============================================================
-- MIGRATION: create_vehicle_documents_bucket
-- Data: 2026-06-19
-- Descrição: Cria o bucket 'vehicle-documents' e configura as
--            políticas de leitura pública e upload por tenant.
--            Usado por documentos de veículo, orçamento de manutenção
--            e evidências de plano de ação.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Vehicle Documents Public Access" ON storage.objects;
CREATE POLICY "Vehicle Documents Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "Vehicle Documents Authenticated Upload" ON storage.objects;
CREATE POLICY "Vehicle Documents Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vehicle-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Vehicle Documents Authenticated Update" ON storage.objects;
CREATE POLICY "Vehicle Documents Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vehicle-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Vehicle Documents Authenticated Delete" ON storage.objects;
CREATE POLICY "Vehicle Documents Authenticated Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vehicle-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
    AND public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= public.role_rank('Fleet Analyst')
  );
