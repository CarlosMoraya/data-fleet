import { invokeEdgeFunction } from '../lib/invokeEdgeFn';

import type { MeliRouteEntry } from '../types/meliUtilization';

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isMeliRouteEntry(value: unknown): value is MeliRouteEntry {
  if (value === null || typeof value !== 'object') return false;
  const route = value as Record<string, unknown>;
  return (
    typeof route.plate === 'string' &&
    typeof route.routeDate === 'string' &&
    typeof route.routeId === 'string' &&
    isNullableString(route.driverName) &&
    typeof route.serviceCenter === 'string' &&
    isNullableString(route.cycle) &&
    isNullableNumber(route.odometerDistanceKm)
  );
}

export async function getMeliRouteHistory(range: {
  from: string;
  to: string;
}): Promise<MeliRouteEntry[]> {
  const response = await invokeEdgeFunction('vehicle-last-routes', {
    mode: 'history',
    from: range.from,
    to: range.to,
  });
  if (response === null || typeof response !== 'object' || !('routes' in response)) return [];
  const { routes } = response as { routes?: unknown };
  if (!Array.isArray(routes)) return [];
  return routes.filter(isMeliRouteEntry);
}
