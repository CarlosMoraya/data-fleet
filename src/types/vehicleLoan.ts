// Vehicle loans — temporary driver tracking for handover checklists.

export type VehicleLoanStatus = 'active' | 'completed' | 'cancelled';

export type VehicleLoanEndedReason = 'return_checklist' | 'driver_changed' | 'cancelled' | 'other';

export type VehicleLoanNotificationKind = 'loan_created' | 'loan_ended_driver_changed';

export interface VehicleLoan {
  id: string;
  clientId: string;
  vehicleId: string;
  driverId: string;
  driverName?: string;
  startedAt: string;
  endedAt?: string | null;
  deliveryChecklistId?: string | null;
  returnChecklistId?: string | null;
  status: VehicleLoanStatus;
  notes: string;
  endedNotes?: string | null;
  createdBy: string;
  createdByName?: string | null;
  endedBy?: string | null;
  endedByName?: string | null;
  endedReason?: VehicleLoanEndedReason | null;
  deliveryChecklistAt?: string | null;
  returnChecklistAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleLoanNotification {
  id: string;
  clientId: string;
  loanId: string;
  recipientDriverId: string;
  kind: VehicleLoanNotificationKind;
  payload: {
    license_plate?: string;
    temp_driver_name?: string;
    started_at?: string;
    notes?: string;
    ended_at?: string;
    reason?: string;
  };
  readAt?: string | null;
  createdAt: string;
}