export const CACHE_TTL = {
  reference: 1000 * 60 * 60 * 24,
  operational: 1000 * 60 * 60 * 8,
  dashboard: 1000 * 60 * 60 * 1,
  offline: 1000 * 60 * 60 * 24,
};

export const PERSIST_ALLOWLIST: Record<string, number> = {
  vehicleFieldSettings: CACHE_TTL.reference,
  vehicleSettings: CACHE_TTL.reference,
  driverFieldSettings: CACHE_TTL.reference,
  driverSettings: CACHE_TTL.reference,
  checklistDayIntervals: CACHE_TTL.reference,
  vehicleKmIntervals: CACHE_TTL.reference,
  warrantyVehicleCurrentKm: CACHE_TTL.reference,
  vehiclesForKmIntervals: CACHE_TTL.reference,
  pneusDayInterval: CACHE_TTL.reference,
  'dashboard-intervals': CACHE_TTL.reference,
  checklistTemplates: CACHE_TTL.reference,
  publishedTemplates: CACHE_TTL.reference,
  auditorTemplates: CACHE_TTL.reference,
  tireManufacturers: CACHE_TTL.reference,
  tireBrands: CACHE_TTL.reference,

  vehicles: CACHE_TTL.operational,
  vehiclesSimple: CACHE_TTL.operational,
  warrantyOverview: CACHE_TTL.operational,
  shippers: CACHE_TTL.operational,
  operationalUnits: CACHE_TTL.operational,
  tires: CACHE_TTL.operational,
  workshops: CACHE_TTL.operational,
  workshopPartnerships: CACHE_TTL.operational,
  workshopInvitations: CACHE_TTL.operational,
  actionPlans: CACHE_TTL.operational,
  checklists: CACHE_TTL.operational,
  checklistIssues: CACHE_TTL.operational,
  tireInspections: CACHE_TTL.operational,
  auditorVehicles: CACHE_TTL.operational,

  'dashboard-vehicles': CACHE_TTL.dashboard,
  'dashboard-maintenance': CACHE_TTL.dashboard,
  'dashboard-maintenance-previous': CACHE_TTL.dashboard,
  'dashboard-cost-projection': CACHE_TTL.dashboard,
  'dashboard-checklists': CACHE_TTL.dashboard,
  'dashboard-last-checklists': CACHE_TTL.dashboard,
  'dashboard-vehicle-km': CACHE_TTL.dashboard,
  'dashboard-drivers': CACHE_TTL.dashboard,

  checklist: CACHE_TTL.offline,
  checklistItems: CACHE_TTL.offline,
  checklistResponses: CACHE_TTL.offline,
  vehicleInitialKm: CACHE_TTL.offline,
  lastOdometerKm: CACHE_TTL.offline,
  openChecklist: CACHE_TTL.offline,
  tireInspection: CACHE_TTL.offline,
  tireInspectionResponses: CACHE_TTL.offline,
  tireInspectionItems: CACHE_TTL.offline,
};

export function shouldPersistQuery(
  queryKey: readonly unknown[],
  dataUpdatedAt: number,
  now: number
): boolean {
  const prefix = queryKey[0];
  if (typeof prefix !== 'string' || !dataUpdatedAt) return false;

  const ttl = PERSIST_ALLOWLIST[prefix];
  if (ttl === undefined) return false;

  return now - dataUpdatedAt <= ttl;
}
