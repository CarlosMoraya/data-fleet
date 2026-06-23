import { describe, expect, it } from 'vitest';
import { validateMaintenanceCurrentKm } from './maintenanceKmValidation';

describe('validateMaintenanceCurrentKm', () => {
  it('aceita campo vazio (undefined)', () => {
    expect(validateMaintenanceCurrentKm({ currentKm: undefined, referenceKm: 23000 })).toEqual({ ok: true });
  });

  it('aceita campo nulo', () => {
    expect(validateMaintenanceCurrentKm({ currentKm: null, referenceKm: 23000 })).toEqual({ ok: true });
  });

  it('aceita KM igual ao ultimo registrado', () => {
    expect(validateMaintenanceCurrentKm({ currentKm: 23000, referenceKm: 23000 })).toEqual({ ok: true });
  });

  it('aceita KM maior que o ultimo registrado', () => {
    expect(validateMaintenanceCurrentKm({ currentKm: 24000, referenceKm: 23000 })).toEqual({ ok: true });
  });

  it('bloqueia KM menor que o ultimo registrado', () => {
    const result = validateMaintenanceCurrentKm({ currentKm: 22000, referenceKm: 23000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('é menor que o último registrado');
    }
  });

  it('aceita KM sem referencia (null)', () => {
    expect(validateMaintenanceCurrentKm({ currentKm: 100, referenceKm: null })).toEqual({ ok: true });
  });

  it('aceita veiculo novo (referencia zero)', () => {
    expect(validateMaintenanceCurrentKm({ currentKm: 0, referenceKm: 0 })).toEqual({ ok: true });
  });
});