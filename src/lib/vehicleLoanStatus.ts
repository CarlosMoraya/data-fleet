import type { VehicleLoan, VehicleLoanEndedReason } from '../types/vehicleLoan';

export interface VehicleLoanStatusTag {
  label: string;
  className: string;
  icon: string;
}

const BADGE_BASE = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium';

export function getVehicleLoanStatusTag(loan: Pick<VehicleLoan, 'status' | 'endedReason'>): VehicleLoanStatusTag {
  if (loan.status === 'active') {
    return { label: 'Ativo', className: `${BADGE_BASE} bg-green-100 text-green-700`, icon: '🔄' };
  }
  if (loan.status === 'cancelled') {
    return { label: 'Cancelado', className: `${BADGE_BASE} bg-red-100 text-red-700`, icon: '❌' };
  }
  // completed
  if (loan.endedReason === 'driver_changed') {
    return { label: 'Concluído (Automático)', className: `${BADGE_BASE} bg-amber-100 text-amber-700`, icon: '⚙️' };
  }
  return { label: 'Concluído', className: `${BADGE_BASE} bg-blue-100 text-blue-700`, icon: '✅' };
}

export function getVehicleLoanEndedReasonLabel(reason?: VehicleLoanEndedReason | null): string {
  if (reason === 'return_checklist') return 'Devolução por checklist';
  if (reason === 'driver_changed') return 'Troca de motorista titular';
  if (reason === 'cancelled') return 'Cancelado';
  if (reason === 'other') return 'Outro';
  return '—';
}