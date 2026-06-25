import type { Role } from '../types';

export const ROLE_RANK: Record<Role, number> = {
  'Driver': 0,
  'Yard Auditor': 1,
  'Workshop': 2,
  'Fleet Assistant': 3,
  'Fleet Analyst': 4,
  'Supervisor': 5,
  'Operations Manager': 5,
  'Coordinator': 6,
  'Manager': 7,
  'Director': 8,
  'Admin Master': 9,
};

export const ROLE_LABELS: Record<Role, string> = {
  'Driver': 'Driver',
  'Yard Auditor': 'Yard Auditor',
  'Workshop': 'Workshop',
  'Fleet Assistant': 'Fleet Assistant',
  'Fleet Analyst': 'Fleet Analyst',
  'Supervisor': 'Supervisor',
  'Operations Manager': 'Gestor de Operações',
  'Coordinator': 'Coordinator',
  'Manager': 'Manager',
  'Director': 'Director',
  'Admin Master': 'Admin Master',
};

export const ROLE_COLORS: Record<Role, string> = {
  'Driver': 'bg-zinc-100 text-zinc-700',
  'Workshop': 'bg-orange-100 text-orange-700',
  'Yard Auditor': 'bg-amber-100 text-amber-700',
  'Fleet Assistant': 'bg-blue-100 text-blue-700',
  'Fleet Analyst': 'bg-indigo-100 text-indigo-700',
  'Supervisor': 'bg-violet-100 text-violet-700',
  'Operations Manager': 'bg-cyan-100 text-cyan-700',
  'Coordinator': 'bg-emerald-100 text-emerald-700',
  'Manager': 'bg-green-100 text-green-700',
  'Director': 'bg-purple-100 text-purple-700',
  'Admin Master': 'bg-orange-100 text-orange-700',
};

export const ROLES_WITH_ACCESS: Role[] = [
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Operations Manager',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

export const ROLES_CAN_CREATE: Role[] = [...ROLES_WITH_ACCESS];

export const ROLES_CAN_EDIT: Role[] = [
  'Fleet Analyst',
  'Supervisor',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

export const ROLES_CAN_DELETE: Role[] = [
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

export const ROLES_CAN_APPROVE_BUDGET: Role[] = [
  'Fleet Analyst',
  'Supervisor',
  'Manager',
  'Coordinator',
  'Director',
  'Admin Master',
];

export const ROLES_CAN_CORRECT_ODOMETER: Role[] = ['Coordinator', 'Manager', 'Director', 'Admin Master'];

export const TENANT_USER_ROLE_OPTIONS: Role[] = [
  'Driver',
  'Yard Auditor',
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
  'Operations Manager',
  'Coordinator',
  'Manager',
  'Director',
  'Admin Master',
];

const OPERATIONS_MANAGER_ALLOWED_ROUTES = ['/agendamentos', '/manutencao', '/conta/senha'] as const;

export function hasRoleAccess(role: Role | undefined): boolean {
  return ROLES_WITH_ACCESS.includes(role);
}

export function canCreate(role: Role | undefined): boolean {
  return ROLES_CAN_CREATE.includes(role);
}

export function canEdit(role: Role | undefined): boolean {
  return ROLES_CAN_EDIT.includes(role);
}

export function canDelete(role: Role | undefined): boolean {
  return ROLES_CAN_DELETE.includes(role);
}

export function getRoleRank(role: Role | undefined): number {
  return ROLE_RANK[role] ?? -1;
}

export function getRoleLabel(role: Role | undefined): string {
  return role ? ROLE_LABELS[role] ?? role : '';
}

export function isOperationsManager(role: Role | null | undefined): role is 'Operations Manager' {
  return role === 'Operations Manager';
}

export function canManageOperationsManagerScope(role: Role | null | undefined): boolean {
  return role === 'Coordinator' || role === 'Manager' || role === 'Director' || role === 'Admin Master';
}

export function canCorrectOdometer(role: Role | undefined | null): boolean {
  return ROLES_CAN_CORRECT_ODOMETER.includes(role);
}

export function canAccessOperationsReadonlyModules(role: Role | null | undefined): boolean {
  return isOperationsManager(role);
}

export function getCreatableRoles(role: Role): Role[] {
  const myRank = ROLE_RANK[role];

  return TENANT_USER_ROLE_OPTIONS.filter((candidate) => {
    if (candidate === 'Operations Manager') {
      return canManageOperationsManagerScope(role);
    }

    return ROLE_RANK[candidate] < myRank;
  });
}

export function getDefaultRouteForRole(role: Role | null | undefined): string {
  if (role === 'Driver' || role === 'Yard Auditor') return '/checklists';
  if (role === 'Workshop') return '/manutencao';
  if (role === 'Operations Manager') return '/agendamentos';
  return '/';
}

export function canAccessRoute(role: Role | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (!isOperationsManager(role)) return true;

  return OPERATIONS_MANAGER_ALLOWED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function canEditWorkshopOrder(role: Role | undefined | null): boolean {
  return role === 'Workshop';
}

export function canViewPartPhotos(role: Role | undefined | null): boolean {
  return role === 'Workshop' || getRoleRank(role ?? undefined) >= ROLE_RANK['Fleet Assistant'];
}

export function canManagePartPhotos(role: Role | undefined | null): boolean {
  return getRoleRank(role ?? undefined) >= ROLE_RANK['Fleet Assistant'];
}
