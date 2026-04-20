// ─── Tire Inspections ─────────────────────────────────────────────────────────

import type { AxleConfigEntry } from './tire';

export type TireInspectionStatus = 'in_progress' | 'completed';
export type TireInspectionResponseStatus = 'conforme' | 'nao_conforme';

export interface TireInspection {
  id: string;
  clientId: string;
  vehicleId: string;
  vehicleLicensePlate?: string; // from join
  filledBy: string;
  filledByName?: string;        // from join
  startedAt: string;
  completedAt?: string;
  status: TireInspectionStatus;
  odometerKm?: number;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  notes?: string;
  axleConfigSnapshot: AxleConfigEntry[];
  stepsCountSnapshot: number;
}

export interface TireInspectionResponse {
  id: string;
  inspectionId: string;
  tireId?: string;
  positionCode: string;
  positionLabel: string;
  dot?: string;
  fireMarking?: string;
  manufacturer: string;
  brand: string;
  photoUrl: string;
  photoTimestamp: string;
  status: TireInspectionResponseStatus;
  observation?: string;
  respondedAt: string;
}
