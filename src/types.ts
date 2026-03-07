export type Role = 'Driver' | 'Yard Auditor' | 'Fleet Assistant' | 'Fleet Analyst' | 'Manager' | 'Director' | 'Admin Master';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string; // The primary client they belong to
}

export interface Client {
  id: string;
  name: string;
}

export interface Vehicle {
  id: string;
  clientId: string;
  type: 'Light' | 'Medium' | 'Heavy' | 'Cavalo';
  energySource: 'Combustão' | 'Elétrico' | 'Híbrido';
  coolingEquipment: boolean;
  
  // Conditional fields
  semiReboque?: boolean;
  placaSemiReboque?: string;
  fuelType?: string;
  tankCapacity?: number;
  avgConsumption?: number;
  coolingBrand?: string;

  // Additional fields
  licensePlate: string;
  renavam: string;
  chassi: string;
  detranUF: string;
  brandModel: string;
  year: number;
  color: string;
  acquisition: 'Owned' | 'Rented';
  fipePrice: number;
  tracker: string;
  antt: string;
  owner: string;
  status: 'Available' | 'Maintenance' | 'In Use';
  autonomy: number;
  crlvUpload?: string;
}
