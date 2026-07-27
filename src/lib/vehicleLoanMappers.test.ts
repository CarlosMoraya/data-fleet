import { describe, it, expect } from 'vitest';
import { vehicleLoanFromRow, vehicleLoanFromRpcRow } from './vehicleLoanMappers';
import type { VehicleLoanRow, VehicleLoanRpcRow } from './vehicleLoanMappers';

describe('vehicleLoanMappers', () => {
  describe('vehicleLoanFromRow', () => {
    it('mapeia row completa via JOIN drivers(name)', () => {
      const row: VehicleLoanRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: '2026-07-27T10:00:00Z',
        delivery_checklist_id: 'ck-del',
        return_checklist_id: 'ck-ret',
        status: 'completed',
        notes: 'emprestimo para rota extra',
        ended_notes: 'devolucao normal',
        created_by: 'u1',
        ended_by: 'u2',
        ended_reason: 'return_checklist',
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-27T10:00:00Z',
        drivers: { name: 'João' },
      };

      const loan = vehicleLoanFromRow(row);
      expect(loan.id).toBe('l1');
      expect(loan.clientId).toBe('c1');
      expect(loan.vehicleId).toBe('v1');
      expect(loan.driverId).toBe('d1');
      expect(loan.driverName).toBe('João');
      expect(loan.startedAt).toBe('2026-07-26T10:00:00Z');
      expect(loan.endedAt).toBe('2026-07-27T10:00:00Z');
      expect(loan.deliveryChecklistId).toBe('ck-del');
      expect(loan.returnChecklistId).toBe('ck-ret');
      expect(loan.status).toBe('completed');
      expect(loan.notes).toBe('emprestimo para rota extra');
      expect(loan.endedNotes).toBe('devolucao normal');
      expect(loan.createdBy).toBe('u1');
      expect(loan.endedBy).toBe('u2');
      expect(loan.endedReason).toBe('return_checklist');
    });

    it('trata drivers como array (PostgREST às vezes retorna array), pega o primeiro', () => {
      const row: VehicleLoanRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: null,
        delivery_checklist_id: null,
        return_checklist_id: null,
        status: 'active',
        notes: 'xxxxxxxxxx',
        ended_notes: null,
        created_by: 'u1',
        ended_by: null,
        ended_reason: null,
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-26T10:00:00Z',
        drivers: [{ name: 'Maria' }],
      };
      expect(vehicleLoanFromRow(row).driverName).toBe('Maria');
    });

    it('trata campos nulos (ended_at, return_checklist_id) e driverName undefined', () => {
      const row: VehicleLoanRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: null,
        delivery_checklist_id: null,
        return_checklist_id: null,
        status: 'active',
        notes: 'xxxxxxxxxx',
        ended_notes: null,
        created_by: 'u1',
        ended_by: null,
        ended_reason: null,
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-26T10:00:00Z',
        drivers: null,
      };
      const loan = vehicleLoanFromRow(row);
      expect(loan.endedAt).toBeNull();
      expect(loan.returnChecklistId).toBeNull();
      expect(loan.deliveryChecklistId).toBeNull();
      expect(loan.driverName).toBeUndefined();
      expect(loan.endedReason).toBeNull();
    });
  });

  describe('vehicleLoanFromRpcRow', () => {
    it('mapeia driver_name retornado pela RPC get_active_vehicle_loan', () => {
      const row: VehicleLoanRpcRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: null,
        delivery_checklist_id: 'ck-del',
        return_checklist_id: null,
        status: 'active',
        notes: 'xxxxxxxxxx',
        ended_notes: null,
        created_by: 'u1',
        ended_by: null,
        ended_reason: null,
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-26T10:00:00Z',
        driver_name: 'Carlos',
      };
      const loan = vehicleLoanFromRpcRow(row);
      expect(loan.driverName).toBe('Carlos');
      expect(loan.status).toBe('active');
    });

    it('trata driver_name null', () => {
      const row: VehicleLoanRpcRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: null,
        delivery_checklist_id: null,
        return_checklist_id: null,
        status: 'active',
        notes: 'xxxxxxxxxx',
        ended_notes: null,
        created_by: 'u1',
        ended_by: null,
        ended_reason: null,
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-26T10:00:00Z',
        driver_name: null,
      };
      expect(vehicleLoanFromRpcRow(row).driverName).toBeUndefined();
    });

    it('mapeia created_by_name, ended_by_name, delivery_checklist_at e return_checklist_at', () => {
      const row: VehicleLoanRpcRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: '2026-07-27T10:00:00Z',
        delivery_checklist_id: 'ck-del',
        return_checklist_id: 'ck-ret',
        status: 'completed',
        notes: 'xxxxxxxxxx',
        ended_notes: 'troca autorizada',
        created_by: 'u1',
        created_by_name: 'Ana Coordenadora',
        ended_by: 'u2',
        ended_by_name: 'Bruno Gerente',
        ended_reason: 'driver_changed',
        delivery_checklist_at: '2026-07-26T10:30:00Z',
        return_checklist_at: null,
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-27T10:00:00Z',
        driver_name: 'Carlos',
      };
      const loan = vehicleLoanFromRpcRow(row);
      expect(loan.createdByName).toBe('Ana Coordenadora');
      expect(loan.endedByName).toBe('Bruno Gerente');
      expect(loan.deliveryChecklistAt).toBe('2026-07-26T10:30:00Z');
      expect(loan.returnChecklistAt).toBeNull();
    });

    it('trata nomes/datas nulos (Auditor/RLS de profiles bloqueando)', () => {
      const row: VehicleLoanRpcRow = {
        id: 'l1',
        client_id: 'c1',
        vehicle_id: 'v1',
        driver_id: 'd1',
        started_at: '2026-07-26T10:00:00Z',
        ended_at: null,
        delivery_checklist_id: null,
        return_checklist_id: null,
        status: 'active',
        notes: 'xxxxxxxxxx',
        ended_notes: null,
        created_by: 'u1',
        created_by_name: null,
        ended_by: null,
        ended_by_name: null,
        ended_reason: null,
        delivery_checklist_at: null,
        return_checklist_at: null,
        created_at: '2026-07-26T10:00:00Z',
        updated_at: '2026-07-26T10:00:00Z',
        driver_name: null,
      };
      const loan = vehicleLoanFromRpcRow(row);
      expect(loan.createdByName).toBeNull();
      expect(loan.endedByName).toBeNull();
      expect(loan.deliveryChecklistAt).toBeNull();
      expect(loan.returnChecklistAt).toBeNull();
    });
  });
});