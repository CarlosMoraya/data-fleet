import { describe, expect, it } from 'vitest';

import { validateChecklistOdometerKm } from './checklistKmValidation';

describe('validateChecklistOdometerKm', () => {
  it('aceita KM igual ao ultimo registrado', () => {
    expect(validateChecklistOdometerKm({ rawValue: '1200', referenceKm: 1200 })).toEqual({ ok: true, value: 1200 });
  });

  it('aceita KM maior que o ultimo registrado', () => {
    expect(validateChecklistOdometerKm({ rawValue: '1300', referenceKm: 1200 })).toEqual({ ok: true, value: 1300 });
  });

  it('bloqueia KM menor que o ultimo registrado', () => {
    const result = validateChecklistOdometerKm({ rawValue: '1199', referenceKm: 1200 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('é menor que o último registrado');
    }
  });

  it('bloqueia valor vazio', () => {
    expect(validateChecklistOdometerKm({ rawValue: '   ', referenceKm: 1200 })).toEqual({
      ok: false,
      message: 'Informe o Km atual do veículo.',
    });
  });

  it('bloqueia valor nao numerico', () => {
    expect(validateChecklistOdometerKm({ rawValue: 'abc', referenceKm: 1200 })).toEqual({
      ok: false,
      message: 'Informe o Km atual do veículo.',
    });
  });

  it('aceita novo KM acima da referencia corrigida', () => {
    expect(validateChecklistOdometerKm({ rawValue: '11000', referenceKm: 10000 })).toEqual({
      ok: true,
      value: 11000,
    });
  });

  it('bloqueia novo KM abaixo da referencia corrigida', () => {
    const result = validateChecklistOdometerKm({ rawValue: '9000', referenceKm: 10000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('é menor que o último registrado');
    }
  });
});
