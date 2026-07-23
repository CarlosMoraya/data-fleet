import { describe, it, expect } from 'vitest';

import { checklistFromRow, type ChecklistRow } from './checklistMappers';

const baseRow: ChecklistRow = {
  id: 'checklist-1',
  client_id: 'client-1',
  template_id: 'template-1',
  version_number: 1,
  vehicle_id: 'vehicle-1',
  filled_by: 'user-1',
  started_at: '2026-07-19T12:00:00Z',
  completed_at: null,
  status: 'in_progress',
  latitude: null,
  longitude: null,
  location_status: null,
  device_info: null,
  notes: null,
  workshop_id: null,
  odometer_km: null,
  odometer_photo_url: null,
  driver_id: null,
  cnh_photo_url: null,
  signature_url: null,
  vehicle_link_divergence_reasons: null,
  vehicle_link_assigned_driver_id: null,
  vehicle_link_executor_vehicle_id: null,
};

describe('checklistFromRow', () => {
  it('mapeia os campos novos de entrega/devolução quando presentes', () => {
    const row: ChecklistRow = {
      ...baseRow,
      driver_id: 'driver-1',
      cnh_photo_url: 'https://storage.example.com/cnh.jpg',
      signature_url: 'https://storage.example.com/assinatura.jpg',
      drivers: { name: 'João Motorista' },
    };

    const checklist = checklistFromRow(row);

    expect(checklist.driverId).toBe('driver-1');
    expect(checklist.driverName).toBe('João Motorista');
    expect(checklist.cnhPhotoUrl).toBe('https://storage.example.com/cnh.jpg');
    expect(checklist.signatureUrl).toBe('https://storage.example.com/assinatura.jpg');
  });

  it('mapeia o nome do motorista vinculado ao veículo quando presente', () => {
    const row: ChecklistRow = {
      ...baseRow,
      vehicles: { license_plate: 'ABC1D23', driver: { name: 'Jorge Santana' } },
    };

    const checklist = checklistFromRow(row);

    expect(checklist.vehicleDriverName).toBe('Jorge Santana');
  });

  it('sem motorista vinculado ao veículo resulta em undefined sem lançar erro', () => {
    const row: ChecklistRow = {
      ...baseRow,
      vehicles: { license_plate: 'ABC1D23' },
    };

    const checklist = checklistFromRow(row);

    expect(checklist.vehicleDriverName).toBeUndefined();
  });

  it('uma linha de histórico antigo (sem os campos novos) resulta em undefined sem lançar erro', () => {
    const checklist = checklistFromRow(baseRow);

    expect(checklist.driverId).toBeUndefined();
    expect(checklist.driverName).toBeUndefined();
    expect(checklist.cnhPhotoUrl).toBeUndefined();
    expect(checklist.signatureUrl).toBeUndefined();
  });
});

describe('checklistFromRow — divergência de vínculo', () => {
  it('mapeia os 5 campos de divergência quando presentes', () => {
    const row: ChecklistRow = {
      ...baseRow,
      vehicle_link_divergence_reasons: ['other_driver_assigned'],
      vehicle_link_assigned_driver_id: 'driver-2',
      vehicle_link_executor_vehicle_id: 'vehicle-2',
      assigned_driver: { name: 'Outro Motorista' },
      executor_vehicle: { license_plate: 'XYZ9A87' },
    };

    const checklist = checklistFromRow(row);

    expect(checklist.vehicleLinkDivergenceReasons).toEqual(['other_driver_assigned']);
    expect(checklist.vehicleLinkAssignedDriverId).toBe('driver-2');
    expect(checklist.vehicleLinkAssignedDriverName).toBe('Outro Motorista');
    expect(checklist.vehicleLinkExecutorVehicleId).toBe('vehicle-2');
    expect(checklist.vehicleLinkExecutorVehiclePlate).toBe('XYZ9A87');
  });

  it('linha de histórico anterior à migration (campos novos null) mapeia para undefined sem lançar', () => {
    const checklist = checklistFromRow(baseRow);

    expect(checklist.vehicleLinkDivergenceReasons).toBeUndefined();
    expect(checklist.vehicleLinkAssignedDriverId).toBeUndefined();
    expect(checklist.vehicleLinkAssignedDriverName).toBeUndefined();
    expect(checklist.vehicleLinkExecutorVehicleId).toBeUndefined();
    expect(checklist.vehicleLinkExecutorVehiclePlate).toBeUndefined();
  });
});
