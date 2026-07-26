export const OPEN_RECORD_PARAM = 'open';
export const VEHICLES_REGISTRY_ROUTE = '/cadastros/veiculos';
export const DRIVERS_REGISTRY_ROUTE = '/cadastros/motoristas';

export function buildVehicleRecordLink(vehicleId: string): string {
  return `${VEHICLES_REGISTRY_ROUTE}?${OPEN_RECORD_PARAM}=${encodeURIComponent(vehicleId)}`;
}

export function buildDriverRecordLink(driverId: string): string {
  return `${DRIVERS_REGISTRY_ROUTE}?${OPEN_RECORD_PARAM}=${encodeURIComponent(driverId)}`;
}

export function parseOpenRecordId(params: URLSearchParams): string | null {
  const value = params.get(OPEN_RECORD_PARAM)?.trim();
  return value || null;
}

export function withoutOpenRecordParam(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(OPEN_RECORD_PARAM);
  return next;
}
