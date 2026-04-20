// ─── Pneus ────────────────────────────────────────────────────────────────────

export type TireVisualClassification = 'Novo' | 'Meia vida' | 'Troca';
export type TirePositionType = 'single' | 'dual_external' | 'dual_internal' | 'triple_external' | 'triple_middle' | 'triple_internal' | 'spare';

// ─── Axle Configuration ───────────────────────────────────────────────────────

export type AxleType = 'direcional' | 'simples' | 'duplo' | 'duplo_tandem' | 'triplo_tandem' | 'elevacao';
export type RodagemType = 'simples' | 'dupla' | 'tripla';

export interface AxleConfigEntry {
  order: number;          // 1-based sequential order
  type: AxleType;
  rodagem: RodagemType;
  physicalAxles: number;  // 1 for direcional/simples/elevacao, 2 for duplo/duplo_tandem, 3 for triplo_tandem
}

export interface Tire {
  id: string;
  clientId: string;
  vehicleId: string;
  tireCode: string;
  specification: string;
  dot?: string;
  fireMarking?: string;
  manufacturer?: string;
  brand?: string;
  rotationIntervalKm?: number;
  usefulLifeKm?: number;
  retreadIntervalKm?: number;
  visualClassification: TireVisualClassification;
  currentPosition: string;
  lastPosition?: string;
  positionType: TirePositionType;
  active: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // Campos de JOIN
  vehicleLicensePlate?: string;
  vehicleModel?: string;
  vehicleType?: string;
}

export interface TirePositionHistory {
  id: string;
  clientId: string;
  tireId: string;
  vehicleId: string;
  previousPosition?: string;
  newPosition: string;
  movedAt: string;
  movedBy: string;
  movedByName?: string;
  reason?: string;
  odometerKm?: number;
}

export interface VehicleTireConfig {
  id: string;
  vehicleType: string;
  defaultAxles: number;
  defaultSpareCount: number;
  dualAxles: number[];
}
