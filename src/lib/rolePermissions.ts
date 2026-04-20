import type { Role } from '../types';

// ─── Hierarquia de roles (para aprovação e ordenação) ─────────────────────────

export const ROLE_RANK: Record<Role, number> = {
  'Driver': 0,
  'Yard Auditor': 1,
  'Workshop': 2,
  'Fleet Assistant': 3,
  'Fleet Analyst': 4,
  'Supervisor': 5,
  'Coordinator': 6,
  'Manager': 7,
  'Director': 8,
  'Admin Master': 9,
};

// ─── Controle de acesso por role ──────────────────────────────────────────────

export const ROLES_WITH_ACCESS: Role[] = [
  'Fleet Assistant',
  'Fleet Analyst',
  'Supervisor',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasRoleAccess(role: Role | undefined): boolean {
  return ROLES_WITH_ACCESS.includes(role as Role);
}

export function canCreate(role: Role | undefined): boolean {
  return ROLES_CAN_CREATE.includes(role as Role);
}

export function canEdit(role: Role | undefined): boolean {
  return ROLES_CAN_EDIT.includes(role as Role);
}

export function canDelete(role: Role | undefined): boolean {
  return ROLES_CAN_DELETE.includes(role as Role);
}

export function getRoleRank(role: Role | undefined): number {
  return ROLE_RANK[role as Role] ?? -1;
}
