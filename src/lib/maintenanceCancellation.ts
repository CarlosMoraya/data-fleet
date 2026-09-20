/**
 * Fonte única da regra de formato do motivo de cancelamento de Ordem de Serviço,
 * espelhada pelo gatilho fn_enforce_maintenance_cancellation_reason no banco.
 */

export const MAINTENANCE_CANCELLATION_REASON_MAX_LENGTH = 500;
export const MAINTENANCE_CANCELLATION_REASON_INVALID_MESSAGE =
  'Informe o motivo do cancelamento (até 500 caracteres).';
export const MAINTENANCE_CANCELLATION_REASON_NOT_INFORMED = 'Não informado';
export const MAINTENANCE_CANCELLATION_AUTHOR_UNKNOWN = 'Não identificado';

export function normalizeMaintenanceCancellationReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAINTENANCE_CANCELLATION_REASON_MAX_LENGTH) return null;
  return trimmed;
}

export function formatMaintenanceCancellationReason(reason: string | undefined): string {
  if (reason === undefined || reason.trim().length === 0) {
    return MAINTENANCE_CANCELLATION_REASON_NOT_INFORMED;
  }
  return reason.trim();
}

export function formatMaintenanceCancellationAuthor(name: string | undefined): string {
  if (name === undefined || name.trim().length === 0) {
    return MAINTENANCE_CANCELLATION_AUTHOR_UNKNOWN;
  }
  return name.trim();
}