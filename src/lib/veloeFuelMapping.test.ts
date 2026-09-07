import { describe, expect, it } from 'vitest';

import {
  buildExternalKey,
  mapVeloeSupplyToRow,
  maskCardLast4,
  normalizeVeloePlate,
  parseVeloeDateTime,
  parseVeloeDecimal,
} from '../../supabase/functions/veloe-fuel-sync/veloeMapping';

import type { VeloeSupplyRecord } from '../../supabase/functions/veloe-fuel-sync/veloeMapping';

const CLIENT_ID = '11111111-1111-1111-1111-111111111111';

/** Registro de exemplo do PDF "API fuel-supply-data" v1.4.0. */
function pdfRecord(overrides: Partial<VeloeSupplyRecord> = {}): VeloeSupplyRecord {
  return {
    corporateName: 'TESTE TRANSPORTE E SERVICOS S.A.',
    vehiclePlate: 'ABC1D23',
    vehicleModel: 'ONIX',
    costCenter: 'OO1',
    driverName: 'JOSE DA SILVA',
    registry: '10203012345',
    card: '5060708090123456',
    fuelType: 'GASOLINA COMUM',
    amountLiters: '8,94',
    unitValue: '5,59',
    stockedValue: '50',
    cardBalance: '131,96',
    transactionDate: '01/02/2023 04:05:06',
    authorization: '44556',
    transactionStatus: 'APROVADA',
    supplyLocation: 'AUTOPOSTO TESTE LTDA',
    ecContractee: '01234567000189',
    gasStationAddress: 'AV DAS NACOES UNIDAS 1234, SAO PAULO - 4795100',
    network: 'POSTOS VELOE',
    previousOdometer: '28000',
    odometer: '28620',
    previousOrimeter: null,
    orimeter: null,
    kmTraveled: '620',
    standardAverage: '11,00',
    valueCostKmTraveled: '0,08',
    ipa: '5,03',
    anpIndex: '5,27',
    registration: '8765',
    branchContractee: '98765432000210',
    branchName: 'VELOE',
    baseName: 'VELOE MARKETING',
    baseCode: '005',
    merchantState: 'SAO PAULO',
    ...overrides,
  };
}

describe('parseVeloeDecimal', () => {
  it('converte decimais com vírgula', () => {
    expect(parseVeloeDecimal('8,94')).toBe(8.94);
  });

  it('converte decimais com ponto', () => {
    expect(parseVeloeDecimal('0.089000')).toBe(0.089);
  });

  it('remove separador de milhar quando há vírgula decimal', () => {
    expect(parseVeloeDecimal('1.234,56')).toBe(1234.56);
  });

  it('devolve null para texto não numérico', () => {
    expect(parseVeloeDecimal('abc')).toBeNull();
  });

  it('devolve null para null e string vazia', () => {
    expect(parseVeloeDecimal(null)).toBeNull();
    expect(parseVeloeDecimal(undefined)).toBeNull();
    expect(parseVeloeDecimal('')).toBeNull();
  });

  it('preserva o número zero', () => {
    expect(parseVeloeDecimal(0)).toBe(0);
  });
});

describe('parseVeloeDateTime', () => {
  it('converte data e hora de Brasília para ISO UTC', () => {
    expect(parseVeloeDateTime('01/02/2023 04:05:06')).toBe('2023-02-01T07:05:06.000Z');
  });

  it('converte data sem hora assumindo meia-noite de Brasília', () => {
    expect(parseVeloeDateTime('01/02/2023')).toBe('2023-02-01T03:00:00.000Z');
  });

  it('devolve null para formato inválido', () => {
    expect(parseVeloeDateTime('2023-02-01')).toBeNull();
    expect(parseVeloeDateTime(null)).toBeNull();
  });
});

describe('normalizeVeloePlate', () => {
  it('mantém a placa já canônica', () => {
    expect(normalizeVeloePlate('ABC1D23')).toBe('ABC1D23');
  });

  it('remove separadores e normaliza caixa', () => {
    expect(normalizeVeloePlate('abc-1d23')).toBe('ABC1D23');
  });

  it('devolve string vazia quando não há placa', () => {
    expect(normalizeVeloePlate('')).toBe('');
    expect(normalizeVeloePlate(null)).toBe('');
  });

  it('usa os 7 últimos caracteres', () => {
    expect(normalizeVeloePlate('XABC1D23')).toBe('ABC1D23');
  });
});

describe('maskCardLast4', () => {
  it('extrai os 4 últimos dígitos', () => {
    expect(maskCardLast4('5060708090123456')).toBe('3456');
  });

  it('devolve null quando há menos de 4 dígitos', () => {
    expect(maskCardLast4('12')).toBeNull();
    expect(maskCardLast4(null)).toBeNull();
  });
});

describe('buildExternalKey', () => {
  it('produz a mesma chave para registros idênticos', () => {
    expect(buildExternalKey(pdfRecord())).toBe(buildExternalKey(pdfRecord()));
  });

  it('produz chave diferente quando a autorização muda', () => {
    expect(buildExternalKey(pdfRecord())).not.toBe(
      buildExternalKey(pdfRecord({ authorization: '99999' }))
    );
  });
});

describe('mapVeloeSupplyToRow', () => {
  it('mapeia o registro de exemplo do PDF', () => {
    const row = mapVeloeSupplyToRow(pdfRecord(), CLIENT_ID);

    expect(row).not.toBeNull();
    expect(row?.total_value).toBe(50);
    expect(row?.amount_liters).toBe(8.94);
    expect(row?.odometer).toBe(28620);
    expect(row?.plate).toBe('ABC1D23');
    expect(row?.driver_name).toBe('JOSE DA SILVA');
    expect(row?.card_last4).toBe('3456');
    expect(row?.client_id).toBe(CLIENT_ID);
    expect(row?.source).toBe('veloe');
    expect(row?.vehicle_id).toBeNull();
    expect(row?.driver_id).toBeNull();
  });

  it('segurança: não vaza CPF nem número de cartão completo', () => {
    const row = mapVeloeSupplyToRow(pdfRecord(), CLIENT_ID);
    const serialized = JSON.stringify(row);

    expect(serialized).not.toContain('10203012345');
    expect(serialized).not.toContain('5060708090123456');
  });

  it('descarta registro com placa vazia', () => {
    expect(mapVeloeSupplyToRow(pdfRecord({ vehiclePlate: '' }), CLIENT_ID)).toBeNull();
  });

  it('descarta registro com data inválida', () => {
    expect(mapVeloeSupplyToRow(pdfRecord({ transactionDate: '2023-02-01' }), CLIENT_ID)).toBeNull();
  });
});
