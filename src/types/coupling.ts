export interface ThirdPartyTractor {
  id: string;
  clientId: string;
  plate: string;
  crlvUpload?: string;
  crlvExpirationDate?: string;
  antt?: string;
  grUpload?: string;
  grExpirationDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThirdPartyDriver {
  id: string;
  clientId: string;
  name: string;
  cnh?: string;
  cnhExpirationDate?: string;
  phone?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleCoupling {
  id: string;
  clientId: string;
  trailerId: string;
  tractorId?: string | null;
  tractorPlate?: string;
  tractorDriverName?: string;
  thirdPartyTractorId?: string | null;
  thirdPartyDriverId?: string | null;
  coupledAt: string;
  uncoupledAt?: string | null;
  coupledLatitude?: number | null;
  coupledLongitude?: number | null;
  uncoupledLatitude?: number | null;
  uncoupledLongitude?: number | null;
  odometerCoupled?: number | null;
  odometerUncoupled?: number | null;
  distanceKm?: number | null;
  couplingChecklistId?: string | null;
  uncouplingChecklistId?: string | null;
  filledBy: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
