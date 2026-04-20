import { describe, it, expect } from 'vitest';
import {
  tireInspectionFromRow,
  tireInspectionResponseFromRow,
  tireInspectionResponseToRow,
  type TireInspectionRow,
  type TireInspectionResponseRow,
} from './tireInspectionMappers';
import type { TireInspectionResponse } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseInspectionRow: TireInspectionRow = {
  id: 'insp-1',
  client_id: 'client-1',
  vehicle_id: 'veh-1',
  filled_by: 'user-1',
  started_at: '2026-04-12T10:00:00Z',
  completed_at: null,
  status: 'in_progress',
  odometer_km: null,
  latitude: null,
  longitude: null,
  device_info: null,
  notes: null,
  axle_config_snapshot: [
    { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
    { order: 2, type: 'simples', rodagem: 'dupla', physicalAxles: 1 },
  ],
  steps_count_snapshot: 1,
};

const baseResponseRow: TireInspectionResponseRow = {
  id: 'resp-1',
  inspection_id: 'insp-1',
  tire_id: 'tire-1',
  position_code: 'E1',
  position_label: 'Eixo 1 Esquerdo',
  dot: '1234',
  fire_marking: 'MF001',
  manufacturer: 'Michelin',
  brand: 'X Line Energy',
  photo_url: 'https://storage.example.com/photo.jpg',
  photo_timestamp: '2026-04-12T10:05:00Z',
  status: 'conforme',
  observation: 'Pneu em bom estado',
  responded_at: '2026-04-12T10:05:30Z',
};

// ─── tireInspectionFromRow ────────────────────────────────────────────────────

describe('tireInspectionFromRow', () => {
  it('converte campos obrigatórios snake_case → camelCase', () => {
    const result = tireInspectionFromRow(baseInspectionRow);

    expect(result.id).toBe('insp-1');
    expect(result.clientId).toBe('client-1');
    expect(result.vehicleId).toBe('veh-1');
    expect(result.filledBy).toBe('user-1');
    expect(result.startedAt).toBe('2026-04-12T10:00:00Z');
    expect(result.status).toBe('in_progress');
    expect(result.stepsCountSnapshot).toBe(1);
  });

  it('passa axle_config_snapshot intacto sem serialização dupla', () => {
    const result = tireInspectionFromRow(baseInspectionRow);

    expect(result.axleConfigSnapshot).toEqual([
      { order: 1, type: 'direcional', rodagem: 'simples', physicalAxles: 1 },
      { order: 2, type: 'simples', rodagem: 'dupla', physicalAxles: 1 },
    ]);
  });

  it('converte campos nullable para undefined quando null', () => {
    const result = tireInspectionFromRow(baseInspectionRow);

    expect(result.completedAt).toBeUndefined();
    expect(result.odometerKm).toBeUndefined();
    expect(result.latitude).toBeUndefined();
    expect(result.longitude).toBeUndefined();
    expect(result.deviceInfo).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('extrai join fields de vehicles e profiles', () => {
    const rowWithJoins: TireInspectionRow = {
      ...baseInspectionRow,
      vehicles: { license_plate: 'ABC1D23' },
      profiles: { name: 'João Silva' },
    };

    const result = tireInspectionFromRow(rowWithJoins);

    expect(result.vehicleLicensePlate).toBe('ABC1D23');
    expect(result.filledByName).toBe('João Silva');
  });

  it('join fields ausentes retornam undefined', () => {
    const result = tireInspectionFromRow(baseInspectionRow);

    expect(result.vehicleLicensePlate).toBeUndefined();
    expect(result.filledByName).toBeUndefined();
  });

  it('converte inspeção completada com todos os campos preenchidos', () => {
    const completedRow: TireInspectionRow = {
      ...baseInspectionRow,
      completed_at: '2026-04-12T11:30:00Z',
      status: 'completed',
      odometer_km: 125000,
      latitude: -23.5505,
      longitude: -46.6333,
      device_info: 'iPhone 15',
      notes: 'Inspeção sem anomalias',
    };

    const result = tireInspectionFromRow(completedRow);

    expect(result.completedAt).toBe('2026-04-12T11:30:00Z');
    expect(result.status).toBe('completed');
    expect(result.odometerKm).toBe(125000);
    expect(result.latitude).toBe(-23.5505);
    expect(result.longitude).toBe(-46.6333);
    expect(result.deviceInfo).toBe('iPhone 15');
    expect(result.notes).toBe('Inspeção sem anomalias');
  });
});

// ─── tireInspectionResponseFromRow ───────────────────────────────────────────

describe('tireInspectionResponseFromRow', () => {
  it('converte campos obrigatórios snake_case → camelCase', () => {
    const result = tireInspectionResponseFromRow(baseResponseRow);

    expect(result.id).toBe('resp-1');
    expect(result.inspectionId).toBe('insp-1');
    expect(result.tireId).toBe('tire-1');
    expect(result.positionCode).toBe('E1');
    expect(result.positionLabel).toBe('Eixo 1 Esquerdo');
    expect(result.manufacturer).toBe('Michelin');
    expect(result.brand).toBe('X Line Energy');
    expect(result.photoUrl).toBe('https://storage.example.com/photo.jpg');
    expect(result.photoTimestamp).toBe('2026-04-12T10:05:00Z');
    expect(result.status).toBe('conforme');
    expect(result.respondedAt).toBe('2026-04-12T10:05:30Z');
  });

  it('converte campos opcionais quando presentes', () => {
    const result = tireInspectionResponseFromRow(baseResponseRow);

    expect(result.dot).toBe('1234');
    expect(result.fireMarking).toBe('MF001');
    expect(result.observation).toBe('Pneu em bom estado');
  });

  it('converte tire_id null → undefined', () => {
    const rowWithoutTire: TireInspectionResponseRow = {
      ...baseResponseRow,
      tire_id: null,
    };

    const result = tireInspectionResponseFromRow(rowWithoutTire);

    expect(result.tireId).toBeUndefined();
  });

  it('converte campos opcionais null → undefined', () => {
    const rowMinimal: TireInspectionResponseRow = {
      ...baseResponseRow,
      tire_id: null,
      dot: null,
      fire_marking: null,
      observation: null,
    };

    const result = tireInspectionResponseFromRow(rowMinimal);

    expect(result.tireId).toBeUndefined();
    expect(result.dot).toBeUndefined();
    expect(result.fireMarking).toBeUndefined();
    expect(result.observation).toBeUndefined();
  });

  it('converte status nao_conforme corretamente', () => {
    const naoConformeRow: TireInspectionResponseRow = {
      ...baseResponseRow,
      status: 'nao_conforme',
      observation: 'Desgaste irregular detectado',
    };

    const result = tireInspectionResponseFromRow(naoConformeRow);

    expect(result.status).toBe('nao_conforme');
    expect(result.observation).toBe('Desgaste irregular detectado');
  });
});

// ─── tireInspectionResponseToRow ─────────────────────────────────────────────

describe('tireInspectionResponseToRow', () => {
  it('converte campos obrigatórios camelCase → snake_case', () => {
    const response: Omit<TireInspectionResponse, 'id'> = {
      inspectionId: 'insp-1',
      tireId: 'tire-1',
      positionCode: 'D2IN',
      positionLabel: 'Eixo 2 Direito Interno',
      dot: '5678',
      fireMarking: 'MF002',
      manufacturer: 'Bridgestone',
      brand: 'R168',
      photoUrl: 'https://storage.example.com/d2in.jpg',
      photoTimestamp: '2026-04-12T10:10:00Z',
      status: 'conforme',
      observation: 'OK',
      respondedAt: '2026-04-12T10:10:30Z',
    };

    const result = tireInspectionResponseToRow(response);

    expect(result.inspection_id).toBe('insp-1');
    expect(result.tire_id).toBe('tire-1');
    expect(result.position_code).toBe('D2IN');
    expect(result.position_label).toBe('Eixo 2 Direito Interno');
    expect(result.dot).toBe('5678');
    expect(result.fire_marking).toBe('MF002');
    expect(result.manufacturer).toBe('Bridgestone');
    expect(result.brand).toBe('R168');
    expect(result.photo_url).toBe('https://storage.example.com/d2in.jpg');
    expect(result.photo_timestamp).toBe('2026-04-12T10:10:00Z');
    expect(result.status).toBe('conforme');
    expect(result.observation).toBe('OK');
    expect(result.responded_at).toBe('2026-04-12T10:10:30Z');
  });

  it('converte tireId undefined → null', () => {
    const response: Omit<TireInspectionResponse, 'id'> = {
      inspectionId: 'insp-1',
      positionCode: 'Step 1',
      positionLabel: 'Estepe 1',
      manufacturer: 'Outros / Não é possível identificar',
      brand: 'Outros / Não é possível identificar',
      photoUrl: 'https://storage.example.com/step1.jpg',
      photoTimestamp: '2026-04-12T10:15:00Z',
      status: 'conforme',
      respondedAt: '2026-04-12T10:15:30Z',
    };

    const result = tireInspectionResponseToRow(response);

    expect(result.tire_id).toBeNull();
  });

  it('converte campos opcionais undefined → null', () => {
    const response: Omit<TireInspectionResponse, 'id'> = {
      inspectionId: 'insp-1',
      positionCode: 'E1',
      positionLabel: 'Eixo 1 Esquerdo',
      manufacturer: 'Michelin',
      brand: 'X Line',
      photoUrl: 'https://storage.example.com/e1.jpg',
      photoTimestamp: '2026-04-12T10:20:00Z',
      status: 'nao_conforme',
      respondedAt: '2026-04-12T10:20:30Z',
    };

    const result = tireInspectionResponseToRow(response);

    expect(result.dot).toBeNull();
    expect(result.fire_marking).toBeNull();
    expect(result.observation).toBeNull();
  });
});
