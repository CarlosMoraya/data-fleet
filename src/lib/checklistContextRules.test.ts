import { describe, it, expect } from 'vitest';
import {
  AUDITOR_ONLY_CONTEXTS,
  requiresHandoverEvidence,
  vehicleStatusFilterFor,
  isHandoverGateBlocked,
  isAuditorOnlyContext,
} from './checklistContextRules';
import type { ChecklistContext } from '../types/checklist';

describe('checklistContextRules', () => {
  describe('requiresHandoverEvidence', () => {
    it('retorna true para Entrega e Devolução', () => {
      expect(requiresHandoverEvidence('Entrega')).toBe(true);
      expect(requiresHandoverEvidence('Devolução')).toBe(true);
    });

    it('retorna false para Rotina e Auditoria', () => {
      expect(requiresHandoverEvidence('Rotina')).toBe(false);
      expect(requiresHandoverEvidence('Auditoria')).toBe(false);
    });

    it('retorna false para undefined sem lançar', () => {
      expect(requiresHandoverEvidence(undefined)).toBe(false);
    });
  });

  describe('vehicleStatusFilterFor', () => {
    it('filtra Available para Entrega e In Use para Devolução', () => {
      expect(vehicleStatusFilterFor('Entrega')).toBe('Available');
      expect(vehicleStatusFilterFor('Devolução')).toBe('In Use');
    });

    it('não filtra para Auditoria (preserva comportamento atual)', () => {
      expect(vehicleStatusFilterFor('Auditoria')).toBeNull();
    });
  });

  describe('isHandoverGateBlocked', () => {
    it('não bloqueia contexto não-handover', () => {
      expect(isHandoverGateBlocked({ context: 'Rotina' })).toBe(false);
    });

    it('não bloqueia handover com as 3 evidências presentes', () => {
      expect(
        isHandoverGateBlocked({
          context: 'Entrega',
          driverId: 'd1',
          cnhPhotoUrl: 'url-cnh',
          signatureUrl: 'url-sig',
        }),
      ).toBe(false);
    });

    it('bloqueia quando driverId está ausente', () => {
      expect(
        isHandoverGateBlocked({
          context: 'Entrega',
          cnhPhotoUrl: 'url-cnh',
          signatureUrl: 'url-sig',
        }),
      ).toBe(true);
    });

    it('bloqueia quando cnhPhotoUrl está ausente', () => {
      expect(
        isHandoverGateBlocked({
          context: 'Entrega',
          driverId: 'd1',
          signatureUrl: 'url-sig',
        }),
      ).toBe(true);
    });

    it('bloqueia quando signatureUrl está ausente', () => {
      expect(
        isHandoverGateBlocked({
          context: 'Entrega',
          driverId: 'd1',
          cnhPhotoUrl: 'url-cnh',
        }),
      ).toBe(true);
    });
  });

  describe('isAuditorOnlyContext — regressão', () => {
    const preExistingContexts: ChecklistContext[] = [
      'Rotina',
      'Guincho',
      'Engate',
      'Desengate',
      'Entrada em Oficina',
      'Saída de Oficina',
      'Segurança',
      'Atualização de Hodômetro',
    ];

    it('retorna false para todos os contextos pré-existentes exceto Auditoria', () => {
      preExistingContexts.forEach((context) => {
        expect(isAuditorOnlyContext(context)).toBe(false);
      });
    });

    it('retorna true para Auditoria', () => {
      expect(isAuditorOnlyContext('Auditoria')).toBe(true);
    });

    it('AUDITOR_ONLY_CONTEXTS contém exatamente Auditoria, Entrega e Devolução', () => {
      expect(AUDITOR_ONLY_CONTEXTS).toEqual(['Auditoria', 'Entrega', 'Devolução']);
    });
  });
});
