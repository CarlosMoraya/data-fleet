import { describe, expect, it } from 'vitest';

import {
  buildAdherenceCards,
  buildAdherenceTableRows,
  filterAdherenceRowsByGroup,
  groupOverdueVehiclesByDimension,
  type AdherenceTableRow,
  type AdherenceVehicle,
} from './checklistAdherence';

import type { ChecklistAdherenceContext, OverdueChecklistSets } from './dashboardKpi';

function makeVehicle(overrides: Partial<AdherenceVehicle> & { id: string }): AdherenceVehicle {
  return {
    license_plate: 'AAA0A00',
    brand: 'Volvo',
    model: 'FH 460',
    driver_name: 'Motorista',
    shipper_name: 'Embarcador A',
    operational_unit_name: 'Unidade A',
    ...overrides,
  };
}

function makeSets(overrides: Partial<OverdueChecklistSets> = {}): OverdueChecklistSets {
  return {
    rotina: new Set<string>(),
    seguranca: new Set<string>(),
    auditoria: new Set<string>(),
    aggregated: new Set<string>(),
    ...overrides,
  };
}

describe('buildAdherenceCards', () => {
  it('contexto parametrizado calcula aderência a partir de calculateChecklistComplianceRate', () => {
    const cards = buildAdherenceCards({
      contexts: ['rotina'],
      overdueSets: makeSets({ rotina: new Set(['v1', 'v2']) }),
      intervals: { rotina_day_interval: 30, seguranca_day_interval: null },
      totalActiveVehicles: 10,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].label).toBe('Rotina');
    expect(cards[0].isConfigured).toBe(true);
    expect(cards[0].dayInterval).toBe(30);
    expect(cards[0].overdueCount).toBe(2);
    expect(cards[0].adherenceRate).toBe(80);
  });

  it('contexto não parametrizado zera contagem e não expõe percentual', () => {
    const cards = buildAdherenceCards({
      contexts: ['auditoria'],
      overdueSets: makeSets({ auditoria: new Set(['v1', 'v2', 'v3']) }),
      intervals: { rotina_day_interval: 30, seguranca_day_interval: 30, auditoria_day_interval: null },
      totalActiveVehicles: 10,
    });
    expect(cards[0].isConfigured).toBe(false);
    expect(cards[0].adherenceRate).toBeNull();
    expect(cards[0].overdueCount).toBe(0);
    expect(cards[0].dayInterval).toBeNull();
  });

  it('objeto de intervalos ausente equivale a contexto não parametrizado', () => {
    const cards = buildAdherenceCards({
      contexts: ['rotina', 'seguranca', 'auditoria'],
      overdueSets: makeSets(),
      intervals: undefined,
      totalActiveVehicles: 10,
    });
    expect(cards.map((c) => c.isConfigured)).toEqual([false, false, false]);
  });

  it('sem veículos ativos a aderência é 100 (comportamento herdado)', () => {
    const cards = buildAdherenceCards({
      contexts: ['rotina'],
      overdueSets: makeSets(),
      intervals: { rotina_day_interval: 30, seguranca_day_interval: null },
      totalActiveVehicles: 0,
    });
    expect(cards[0].adherenceRate).toBe(100);
  });
});

describe('groupOverdueVehiclesByDimension', () => {
  it('conta veículos vencidos por embarcador, ordenado por contagem decrescente', () => {
    const vehicles = [
      makeVehicle({ id: 'v1', shipper_name: 'Embarcador A' }),
      makeVehicle({ id: 'v2', shipper_name: 'Embarcador B' }),
      makeVehicle({ id: 'v3', shipper_name: 'Embarcador B' }),
      makeVehicle({ id: 'v4', shipper_name: 'Embarcador C' }),
    ];
    const result = groupOverdueVehiclesByDimension(vehicles, new Set(['v1', 'v2', 'v3']), 'shipper');
    expect(result).toEqual([
      { name: 'Embarcador B', value: 2 },
      { name: 'Embarcador A', value: 1 },
    ]);
  });

  it('veículo sem embarcador entra na fatia Sem Embarcador e não é omitido', () => {
    const vehicles = [
      makeVehicle({ id: 'v1', shipper_name: null }),
      makeVehicle({ id: 'v2', shipper_name: 'Embarcador A' }),
    ];
    const result = groupOverdueVehiclesByDimension(vehicles, new Set(['v1', 'v2']), 'shipper');
    expect(result.find((s) => s.name === 'Sem Embarcador')?.value).toBe(1);
    expect(result.reduce((sum, s) => sum + s.value, 0)).toBe(2);
  });

  it('veículo sem unidade operacional entra na fatia Sem Unidade', () => {
    const vehicles = [makeVehicle({ id: 'v1', operational_unit_name: null })];
    const result = groupOverdueVehiclesByDimension(vehicles, new Set(['v1']), 'operationalUnit');
    expect(result).toEqual([{ name: 'Sem Unidade', value: 1 }]);
  });

  it('nenhum veículo vencido produz array vazio', () => {
    const vehicles = [makeVehicle({ id: 'v1' })];
    expect(groupOverdueVehiclesByDimension(vehicles, new Set<string>(), 'shipper')).toEqual([]);
  });

  it('empate de contagem sai ordenado alfabeticamente', () => {
    const vehicles = [
      makeVehicle({ id: 'v1', shipper_name: 'Zeta' }),
      makeVehicle({ id: 'v2', shipper_name: 'Alfa' }),
    ];
    const result = groupOverdueVehiclesByDimension(vehicles, new Set(['v1', 'v2']), 'shipper');
    expect(result.map((s) => s.name)).toEqual(['Alfa', 'Zeta']);
  });
});

describe('buildAdherenceTableRows', () => {
  const today = new Date('2026-06-14T12:00:00Z');
  const context: ChecklistAdherenceContext = 'rotina';

  it('calcula dias em atraso a partir do último checklist e do intervalo', () => {
    const vehicles = [makeVehicle({ id: 'v1' })];
    const rows = buildAdherenceTableRows({
      vehicles,
      overdueIds: new Set(['v1']),
      context,
      dayInterval: 30,
      lastByVehicle: new Map([['v1', { rotina: '2026-04-30T12:00:00Z' }]]),
      lastChecklistIdByKey: new Map(),
      today,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastCompletedAt).toBe('2026-04-30T12:00:00Z');
    expect(rows[0].daysOverdue).toBe(15);
    expect(rows[0].contextLabel).toBe('Rotina');
    expect(rows[0].vehicleLabel).toBe('Volvo FH 460');
  });

  it('veículo que nunca fez o checklist do contexto vem primeiro, sem dias em atraso', () => {
    const vehicles = [
      makeVehicle({ id: 'v1' }),
      makeVehicle({ id: 'v2' }),
    ];
    const rows = buildAdherenceTableRows({
      vehicles,
      overdueIds: new Set(['v1', 'v2']),
      context,
      dayInterval: 30,
      lastByVehicle: new Map([['v1', { rotina: '2026-04-30T12:00:00Z' }]]),
      lastChecklistIdByKey: new Map(),
      today,
    });
    expect(rows[0].vehicleId).toBe('v2');
    expect(rows[0].lastCompletedAt).toBeNull();
    expect(rows[0].daysOverdue).toBeNull();
  });

  it('veículo sem motorista exibe o marcador de campo ausente', () => {
    const vehicles = [makeVehicle({ id: 'v1', driver_name: null })];
    const rows = buildAdherenceTableRows({
      vehicles,
      overdueIds: new Set(['v1']),
      context,
      dayInterval: 30,
      lastByVehicle: new Map(),
      lastChecklistIdByKey: new Map(),
      today,
    });
    expect(rows[0].driverName).toBe('—');
  });

  it('checklistId é resolvido quando o mapa contém a chave e null quando não contém', () => {
    const vehicles = [
      makeVehicle({ id: 'v1' }),
      makeVehicle({ id: 'v2' }),
    ];
    const rows = buildAdherenceTableRows({
      vehicles,
      overdueIds: new Set(['v1', 'v2']),
      context,
      dayInterval: 30,
      lastByVehicle: new Map([
        ['v1', { rotina: '2026-04-30T12:00:00Z' }],
        ['v2', { rotina: '2026-04-30T12:00:00Z' }],
      ]),
      lastChecklistIdByKey: new Map([['v1:rotina', 'chk-1']]),
      today,
    });
    expect(rows.find((r) => r.vehicleId === 'v1')?.checklistId).toBe('chk-1');
    expect(rows.find((r) => r.vehicleId === 'v2')?.checklistId).toBeNull();
  });

  it('aplica os fallbacks de embarcador e unidade nas colunas de agrupamento', () => {
    const vehicles = [makeVehicle({ id: 'v1', shipper_name: null, operational_unit_name: null })];
    const rows = buildAdherenceTableRows({
      vehicles,
      overdueIds: new Set(['v1']),
      context,
      dayInterval: 30,
      lastByVehicle: new Map(),
      lastChecklistIdByKey: new Map(),
      today,
    });
    expect(rows[0].shipperName).toBe('Sem Embarcador');
    expect(rows[0].operationalUnitName).toBe('Sem Unidade');
  });
});

describe('filterAdherenceRowsByGroup', () => {
  const rows: AdherenceTableRow[] = [
    {
      vehicleId: 'v1', licensePlate: 'AAA0A00', vehicleLabel: 'Volvo FH', contextLabel: 'Rotina',
      lastCompletedAt: null, daysOverdue: null, driverName: '—',
      shipperName: 'Embarcador A', operationalUnitName: 'Unidade A', checklistId: null,
    },
    {
      vehicleId: 'v2', licensePlate: 'BBB0B00', vehicleLabel: 'Scania R', contextLabel: 'Rotina',
      lastCompletedAt: null, daysOverdue: null, driverName: '—',
      shipperName: 'Embarcador A', operationalUnitName: 'Unidade B', checklistId: null,
    },
    {
      vehicleId: 'v3', licensePlate: 'CCC0C00', vehicleLabel: 'Volvo FM', contextLabel: 'Rotina',
      lastCompletedAt: null, daysOverdue: null, driverName: '—',
      shipperName: 'Embarcador B', operationalUnitName: 'Unidade A', checklistId: null,
    },
  ];

  it('sem filtro retorna todas as linhas', () => {
    expect(filterAdherenceRowsByGroup(rows, null, null)).toHaveLength(3);
  });

  it('filtra apenas por embarcador', () => {
    const result = filterAdherenceRowsByGroup(rows, 'Embarcador A', null);
    expect(result.map((r) => r.vehicleId)).toEqual(['v1', 'v2']);
  });

  it('combina embarcador e unidade com AND', () => {
    const result = filterAdherenceRowsByGroup(rows, 'Embarcador A', 'Unidade B');
    expect(result.map((r) => r.vehicleId)).toEqual(['v2']);
  });
});
