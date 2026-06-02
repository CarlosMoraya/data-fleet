import type { Role } from './role';

export interface OperationsManagerScope {
  shipperIds: string[];
  operationalUnitIds: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string | null; // null para Workshop no novo modelo (multi-transportadora)
  canDeleteVehicles: boolean;
  canDeleteDrivers: boolean;
  canDeleteWorkshops: boolean;
  budgetApprovalLimit: number;
  workshopId?: string; // Populado quando role = 'Workshop' (modelo legado)
  workshopAccountId?: string; // Populado quando role = 'Workshop' (novo modelo)
  operationsScope?: OperationsManagerScope;
}

export interface Client {
  id: string;
  name: string;
  logoUrl?: string;
}
