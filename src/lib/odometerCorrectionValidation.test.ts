import { describe, expect, it } from 'vitest';
import { validateOdometerCorrection } from './odometerCorrectionValidation';

describe('validateOdometerCorrection', () => {
  it('aceita correcao valida', () => {
    expect(validateOdometerCorrection({ rawValue: '10000', reason: 'Erro de digitação' })).toEqual({
      ok: true,
      correctedKm: 10000,
    });
  });

  it('bloqueia motivo vazio', () => {
    const result = validateOdometerCorrection({ rawValue: '10000', reason: '   ' });
    expect(result.ok).toBe(false);
    if ('message' in result) expect(result.message).toContain('motivo');
  });

  it('bloqueia KM vazio', () => {
    const result = validateOdometerCorrection({ rawValue: '', reason: 'x' });
    expect(result.ok).toBe(false);
    if ('message' in result) expect(result.message).toContain('Km corrigido');
  });

  it('bloqueia KM nao numerico', () => {
    expect(validateOdometerCorrection({ rawValue: 'abc', reason: 'x' }).ok).toBe(false);
  });

  it('bloqueia KM negativo', () => {
    const result = validateOdometerCorrection({ rawValue: '-5', reason: 'x' });
    expect(result.ok).toBe(false);
    if ('message' in result) expect(result.message).toContain('negativo');
  });
});
