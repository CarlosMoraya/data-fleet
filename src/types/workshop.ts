// ─── Oficinas ─────────────────────────────────────────────────────────────────

export interface Workshop {
  id: string;
  clientId: string;
  name: string;
  cnpj: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  specialties?: string[];
  notes?: string;
  active: boolean;
  profileId?: string; // Auth account linked to this workshop (for Workshop login)
}

/** Conta independente de oficina, desacoplada de client_id */
export interface WorkshopAccount {
  id: string;
  profileId: string;
  name: string;
  cnpj: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  specialties?: string[];
  notes?: string;
  active: boolean;
}

/** Vínculo M:N entre uma oficina e uma transportadora */
export interface WorkshopPartnership {
  id: string;
  workshopAccountId: string;
  clientId: string;
  clientName?: string;
  clientLogoUrl?: string;
  legacyWorkshopId?: string;
  status: 'active' | 'inactive';
  invitedAt?: string;
  acceptedAt?: string;
}

/** Convite gerado por uma transportadora para uma oficina */
export interface WorkshopInvitation {
  id: string;
  clientId: string;
  clientName?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

export type WorkshopScheduleStatus = 'scheduled' | 'completed' | 'cancelled';

export interface WorkshopSchedule {
  id: string;
  clientId: string;
  vehicleId: string;
  vehicleLicensePlate?: string;       // from JOIN vehicles
  workshopId: string;
  workshopName?: string;              // from JOIN workshops
  workshopAddressStreet?: string;
  workshopAddressNumber?: string;
  workshopAddressComplement?: string;
  workshopAddressNeighborhood?: string;
  workshopAddressCity?: string;
  workshopAddressState?: string;
  workshopAddressZip?: string;
  scheduledDate: string;              // DATE as 'YYYY-MM-DD'
  status: WorkshopScheduleStatus;
  completedAt?: string;
  checklistId?: string;
  notes?: string;
  createdBy: string;
  createdByName?: string;             // from JOIN profiles
  createdAt?: string;
}
