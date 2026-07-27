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

// Devolução finaliza um empréstimo ativo; o empréstimo não altera
// vehicles.status (permanece Available), então o filtro por status
// sozinho excluiria o veículo emprestado da lista de Devolução. Para
// esse contexto, a lista é a união de veículos com empréstimo ativo e
// veículos In Use (comportamento legado preservado).
export function filterAuditorVehiclesForContext<T extends { id: string; status?: VehicleStatus | null }>(
  input: {
    vehicles: T[];
    context: ChecklistContext | undefined;
    activeLoanVehicleIds: Set<string>;
  },
): T[] {
  if (input.context === 'Devolução') {
    return input.vehicles.filter((v) => input.activeLoanVehicleIds.has(v.id) || v.status === 'In Use');
  }
  return filterVehiclesForContext(input.vehicles, input.context);
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

// ─── Driver-available contexts (vehicle loans) ────────────────────────────
// Drivers see all published contexts EXCEPT auditor-only ones. When the
// driver is the TITULAR of a vehicle with an active loan, Auditoria is
// additionally unlocked — and ONLY Auditoria. Entrega/Devolução are never
// exposed to the driver; the temporary driver never gets anything extra.

export interface GetAvailableContextsForDriverInput {
  publishedContexts: ChecklistContext[];
  hasActiveLoan: boolean;
  isTitular: boolean;
}

export function getAvailableContextsForDriver(input: GetAvailableContextsForDriverInput): ChecklistContext[] {
  const base = input.publishedContexts.filter((ctx) => !AUDITOR_ONLY_CONTEXTS.includes(ctx));
  if (input.hasActiveLoan && input.isTitular) {
    if (input.publishedContexts.includes('Auditoria') && !base.includes('Auditoria')) {
      return [...base, 'Auditoria'];
    }
  }
  return base;
}

// Pure helper extracted for unit testing the Empréstimo trigger logic
// in the Auditor flow (Checklists.tsx): decide whether starting a
// handover checklist with a given driver triggers a new loan.
// `titularDriverId` null => loan is created (different driver).
export function shouldCreateLoanOnHandover(
  selectedDriverId: string | undefined | null,
  titularDriverId: string | null | undefined,
  context: ChecklistContext | undefined,
): boolean {
  if (!requiresHandoverEvidence(context)) return false;
  if (!selectedDriverId) return false;
  return selectedDriverId !== (titularDriverId ?? null);
}
