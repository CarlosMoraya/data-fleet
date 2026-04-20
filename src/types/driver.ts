// ─── Motoristas ───────────────────────────────────────────────────────────────

export interface Driver {
  id: string;
  clientId: string;
  profileId?: string; // FK → profiles.id — todo motorista é um usuário do sistema

  // Core identity (sempre obrigatórios)
  name: string;
  cpf: string;

  // CNH
  issueDate?: string;
  expirationDate?: string;
  cnhUpload?: string;
  registrationNumber?: string;
  category?: string; // A, B, AB, AE, etc.
  renach?: string;

  // GR do motorista
  grUpload?: string;
  grExpirationDate?: string;

  // Certificados
  certificate1Upload?: string;
  courseName1?: string;
  certificate2Upload?: string;
  courseName2?: string;
  certificate3Upload?: string;
  courseName3?: string;
}

/** Configuração per-client de quais campos de motorista são opcionais.
 *  `true` = opcional, `false` = obrigatório. Default: tudo obrigatório. */
export interface DriverFieldSettings {
  id: string;
  clientId: string;

  // CNH
  issueDateOptional: boolean;
  expirationDateOptional: boolean;
  cnhUploadOptional: boolean;
  registrationNumberOptional: boolean;
  categoryOptional: boolean;
  renachOptional: boolean;

  // GR
  grUploadOptional: boolean;
  grExpirationDateOptional: boolean;

  // Certificados
  certificate1UploadOptional: boolean;
  courseName1Optional: boolean;
  certificate2UploadOptional: boolean;
  courseName2Optional: boolean;
  certificate3UploadOptional: boolean;
  courseName3Optional: boolean;
}
