-- ============================================================
-- MIGRATION: create_driver_documents_bucket
-- Data: 2026-03-11
-- Descrição: Cria o bucket 'driver-documents' e configura as
--            políticas de RLS para acesso público e upload por tenant.
-- ============================================================

-- 1. Criar o bucket se não existir
-- Nota: Caso este comando falhe, você pode criar o bucket 'driver-documents' 
-- manualmente no menu Storage do Dashboard e depois rodar apenas as políticas.
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de RLS (RLS geralmente já vem habilitado em storage.objects)
-- Se o erro de 'must be owner' persistir, tente criar o bucket e as políticas via UI.

-- 3. Política: Acesso público de leitura para todos
CREATE POLICY "Driver Documents Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'driver-documents');

-- 4. Política: Upload/Insert para usuários autenticados no seu próprio diretório (client_id)
-- O caminho esperado é {client_id}/{driver_id}/{filename}
CREATE POLICY "Driver Documents Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Política: Update/Delete para usuários autenticados no seu próprio diretório
CREATE POLICY "Driver Documents Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Driver Documents Authenticated Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'driver-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );
