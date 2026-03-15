-- ============================================================
-- MIGRATION: create_checklist_photos_bucket
-- Data: 2026-03-15
-- Descrição: Cria o bucket 'checklist-photos' e configura as
--            políticas de RLS para acesso público de leitura e
--            upload por qualquer usuário autenticado do tenant.
--            Necessário para que Fleet Assistant+ visualize fotos
--            de inconformidades registradas em checklists.
-- ============================================================

-- 1. Criar o bucket se não existir (público = leitura sem autenticação)
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Política: Acesso público de leitura para todos
DROP POLICY IF EXISTS "Checklist Photos Public Access" ON storage.objects;
CREATE POLICY "Checklist Photos Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'checklist-photos');

-- 3. Política: Upload para qualquer usuário autenticado do tenant
-- Path: {client_id}/{checklist_id}/{item_id}/{timestamp}.jpg
-- O primeiro segmento do path deve ser o client_id do usuário.
DROP POLICY IF EXISTS "Checklist Photos Authenticated Upload" ON storage.objects;
CREATE POLICY "Checklist Photos Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'checklist-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );

-- 4. Política: Update para usuários autenticados do tenant
DROP POLICY IF EXISTS "Checklist Photos Authenticated Update" ON storage.objects;
CREATE POLICY "Checklist Photos Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'checklist-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Política: Delete para Fleet Analyst+ do tenant
DROP POLICY IF EXISTS "Checklist Photos Authenticated Delete" ON storage.objects;
CREATE POLICY "Checklist Photos Authenticated Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'checklist-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT client_id::text FROM public.profiles WHERE id = auth.uid())
    AND public.role_rank((SELECT role FROM public.profiles WHERE id = auth.uid())) >= public.role_rank('Fleet Analyst')
  );
