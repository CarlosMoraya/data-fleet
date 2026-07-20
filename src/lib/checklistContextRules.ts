import type { ChecklistContext } from '../types/checklist';
import type { VehicleStatus } from '../types/vehicle';

export const AUDITOR_ONLY_CONTEXTS: ChecklistContext[] = ['Auditoria', 'Entrega', 'Devolução'];
export const HANDOVER_CONTEXTS: ChecklistContext[] = ['Entrega', 'Devolução'];

export function isAuditorOnlyContext(context: ChecklistContext): boolean {
  return AUDITOR_ONLY_CONTEXTS.includes(context);
}

export function requiresHandoverEvidence(context: ChecklistContext | undefined): boolean {
  if (!context) return false;
  return HANDOVER_CONTEXTS.includes(context);
}

export function vehicleStatusFilterFor(context: ChecklistContext | undefined): VehicleStatus | null {
  if (context === 'Entrega') return 'Available';
  if (context === 'Devolução') return 'In Use';
  return null;
}

export function filterTemplatesByContext<T extends { context: ChecklistContext }>(
  templates: T[],
  context: ChecklistContext | undefined,
): T[] {
  if (!context) return [];
  return templates.filter((t) => t.context === context);
}

export function filterVehiclesForContext<T extends { status?: VehicleStatus | null }>(
  vehicles: T[],
  context: ChecklistContext | undefined,
): T[] {
  const statusFilter = vehicleStatusFilterFor(context);
  if (!statusFilter) return vehicles;
  return vehicles.filter((v) => v.status === statusFilter);
}

export interface HandoverGateInput {
  context: ChecklistContext | undefined;
  driverId?: string;
  cnhPhotoUrl?: string;
  signatureUrl?: string;
}

export function isHandoverGateBlocked(input: HandoverGateInput): boolean {
  if (!requiresHandoverEvidence(input.context)) return false;
  return !input.driverId || !input.cnhPhotoUrl || !input.signatureUrl;
}
