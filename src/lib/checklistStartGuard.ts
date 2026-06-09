export const OFFLINE_CHECKLIST_START_MESSAGE =
  'Você precisa estar online para iniciar um checklist. Depois de iniciado, o preenchimento funciona normalmente sem internet.';

export const OFFLINE_TIRE_INSPECTION_START_MESSAGE =
  'Você precisa estar online para iniciar uma inspeção de pneus. Depois de iniciada, o preenchimento funciona normalmente sem internet.';

/** Retorna a mensagem de bloqueio quando offline, ou null quando o início é permitido. */
export function getChecklistStartBlockMessage(isOnline: boolean): string | null {
  return isOnline ? null : OFFLINE_CHECKLIST_START_MESSAGE;
}

/** Retorna a mensagem de bloqueio quando offline, ou null quando o início é permitido. */
export function getTireInspectionStartBlockMessage(isOnline: boolean): string | null {
  return isOnline ? null : OFFLINE_TIRE_INSPECTION_START_MESSAGE;
}
