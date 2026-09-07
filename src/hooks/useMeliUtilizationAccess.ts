import { useAuth } from '../context/AuthContext';

import type { Role } from '../types';

const VIEW_ROLES: Role[] = [
  'Fleet Analyst',
  'Supervisor',
  'Coordinator',
  'Manager',
  'Director',
  'Admin Master',
];

export function useMeliUtilizationAccess(): { canView: boolean } {
  const { user, currentClient } = useAuth();
  const lastRouteClientId = import.meta.env.VITE_LAST_ROUTE_CLIENT_ID as string | undefined;
  const isMeliTenant = !!lastRouteClientId && currentClient?.id === lastRouteClientId;
  const role = user?.role;
  return { canView: isMeliTenant && !!role && VIEW_ROLES.includes(role) };
}
