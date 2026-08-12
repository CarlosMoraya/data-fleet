-- ============================================================
-- ROLLBACK de 20260811010000_make_document_buckets_private.sql
-- Data: 2026-08-11
--
-- ⚠️ Este rollback REABRE a leitura anônima de 'vehicle-documents'
--    e 'driver-documents'. Só deve ser aplicado se a política
--    privada causar indisponibilidade, e em PROD apenas com
--    autorização expressa.
--
-- Não apaga objetos do Storage nem altera colunas de negócio:
-- os ponteiros persistidos (caminhos) continuam válidos, pois o
-- código de URL assinada funciona também com bucket público.
-- ============================================================

-- ── 1. Buckets voltam a ser públicos ────────────────────────

UPDATE storage.buckets SET public = true WHERE id = 'vehicle-documents';
UPDATE storage.buckets SET public = true WHERE id = 'driver-documents';

-- ── 2. Remove as policies autenticadas de leitura ───────────

DROP POLICY IF EXISTS "Vehicle Documents Authenticated Read" ON storage.objects;
DROP POLICY IF EXISTS "Driver Documents Authenticated Read" ON storage.objects;

-- ── 3. Restaura as policies públicas de leitura originais ───
-- Nomes idênticos aos das migrations de criação dos buckets.

DROP POLICY IF EXISTS "Vehicle Documents Public Access" ON storage.objects;
CREATE POLICY "Vehicle Documents Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'vehicle-documents');

DROP POLICY IF EXISTS "Driver Documents Public Access" ON storage.objects;
CREATE POLICY "Driver Documents Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'driver-documents');
