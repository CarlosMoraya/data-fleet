import { describe, it, expect } from 'vitest';
import {
  AUDITOR_ONLY_CONTEXTS,
  requiresHandoverEvidence,
  vehicleStatusFilterFor,
  isHandoverGateBlocked,
  isAuditorOnlyContext,
  getAvailableContextsForDriver,
  getFreeVehicleChoiceContexts,
  shouldCreateLoanOnHandover,
  filterAuditorVehiclesForContext,
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

  describe('getAvailableContextsForDriver', () => {
    const published: ChecklistContext[] = [
      'Rotina',
      'Auditoria',
      'Entrega',
      'Devolução',
      'Segurança',
      'Atualização de Hodômetro',
    ];

    it('sem empréstimo ativo: retorna apenas contextos não auditor-only (sem Auditoria)', () => {
      const result = getAvailableContextsForDriver({ publishedContexts: published, hasActiveLoan: false, isTitular: true });
      expect(result).not.toContain('Auditoria');
      expect(result).not.toContain('Entrega');
      expect(result).not.toContain('Devolução');
      expect(result).toContain('Rotina');
      expect(result).toContain('Segurança');
    });

    it('com empréstimo ativo + titular: inclui Auditoria adicionalmente', () => {
      const result = getAvailableContextsForDriver({ publishedContexts: published, hasActiveLoan: true, isTitular: true });
      expect(result).toContain('Auditoria');
      expect(result).not.toContain('Entrega');
      expect(result).not.toContain('Devolução');
    });

    it('com empréstimo ativo + NÃO titular (temporário): NÃO inclui Auditoria', () => {
      const result = getAvailableContextsForDriver({ publishedContexts: published, hasActiveLoan: true, isTitular: false });
      expect(result).not.toContain('Auditoria');
    });

    it('Entrega e Devolução nunca aparecem para o motorista, em nenhuma condição', () => {
      for (const isTitular of [true, false]) {
        for (const hasActiveLoan of [true, false]) {
          const result = getAvailableContextsForDriver({ publishedContexts: published, hasActiveLoan, isTitular });
          expect(result).not.toContain('Entrega');
          expect(result).not.toContain('Devolução');
        }
      }
    });

    it('quando Auditoria não está publicado, titular com empréstimo não adiciona nada', () => {
      const subset: ChecklistContext[] = ['Rotina', 'Auditoria'];
      // Removemos Auditoria do publicado e esperamos que não seja adicionada
      const publishedSemAuditoria = subset.filter((c) => c !== 'Auditoria');
      const result = getAvailableContextsForDriver({ publishedContexts: publishedSemAuditoria, hasActiveLoan: true, isTitular: true });
      expect(result).not.toContain('Auditoria');
    });
  });

  describe('shouldCreateLoanOnHandover', () => {
    it('retorna false para contexto não-handover (Rotina)', () => {
      expect(shouldCreateLoanOnHandover('d1', 'd2', 'Rotina')).toBe(false);
      expect(shouldCreateLoanOnHandover('d1', 'd2', 'Auditoria')).toBe(false);
    });

    it('retorna false quando não há driverId selecionado', () => {
      expect(shouldCreateLoanOnHandover(undefined, 'd2', 'Entrega')).toBe(false);
      expect(shouldCreateLoanOnHandover('', 'd2', 'Entrega')).toBe(false);
    });

    it('retorna true quando driver difere do titular em Entrega', () => {
      expect(shouldCreateLoanOnHandover('d-temp', 'd-titular', 'Entrega')).toBe(true);
      expect(shouldCreateLoanOnHandover('d-temp', 'd-titular', 'Devolução')).toBe(true);
    });

    it('retorna false quando driver == titular em handover', () => {
      expect(shouldCreateLoanOnHandover('d1', 'd1', 'Entrega')).toBe(false);
    });

    it('titular nulo conta como diferente (empréstimo criado)', () => {
      expect(shouldCreateLoanOnHandover('d1', null, 'Entrega')).toBe(true);
      expect(shouldCreateLoanOnHandover('d1', undefined, 'Entrega')).toBe(true);
    });
  });

  describe('filterAuditorVehiclesForContext', () => {
    const vehicles = [
      { id: 'v1', status: 'Available' as const },
      { id: 'v2', status: 'In Use' as const },
      { id: 'v3', status: 'Available' as const },
      { id: 'v4', status: 'Maintenance' as const },
    ];

    it('Devolução inclui veículo com empréstimo ativo mesmo estando Available', () => {
      const result = filterAuditorVehiclesForContext({
        vehicles,
        context: 'Devolução',
        activeLoanVehicleIds: new Set(['v1']),
      });
      expect(result.map((v) => v.id)).toContain('v1');
    });

    it('Devolução inclui In Use sem empréstimo (comportamento legado)', () => {
      const result = filterAuditorVehiclesForContext({
        vehicles,
        context: 'Devolução',
        activeLoanVehicleIds: new Set(),
      });
      expect(result.map((v) => v.id)).toEqual(['v2']);
    });

    it('Devolução é a união de empréstimo ativo + In Use, sem duplicar', () => {
      const result = filterAuditorVehiclesForContext({
        vehicles,
        context: 'Devolução',
        activeLoanVehicleIds: new Set(['v1', 'v2']),
      });
      expect(result.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
    });

    it('Entrega continua filtrando só Available (empréstimo ativo não afeta)', () => {
      const result = filterAuditorVehiclesForContext({
        vehicles,
        context: 'Entrega',
        activeLoanVehicleIds: new Set(['v2']),
      });
      expect(result.map((v) => v.id).sort()).toEqual(['v1', 'v3']);
    });

    it('contexto sem handover (ex.: Auditoria) permanece inalterado', () => {
      const result = filterAuditorVehiclesForContext({
        vehicles,
        context: 'Auditoria',
        activeLoanVehicleIds: new Set(['v1']),
      });
      expect(result).toEqual(vehicles);
    });
  });

  describe('getFreeVehicleChoiceContexts', () => {
    it('retorna os três contextos de escolha livre para Yard Auditor', () => {
      expect(getFreeVehicleChoiceContexts('Yard Auditor')).toEqual(['Auditoria', 'Entrega', 'Devolução']);
    });

    it('retorna apenas Auditoria para Operations Manager', () => {
      const result = getFreeVehicleChoiceContexts('Operations Manager');
      expect(result).toEqual(['Auditoria']);
      expect(result).not.toContain('Entrega');
      expect(result).not.toContain('Devolução');
    });

    it('retorna vazio para Driver', () => {
      expect(getFreeVehicleChoiceContexts('Driver')).toEqual([]);
    });

    it('retorna vazio para Fleet Assistant', () => {
      expect(getFreeVehicleChoiceContexts('Fleet Assistant')).toEqual([]);
    });

    it('retorna vazio para undefined', () => {
      expect(getFreeVehicleChoiceContexts(undefined)).toEqual([]);
    });

    it('retorna vazio para null', () => {
      expect(getFreeVehicleChoiceContexts(null)).toEqual([]);
    });
  });
});
