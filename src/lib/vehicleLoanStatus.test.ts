import { describe, it, expect } from 'vitest';
import { getVehicleLoanStatusTag, getVehicleLoanEndedReasonLabel } from './vehicleLoanStatus';

describe('vehicleLoanStatus', () => {
  it('active → green "Ativo"', () => {
    const tag = getVehicleLoanStatusTag({ status: 'active' });
    expect(tag.label).toBe('Ativo');
    expect(tag.className).toContain('bg-green-100');
    expect(tag.className).toContain('text-green-700');
    expect(tag.icon).toBe('🔄');
  });

  it('completed + driver_changed → amber "Concluído (Automático)"', () => {
    const tag = getVehicleLoanStatusTag({ status: 'completed', endedReason: 'driver_changed' });
    expect(tag.label).toBe('Concluído (Automático)');
    expect(tag.className).toContain('bg-amber-100');
    expect(tag.className).toContain('text-amber-700');
    expect(tag.icon).toBe('⚙️');
  });

  it('completed (return_checklist) → blue "Concluído"', () => {
    const tag = getVehicleLoanStatusTag({ status: 'completed', endedReason: 'return_checklist' });
    expect(tag.label).toBe('Concluído');
    expect(tag.className).toContain('bg-blue-100');
    expect(tag.icon).toBe('✅');
  });

  it('cancelled → red "Cancelado"', () => {
    const tag = getVehicleLoanStatusTag({ status: 'cancelled' });
    expect(tag.label).toBe('Cancelado');
    expect(tag.className).toContain('bg-red-100');
    expect(tag.icon).toBe('❌');
  });

  describe('getVehicleLoanEndedReasonLabel', () => {
    it('return_checklist → "Devolução por checklist"', () => {
      expect(getVehicleLoanEndedReasonLabel('return_checklist')).toBe('Devolução por checklist');
    });

    it('driver_changed → "Troca de motorista titular"', () => {
      expect(getVehicleLoanEndedReasonLabel('driver_changed')).toBe('Troca de motorista titular');
    });

    it('cancelled → "Cancelado"', () => {
      expect(getVehicleLoanEndedReasonLabel('cancelled')).toBe('Cancelado');
    });

    it('other → "Outro"', () => {
      expect(getVehicleLoanEndedReasonLabel('other')).toBe('Outro');
    });

    it('nulo/indefinido → "—"', () => {
      expect(getVehicleLoanEndedReasonLabel(null)).toBe('—');
      expect(getVehicleLoanEndedReasonLabel(undefined)).toBe('—');
    });
  });
});