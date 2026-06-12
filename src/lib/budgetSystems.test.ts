import { describe, it, expect } from 'vitest';
import {
  OTHER_BUDGET_SYSTEM,
  BUDGET_SYSTEM_OPTIONS,
  isKnownBudgetSystem,
  normalizeBudgetSystem,
  inferBudgetSystem,
} from './budgetSystems';

describe('budgetSystems', () => {
  describe('BUDGET_SYSTEM_OPTIONS', () => {
    it('contains the official systems in order', () => {
      expect(BUDGET_SYSTEM_OPTIONS).toEqual([
        'Sistema de Freio',
        'Motor',
        'Suspensão',
        'Transmissão',
        'Sistema Elétrico',
        'Arrefecimento',
        'Direção',
        'Ar Condicionado',
        'Pneus e Rodas',
        'Sistema de Combustível',
        'Carroceria',
        'Mão de Obra',
        'Outros',
      ]);
    });

    it('ends with Outros', () => {
      expect(BUDGET_SYSTEM_OPTIONS[BUDGET_SYSTEM_OPTIONS.length - 1]).toBe('Outros');
    });

    it('has 13 entries (12 known + Outros)', () => {
      expect(BUDGET_SYSTEM_OPTIONS).toHaveLength(13);
    });
  });

  describe('isKnownBudgetSystem', () => {
    it('returns true for a known system', () => {
      expect(isKnownBudgetSystem('Motor')).toBe(true);
      expect(isKnownBudgetSystem('Sistema de Freio')).toBe(true);
      expect(isKnownBudgetSystem('Outros')).toBe(true);
    });

    it('returns false for empty or unknown values', () => {
      expect(isKnownBudgetSystem('')).toBe(false);
      expect(isKnownBudgetSystem(null)).toBe(false);
      expect(isKnownBudgetSystem(undefined)).toBe(false);
      expect(isKnownBudgetSystem('Sistema Inventado')).toBe(false);
    });
  });

  describe('normalizeBudgetSystem', () => {
    it('keeps known systems', () => {
      expect(normalizeBudgetSystem('Motor')).toBe('Motor');
      expect(normalizeBudgetSystem('Pneus e Rodas')).toBe('Pneus e Rodas');
      expect(normalizeBudgetSystem('Outros')).toBe('Outros');
    });

    it('maps empty and unknown values to Outros', () => {
      expect(normalizeBudgetSystem('')).toBe('Outros');
      expect(normalizeBudgetSystem(null)).toBe('Outros');
      expect(normalizeBudgetSystem(undefined)).toBe('Outros');
      expect(normalizeBudgetSystem('Sistema Inventado')).toBe('Outros');
    });
  });

  describe('inferBudgetSystem', () => {
    it('infers known systems from item names', () => {
      expect(inferBudgetSystem('Pastilha de freio')).toBe('Sistema de Freio');
      expect(inferBudgetSystem('Radiador novo')).toBe('Arrefecimento');
      expect(inferBudgetSystem('Bateria 12V')).toBe('Sistema Elétrico');
      expect(inferBudgetSystem('Amortecedor traseiro')).toBe('Suspensão');
      expect(inferBudgetSystem('Revisão completa')).toBe('Mão de Obra');
    });

    it('returns Outros when item is not identifiable', () => {
      expect(inferBudgetSystem('Serviço genérico')).toBe('Outros');
      expect(inferBudgetSystem('')).toBe('Outros');
    });
  });
});