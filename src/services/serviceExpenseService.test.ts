import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import {
  createExtraPaymentRequest,
  getNextExtraPaymentRequestNumber,
  listExtraPaymentDrivers,
  listExtraPaymentVehicles,
} from './serviceExpenseService';

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe('getNextExtraPaymentRequestNumber', () => {
  it('chama a RPC correta com o client_id', async () => {
    rpcMock.mockResolvedValue({ data: 'PE-2607-0001', error: null });

    const result = await getNextExtraPaymentRequestNumber('client-1');

    expect(result).toBe('PE-2607-0001');
    expect(rpcMock).toHaveBeenCalledWith('next_extra_payment_request_number', {
      p_client_id: 'client-1',
    });
  });
});

describe('createExtraPaymentRequest', () => {
  it('não envia campos de auditoria manual (approved_by/rejected_by/paid_by)', async () => {
    rpcMock.mockResolvedValue({ data: 'PE-2607-0001', error: null });
    const insertMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'epr-1' }, error: null });
    fromMock.mockReturnValue({ insert: insertMock, select: selectMock, single: singleMock });

    const id = await createExtraPaymentRequest({
      input: {
        category: 'guincho',
        serviceDate: '2026-07-10',
        supplierName: 'Guincho Rápido LTDA',
        amount: 350,
      },
      clientId: 'client-1',
      userId: 'user-1',
    });

    expect(id).toBe('epr-1');
    const insertedPayload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedPayload).not.toHaveProperty('approved_by');
    expect(insertedPayload).not.toHaveProperty('rejected_by');
    expect(insertedPayload).not.toHaveProperty('paid_by');
    expect(insertedPayload.status).toBe('pendente_aprovacao');
    expect(insertedPayload.request_number).toBe('PE-2607-0001');
  });
});

describe('listExtraPaymentVehicles', () => {
  it('retorna placa e motorista vinculado', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      data: [
        { id: 'v1', license_plate: 'ABC1D23', driver_id: 'd1', drivers: { name: 'João Motorista' } },
        { id: 'v2', license_plate: 'XYZ9K88', driver_id: null, drivers: null },
      ],
      error: null,
    };
    fromMock.mockReturnValue(query);

    const result = await listExtraPaymentVehicles('client-1');

    expect(result).toEqual([
      { id: 'v1', licensePlate: 'ABC1D23', driverId: 'd1', driverName: 'João Motorista' },
      { id: 'v2', licensePlate: 'XYZ9K88', driverId: undefined, driverName: undefined },
    ]);
  });
});

describe('listExtraPaymentDrivers', () => {
  it('retorna motorista e placa vinculada', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      data: [
        { id: 'd1', name: 'João Motorista', vehicles: { id: 'v1', license_plate: 'ABC1D23' } },
        { id: 'd2', name: 'Maria Motorista', vehicles: null },
      ],
      error: null,
    };
    fromMock.mockReturnValue(query);

    const result = await listExtraPaymentDrivers('client-1');

    expect(result).toEqual([
      { id: 'd1', name: 'João Motorista', vehicleId: 'v1', vehicleLicensePlate: 'ABC1D23' },
      { id: 'd2', name: 'Maria Motorista', vehicleId: undefined, vehicleLicensePlate: undefined },
    ]);
  });
});
