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

const SYNC_ROLES: Role[] = ['Manager', 'Coordinator', 'Director', 'Admin Master'];

/**
 * Gate de tenant e de papel do módulo de Abastecimento.
 * Esconder o botão de sync no frontend é conveniência de UI — a barreira real
 * é `hasSyncPermission` na Edge Function.
 */
export function useFuelSupplyAccess(): { canView: boolean; canSync: boolean } {
  const { user, currentClient } = useAuth();
  const veloeClientId = import.meta.env.VITE_VELOE_CLIENT_ID as string | undefined;
  const isVeloeTenant = !!veloeClientId && currentClient?.id === veloeClientId;

  const role = user?.role;
  const canView = isVeloeTenant && !!role && VIEW_ROLES.includes(role);
  const canSync = canView && !!role && SYNC_ROLES.includes(role);

  return { canView, canSync };
}
