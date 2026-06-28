import { describe, expect, it } from 'vitest';

import { evaluateOdometerTolerance } from './odometerToleranceValidation';

describe('evaluateOdometerTolerance', () => {
  it('bloqueia KM retroativo', () => {
    const result = evaluateOdometerTolerance({
      rawValue: '100',
      lastValidKm: 200,
      lastReadingAt: '2026-06-21T12:00:00Z',
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
      now: new Date('2026-06-22T12:00:00Z'),
    });

    expect(result.ok).toBe(false);
  });

  it('bloqueia KM vazio', () => {
    const result = evaluateOdometerTolerance({
      rawValue: '',
      lastValidKm: null,
      lastReadingAt: null,
      initialKm: null,
      tolerancePerDay: null,
      dayInterval: null,
    });

    expect(result.ok).toBe(false);
  });

  it('libera primeira leitura sem base', () => {
    expect(evaluateOdometerTolerance({
      rawValue: '1000',
      lastValidKm: null,
      lastReadingAt: null,
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
    })).toEqual({ ok: true, value: 1000, requiresPhoto: false });
  });

  it('usa initialKm apenas para anti-retrocesso quando nao ha leitura datada', () => {
    expect(evaluateOdometerTolerance({
      rawValue: '20500',
      lastValidKm: null,
      lastReadingAt: null,
      initialKm: 20000,
      tolerancePerDay: 300,
      dayInterval: 1,
    })).toEqual({ ok: true, value: 20500, requiresPhoto: false });

    expect(evaluateOdometerTolerance({
      rawValue: '19000',
      lastValidKm: null,
      lastReadingAt: null,
      initialKm: 20000,
      tolerancePerDay: 300,
      dayInterval: 1,
    }).ok).toBe(false);
  });

  it('libera leitura dentro da tolerancia diaria', () => {
    expect(evaluateOdometerTolerance({
      rawValue: '20300',
      lastValidKm: 20000,
      lastReadingAt: '2026-06-21T12:00:00Z',
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
      now: new Date('2026-06-22T12:00:00Z'),
    })).toEqual({ ok: true, value: 20300, requiresPhoto: false });
  });

  it('exige foto quando excede a tolerancia diaria', () => {
    expect(evaluateOdometerTolerance({
      rawValue: '20350',
      lastValidKm: 20000,
      lastReadingAt: '2026-06-21T12:00:00Z',
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
      now: new Date('2026-06-22T12:00:00Z'),
    })).toEqual({
      ok: true,
      value: 20350,
      requiresPhoto: true,
      expectedMaxKm: 20300,
      exceededBy: 50,
    });
  });

  it('calcula tolerancia com multiplos dias', () => {
    expect(evaluateOdometerTolerance({
      rawValue: '20601',
      lastValidKm: 20000,
      lastReadingAt: '2026-06-20T12:00:00Z',
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
      now: new Date('2026-06-22T12:00:00Z'),
    })).toMatchObject({
      ok: true,
      requiresPhoto: true,
      expectedMaxKm: 20600,
      exceededBy: 1,
    });
  });

  it('bloqueia KM igual ao ultimo registrado quando mustExceed: true', () => {
    const result = evaluateOdometerTolerance({
      rawValue: '20000',
      lastValidKm: 20000,
      lastReadingAt: '2026-06-21T12:00:00Z',
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
      now: new Date('2026-06-22T12:00:00Z'),
      mustExceed: true,
    });
    expect(result.ok).toBe(false);
  });

  it('mantem KM igual aceito por default (regressao de Manutenção)', () => {
    const result = evaluateOdometerTolerance({
      rawValue: '20000',
      lastValidKm: 20000,
      lastReadingAt: '2026-06-21T12:00:00Z',
      initialKm: null,
      tolerancePerDay: 300,
      dayInterval: 1,
      now: new Date('2026-06-22T12:00:00Z'),
    });
    expect(result.ok).toBe(true);
  });
});
