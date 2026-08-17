import { formatDate } from '../lib/dateUtils';
import { filterPlate } from '../lib/inputHelpers';
import { invokeEdgeFunction } from '../lib/invokeEdgeFn';

export interface VehicleLastRouteInfo {
  lastRouteDate: string;
  routeId: string;
}

export function normalizeFleetPlate(value: string | null | undefined): string {
  return filterPlate(value ?? '').slice(-7);
}

export async function getVehicleLastRouteMap(): Promise<Map<string, VehicleLastRouteInfo>> {
  const map = new Map<string, VehicleLastRouteInfo>();
  const response = await invokeEdgeFunction('vehicle-last-routes', {});
  if (response == null || typeof response !== 'object' || !('routes' in response)) return map;

  const { routes } = response as { routes?: unknown };
  if (!Array.isArray(routes)) return map;

  for (const route of routes) {
    if (route == null || typeof route !== 'object') continue;
    const { plate, lastRouteDate, routeId } = route as Record<string, unknown>;
    if (typeof plate !== 'string' || typeof lastRouteDate !== 'string' || typeof routeId !== 'string') continue;
    const normalizedPlate = normalizeFleetPlate(plate);
    if (normalizedPlate) map.set(normalizedPlate, { lastRouteDate, routeId });
  }

  return map;
}

export function buildLastRouteText(
  info: VehicleLastRouteInfo | null | undefined
): string | null {
  if (info == null) return null;
  return `Últ. rota ${formatDate(info.lastRouteDate)} · #${info.routeId}`;
}
