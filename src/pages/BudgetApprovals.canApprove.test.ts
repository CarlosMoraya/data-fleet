import { describe, it, expect } from 'vitest';
import { canApprove } from './BudgetApprovals';
import type { User } from '../types';

const alwaysApproveRoles: Array<User['role']> = ['Coordinator', 'Director', 'Admin Master'];

describe('canApprove', () => {
  const makeUser = (role: User['role'], limit: number): User => ({
    id: 'u1',
    name: 'Test',
    email: 'test@test.com',
    role,
    clientId: 'c1',
    canDeleteVehicles: false,
    canDeleteDrivers: false,
    canDeleteWorkshops: false,
    budgetApprovalLimit: limit,
  });

  describe('ALWAYS_APPROVE_ROLES', () => {
    for (const role of alwaysApproveRoles) {
      it(`${role} returns true regardless of value, loading, or items`, () => {
        const user = makeUser(role, 0);
        expect(canApprove(user, 99999, { itemsLoading: true, hasItems: false })).toBe(true);
        expect(canApprove(user, 0, { itemsLoading: false, hasItems: false })).toBe(true);
        expect(canApprove(user, 500, { itemsLoading: false, hasItems: true })).toBe(true);
      });
    }
  });

  describe('Fleet Assistant with budgetApprovalLimit = 1500', () => {
    const user = makeUser('Fleet Assistant', 1500);

    it('returns false when subtotal=0, itemsLoading=true, hasItems=false', () => {
      expect(canApprove(user, 0, { itemsLoading: true, hasItems: false })).toBe(false);
    });

    it('returns false when subtotal=0, itemsLoading=false, hasItems=false', () => {
      expect(canApprove(user, 0, { itemsLoading: false, hasItems: false })).toBe(false);
    });

    it('returns false when subtotal=1500.01, itemsLoading=false, hasItems=true (above limit)', () => {
      expect(canApprove(user, 1500.01, { itemsLoading: false, hasItems: true })).toBe(false);
    });

    it('returns true when subtotal=1500, itemsLoading=false, hasItems=true (at limit)', () => {
      expect(canApprove(user, 1500, { itemsLoading: false, hasItems: true })).toBe(true);
    });

    it('returns false when subtotal=1, itemsLoading=true, hasItems=true (loading blocks)', () => {
      expect(canApprove(user, 1, { itemsLoading: true, hasItems: true })).toBe(false);
    });
  });

  describe('User with budgetApprovalLimit = 0 (no approval power)', () => {
    const user = makeUser('Fleet Assistant', 0);

    it('returns false even with valid items and subtotal', () => {
      expect(canApprove(user, 100, { itemsLoading: false, hasItems: true })).toBe(false);
    });

    it('returns false when no items', () => {
      expect(canApprove(user, 0, { itemsLoading: false, hasItems: false })).toBe(false);
    });
  });
});