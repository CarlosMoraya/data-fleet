export type VehicleLinkDivergenceReason = 'other_driver_assigned' | 'executor_has_other_vehicle';

export interface VehicleLinkDivergence {
  reasons: VehicleLinkDivergenceReason[];
  executorVehiclePlate?: string;
}

export interface SelectableVehicle {
  id: string;
  licensePlate: string;
  category: string | null;
  status: string | null;
  isAssignedToMe: boolean;
  hasOtherDriver: boolean;
}

const BLOCKED_SUFFIX = 'A sua empresa exige que o checklist seja feito no veículo vinculado a você. Selecione outro veículo.';

function buildReasonPrefix(divergence: VehicleLinkDivergence): string {
  const hasOtherDriver = divergence.reasons.includes('other_driver_assigned');
  const hasOtherVehicle = divergence.reasons.includes('executor_has_other_vehicle') && !!divergence.executorVehiclePlate;

  if (hasOtherDriver && hasOtherVehicle) {
    return `Você já está vinculado ao veículo placa ${divergence.executorVehiclePlate} e existe outro motorista vinculado ao veículo selecionado.`;
  }
  if (hasOtherVehicle) {
    return `Você já está vinculado ao veículo placa ${divergence.executorVehiclePlate}.`;
  }
  return 'Existe outro motorista vinculado a esse veículo.';
}

export function hasVehicleLinkDivergence(divergence: VehicleLinkDivergence | null | undefined): boolean {
  return !!divergence && divergence.reasons.length > 0;
}

export function buildVehicleLinkDivergenceMessage(divergence: VehicleLinkDivergence): string {
  return `${buildReasonPrefix(divergence)} Deseja prosseguir assim mesmo?`;
}

export function buildVehicleLinkBlockedMessage(divergence: VehicleLinkDivergence): string {
  return `${buildReasonPrefix(divergence)} ${BLOCKED_SUFFIX}`;
}

export function resolveDefaultVehicleId(vehicles: SelectableVehicle[]): string {
  const assigned = vehicles.find(v => v.isAssignedToMe);
  return assigned?.id ?? '';
}

export function describeDivergenceReason(reason: VehicleLinkDivergenceReason): string {
  return reason === 'other_driver_assigned'
    ? 'Veículo vinculado a outro motorista'
    : 'Executor vinculado a outro veículo';
}
