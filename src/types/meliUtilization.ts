export interface MeliRouteEntry {
  plate: string;
  routeDate: string;
  routeId: string;
  driverName: string | null;
  serviceCenter: string;
  cycle: string | null;
  odometerDistanceKm: number | null;
}

export interface MeliUtilizationRow {
  key: string;
  vehicleId: string;
  licensePlate: string;
  vehicleDescription: string;
  utilized: boolean;
  routeDate: string;
  routeId: string | null;
  driverName: string | null;
  fleetDriverName: string | null;
  driverDivergent: boolean;
  unitCode: string | null;
  fleetUnitCode: string | null;
  unitDivergent: boolean;
  unavailableOnDate: boolean;
  statusDivergent: boolean;
  cycle: string | null;
  odometerDistanceKm: number | null;
}

export interface MeliUtilizationKpis {
  totalVehicles: number;
  usedVehicles: number;
  unusedVehicles: number;
  utilizationRate: number;
}

export interface MeliMaintenanceWindow {
  vehicleId: string;
  entryDate: string;
  exitDate: string | null;
  status: string;
}

export interface MeliEligibleVehicle {
  id: string;
  licensePlate: string;
  brand: string | null;
  model: string | null;
  driverName: string | null;
  unitCode: string | null;
}

export interface BuildRowsInput {
  vehicles: MeliEligibleVehicle[];
  routes: MeliRouteEntry[];
  maintenanceWindows: MeliMaintenanceWindow[];
  from: string;
  to: string;
}
