export type UiStateScope = 'session' | 'preference' | 'draft';
export type UiStateKind = 'filter' | 'tab' | 'modal' | 'draft' | 'selection' | 'preference';

const KEY_PREFIX = 'bf:v1:ui';
const SENSITIVE_FIELD_DENYLIST = new Set([
  'password',
  'token',
  'cpf',
  'cnh',
  'license',
  'document',
  'upload',
  'file',
  'blob',
  'photo',
  'evidence',
  'budgetFile',
  'budgetPdf',
]);

export interface BuildKeyParams {
  scope: UiStateScope;
  userId: string;
  clientId: string | null;
  module: string;
  stateKind: UiStateKind;
  name: string;
}

export function buildUiStateKey(params: BuildKeyParams): string {
  const clientPart = params.clientId ?? 'all-clients';
  return `${KEY_PREFIX}:${params.scope}:${params.userId}:${clientPart}:${params.module}:${params.stateKind}:${params.name}`;
}

export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface ReadOptions<T> {
  validator?: (value: unknown) => value is T;
  legacyKeys?: string[];
}

export function readUiState<T>(
  storage: Storage,
  key: string,
  fallback: T,
  options?: ReadOptions<T>,
): T {
  const raw = storage.getItem(key);
  if (raw !== null) {
    const parsed = safeParseJson<T>(raw, fallback);
    if (options?.validator && !options.validator(parsed)) return fallback;
    return parsed;
  }

  if (options?.legacyKeys) {
    for (const legacyKey of options.legacyKeys) {
      const legacyRaw = storage.getItem(legacyKey);
      if (legacyRaw !== null) {
        const legacyParsed = safeParseJson<T>(legacyRaw, fallback);
        if (options?.validator && !options.validator(legacyParsed)) continue;
        storage.setItem(key, legacyRaw);
        storage.removeItem(legacyKey);
        return legacyParsed;
      }
    }
  }

  return fallback;
}

export interface WriteOptions {
  removeOnDefault?: boolean;
  removeLegacyKeys?: string[];
}

export function writeUiState<T>(
  storage: Storage,
  key: string,
  value: T,
  defaultValue: T,
  options?: WriteOptions,
): void {
  if (options?.removeOnDefault !== false && value === defaultValue) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, JSON.stringify(value));
  }

  if (options?.removeLegacyKeys) {
    for (const legacyKey of options.removeLegacyKeys) {
      storage.removeItem(legacyKey);
    }
  }
}

export function removeUiState(storage: Storage, key: string): void {
  storage.removeItem(key);
}

export function removeUiStateByPrefix(storage: Storage, prefix: string): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(prefix)) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    storage.removeItem(k);
  }
}

const MODULE_ALLOWLISTS: Record<string, Set<string>> = {
  vehicles: new Set([
    'plate', 'renavam', 'chassi', 'brand', 'model', 'year', 'color',
    'fleetNumber', 'axleConfigId', 'active', 'km', 'notes',
    'vehicleType', 'fuelType', 'acquisitionDate', 'carrierType',
  ]),
  drivers: new Set([
    'name', 'phone', 'active', 'licenseCategory', 'licenseNumber',
    'notes',
  ]),
  maintenance: new Set([
    'vehicleId', 'description', 'status', 'priority', 'maintenanceType',
    'scheduledDate', 'startDate', 'completionDate', 'notes', 'cost',
    'supplier', 'workshopId', 'items',
  ]),
  tires: new Set([
    'brand', 'model', 'size', 'dot', 'purchaseDate', 'active',
    'position', 'vehicleId', 'tireType', 'notes',
  ]),
  checklists: new Set<string>([]),
  dashboard: new Set<string>([]),
  workshops: new Set([
    'name', 'cnpj', 'phone', 'email', 'address', 'active', 'specialties',
    'notes',
  ]),
  shippers: new Set([
    'name', 'cnpj', 'phone', 'email', 'address', 'active', 'notes',
  ]),
  operationalUnits: new Set([
    'name', 'city', 'state', 'active', 'notes',
  ]),
  scheduleForm: new Set([
    'vehicleId', 'description', 'scheduledDate', 'status', 'notes',
  ]),
};

function isSensitiveFieldName(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  for (const denied of SENSITIVE_FIELD_DENYLIST) {
    if (lower.includes(denied)) return true;
  }
  return false;
}

export function sanitizeDraft(module: string, value: Record<string, unknown>): Record<string, unknown> {
  const allowlist = MODULE_ALLOWLISTS[module];
  if (!allowlist) return {};
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveFieldName(key)) continue;
    if (!allowlist.has(key)) continue;
    if (val instanceof File || val instanceof Blob) continue;
    result[key] = val;
  }
  return result;
}

export function clearCurrentUserUiState(userId: string): void {
  const sessionPrefix = `${KEY_PREFIX}:session:${userId}:`;
  const draftPrefix = `${KEY_PREFIX}:draft:${userId}:`;
  removeUiStateByPrefix(window.sessionStorage, sessionPrefix);
  removeUiStateByPrefix(window.sessionStorage, draftPrefix);

  const legacyKeys = [
    'vehicleFormOpen', 'vehicleFormEditing', 'vehicleFormData',
    'driverFormOpen', 'driverFormEditing', 'driverFormData', 'driverFormEmail', 'driverFormPassword',
    'maintenanceFormOpen', 'maintenanceFormEditing', 'maintenanceFormData',
    'tireFormOpen', 'tireFormEditing', 'tireFormVehicle',
    'checklists:activeTab',
    'checklistTemplateFormOpen', 'checklistTemplateFormEditing',
    'scheduleFormOpen', 'scheduleFormEditing', 'scheduleFormData',
    'workshopFormOpen', 'workshopFormEditing', 'workshopFormData',
    'shipperFormOpen', 'shipperFormEditing', 'shipperFormData',
    'operationalUnitFormOpen', 'operationalUnitFormEditing', 'operationalUnitFormData',
  ];
  for (const key of legacyKeys) {
    window.sessionStorage.removeItem(key);
  }

  window.localStorage.removeItem('dashboard_date_filter');
  window.localStorage.removeItem('workshop_active_client');
  window.localStorage.removeItem('adminMasterActiveClient');
}

export function clearClientUiState(userId: string, clientId: string): void {
  const prefixes = [
    `${KEY_PREFIX}:session:${userId}:${clientId}:`,
    `${KEY_PREFIX}:draft:${userId}:${clientId}:`,
    `${KEY_PREFIX}:preference:${userId}:${clientId}:`,
  ];
  for (const prefix of prefixes) {
    removeUiStateByPrefix(window.sessionStorage, prefix);
  }
}