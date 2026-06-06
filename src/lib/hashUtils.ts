/**
 * Gera um hash SHA-256 a partir de um objeto File ou Blob.
 * Se crypto.subtle não estiver disponível, usa fallback determinístico.
 * Utilizado para identificar arquivos de forma única no cache de OCR.
 */
export async function calculateFileHash(file: File | Blob): Promise<string> {
  // Tenta usar crypto.subtle.digest se disponível (método seguro, dependente de HTTPS)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (err) {
      // Se crypto.subtle falhar por qualquer motivo, usar fallback
      console.warn('[OCR Hash] crypto.subtle.digest falhou, usando fallback:', err);
    }
  }

  // Fallback: criar hash determinístico simples baseado em tamanho + nome
  // NÃO usa crypto.subtle — funciona em qualquer ambiente
  // Mesmo arquivo sempre gera mesmo hash (importante para cache)
  const fileName = (file as File).name || 'blob';
  const fileSize = file.size.toString();
  // Simple deterministic hash: combine name + size em hex
  const fallbackInput = `${fileName}|${fileSize}`;
  let hash = 0;
  for (let i = 0; i < fallbackInput.length; i++) {
    const char = fallbackInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para 32-bit integer
  }
  // Converter para hex positivo (8 caracteres, padronizado)
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  // Adicionar size em hex para melhorar unicidade
  const sizeHex = fileSize.charCodeAt(0).toString(16).padStart(2, '0');
  return `${hashHex}${sizeHex}${fileName.charCodeAt(0).toString(16).padStart(2, '0')}`;
}
