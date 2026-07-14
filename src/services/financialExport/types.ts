// ─── Estratégia de Integrações — Provider Pattern (Saída/Exportação) ──────────
// Assinatura adaptada do INTEGRATION_STRATEGY.md §3: sem `credentials`, pois o
// provider `planilha` não usa credenciais externas. Providers de API (Conta
// Azul/Omie/Bling) que chegarão na Fase 3 estenderão esta interface.

export interface ExportResult {
  success: boolean;
  recordsSent: number;
  /** Conteúdo gerado (ex.: CSV) para download client-side. Usado por providers textuais. */
  content?: string;
  /** Blob binário gerado (ex.: XLSX) para download client-side. Usado por providers binários. */
  blob?: Blob;
}

export interface ExportProvider {
  /** Código único do provider (ex.: 'planilha'). */
  readonly code: string;

  /** Nome legível para exibição na UI. */
  readonly name: string;

  /** Descrição do que este provider faz. */
  readonly description: string;

  /**
   * Exporta dados do BetaFleet no formato do provider.
   * @param clientId ID do cliente (tenant)
   * @param data Dados a exportar (no formato universal do módulo)
   */
  exportData(clientId: string, data: unknown[]): Promise<ExportResult>;
}
