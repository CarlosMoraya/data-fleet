-- Tabela para armazenar cache de resultados de OCR
-- Evita chamadas repetidas à APIs de IA para o mesmo arquivo (baseado no hash do conteúdo)

CREATE TABLE IF NOT EXISTS public.ocr_cache (
    file_hash TEXT PRIMARY KEY,
    result JSONB NOT NULL,
    model_used TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Opcional: para limpeza futura
);

-- RLS: Apenas usuários autenticados podem ler/inserir no cache
ALTER TABLE public.ocr_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read ocr_cache"
ON public.ocr_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert ocr_cache"
ON public.ocr_cache FOR INSERT
TO authenticated
WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.ocr_cache IS 'Cache de resultados de OCR para evitar re-processamento de arquivos idênticos.';
COMMENT ON COLUMN public.ocr_cache.file_hash IS 'SHA-256 do conteúdo do arquivo original.';
