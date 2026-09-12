import { normalizeSearchText } from './textSearch';

type NullableText = string | null | undefined;

export type ChecklistSearchFields = {
  vehicleLicensePlate?: NullableText;
  templateName?: NullableText;
  templateContext?: NullableText;
};

export type VehiclePlateSearchFields = {
  plate?: NullableText;
};

export function matchesChecklistHistorySearch(
  checklist: ChecklistSearchFields,
  query: NullableText,
  includeVehiclePlate: boolean,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const fields = [checklist.templateName, checklist.templateContext];
  if (includeVehiclePlate) fields.unshift(checklist.vehicleLicensePlate);

  return fields.some((field) => normalizeSearchText(field).includes(normalizedQuery));
}

export function filterChecklistsByHistorySearch<T extends ChecklistSearchFields>(
  checklists: T[],
  query: NullableText,
  includeVehiclePlate: boolean,
): T[] {
  return checklists.filter((checklist) =>
    matchesChecklistHistorySearch(checklist, query, includeVehiclePlate),
  );
}

export function filterVehiclesByPlate<T extends VehiclePlateSearchFields>(
  vehicles: T[],
  query: NullableText,
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return vehicles;

  return vehicles.filter((vehicle) =>
    normalizeSearchText(vehicle.plate).includes(normalizedQuery),
  );
}
