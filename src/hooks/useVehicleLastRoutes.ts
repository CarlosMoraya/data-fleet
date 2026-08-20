import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { getVehicleLastRouteMap } from '../services/vehicleLastRouteService';

import type { VehicleLastRouteInfo } from '../services/vehicleLastRouteService';

export function useVehicleLastRoutes(): {
  showLastRoute: boolean;
  lastRouteMap: Map<string, VehicleLastRouteInfo>;
} {
  const { currentClient } = useAuth();
  const lastRouteClientId = import.meta.env.VITE_LAST_ROUTE_CLIENT_ID as string | undefined;
  const showLastRoute = !!lastRouteClientId && currentClient?.id === lastRouteClientId;
  const { data: lastRouteMap = new Map<string, VehicleLastRouteInfo>() } = useQuery({
    queryKey: ['vehicleLastRoutes', currentClient?.id],
    queryFn: getVehicleLastRouteMap,
    enabled: showLastRoute,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return { showLastRoute, lastRouteMap };
}
