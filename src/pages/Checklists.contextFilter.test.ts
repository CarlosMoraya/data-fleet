import { describe, it, expect } from 'vitest';
import {
  AUDITOR_ONLY_CONTEXTS,
  filterTemplatesByContext,
  filterVehiclesForContext,
  isAuditorOnlyContext,
} from '../lib/checklistContextRules';
import type { ChecklistContext } from '../types/checklist';

describe('Checklists context filtering (lógica pura)', () => {
  it('filtra apenas templates do contexto Entrega', () => {
    const templates = [
      { id: '1', context: 'Entrega' as ChecklistContext },
      { id: '2', context: 'Devolução' as ChecklistContext },
      { id: '3', context: 'Auditoria' as ChecklistContext },
      { id: '4', context: 'Entrega' as ChecklistContext },
    ];
    const result = filterTemplatesByContext(templates, 'Entrega');
    expect(result.map((t) => t.id)).toEqual(['1', '4']);
  });

  it('um Driver não recebe nenhum template cujo contexto esteja em AUDITOR_ONLY_CONTEXTS', () => {
    const templates = [
      { id: '1', context: 'Rotina' as ChecklistContext },
      { id: '2', context: 'Auditoria' as ChecklistContext },
      { id: '3', context: 'Entrega' as ChecklistContext },
      { id: '4', context: 'Devolução' as ChecklistContext },
      { id: '5', context: 'Segurança' as ChecklistContext },
    ];
    const driverTemplates = templates.filter((t) => !isAuditorOnlyContext(t.context));
    driverTemplates.forEach((t) => {
      expect(AUDITOR_ONLY_CONTEXTS).not.toContain(t.context);
    });
    expect(driverTemplates.map((t) => t.id)).toEqual(['1', '5']);
  });

  it('veículos filtrados para Devolução excluem os de status Available e Maintenance', () => {
    const vehicles = [
      { id: 'a', status: 'Available' as const },
      { id: 'b', status: 'In Use' as const },
      { id: 'c', status: 'Maintenance' as const },
      { id: 'd', status: 'In Use' as const },
    ];
    const result = filterVehiclesForContext(vehicles, 'Devolução');
    expect(result.map((v) => v.id)).toEqual(['b', 'd']);
  });
});
