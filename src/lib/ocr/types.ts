export interface OcrProvider {
  /**
   * Extrai dados de um arquivo utilizando IA.
   * @param file O arquivo (imagem ou PDF) para processar.
   * @param prompt O prompt de sistema com as regras de extração.
   * @returns O objeto JSON retornado pela IA.
   */
  extract(file: File, prompt: string): Promise<any>;

  /**
   * Identificador do provedor para registro no cache.
   */
  readonly name: string;
}
