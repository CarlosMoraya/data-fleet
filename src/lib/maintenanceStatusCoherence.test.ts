import { describe, expect, it } from 'vitest';

import {
  BUDGET_GATED_STATUSES,
  canAdvanceMaintenanceStatus,
  describeStatusBlockReason,
  isOrderPayable,
  PAYABLE_MAINTENANCE_STATUSES,
} from './maintenanceStatusCoherence';

describe('canAdvanceMaintenanceStatus', () => {
  it('bloqueia os três estados dependentes de orçamento pendente ou reaberto', () => {
    for (const target of BUDGET_GATED_STATUSES) {
      expect(canAdvanceMaintenanceStatus(target, 'pendente')).toBe(false);
      expect(canAdvanceMaintenanceStatus(target, 'reaberto')).toBe(false);
    }
  });

  it('permite os estados dependentes quando o orçamento não aguarda decisão', () => {
    for (const target of BUDGET_GATED_STATUSES) {
      for (const budgetStatus of ['sem_orcamento', 'aprovado', 'reprovado'] as const) {
        expect(canAdvanceMaintenanceStatus(target, budgetStatus)).toBe(true);
      }
      expect(canAdvanceMaintenanceStatus(target, undefined)).toBe(true);
      expect(canAdvanceMaintenanceStatus(target, null)).toBe(true);
    }
  });

  it('nunca bloqueia Cancelado', () => {
    for (const budgetStatus of ['sem_orcamento', 'pendente', 'aprovado', 'reprovado', 'reaberto'] as const) {
      expect(canAdvanceMaintenanceStatus('Cancelado', budgetStatus)).toBe(true);
    }
    expect(canAdvanceMaintenanceStatus('Cancelado', undefined)).toBe(true);
    expect(canAdvanceMaintenanceStatus('Cancelado', null)).toBe(true);
  });

  it('não bloqueia estados que não exigem decisão de orçamento', () => {
    for (const target of ['Aguardando orçamento', 'Aguardando aprovação'] as const) {
      for (const budgetStatus of ['sem_orcamento', 'pendente', 'aprovado', 'reprovado', 'reaberto'] as const) {
        expect(canAdvanceMaintenanceStatus(target, budgetStatus)).toBe(true);
      }
    }
  });
});

describe('isOrderPayable', () => {
  it('considera pagáveis os quatro status a partir da aprovação do orçamento', () => {
    expect(isOrderPayable('Orçamento aprovado', 'aprovado')).toBe(true);
    expect(isOrderPayable('Serviço em execução', 'aprovado')).toBe(true);
    expect(isOrderPayable('Concluído', 'aprovado')).toBe(true);
    expect(isOrderPayable('Veículo retirado', 'aprovado')).toBe(true);
  });

  it('recusa Cancelado e os status anteriores à aprovação mesmo com orçamento aprovado', () => {
    expect(isOrderPayable('Cancelado', 'aprovado')).toBe(false);
    expect(isOrderPayable('Aguardando orçamento', 'aprovado')).toBe(false);
    expect(isOrderPayable('Aguardando aprovação', 'aprovado')).toBe(false);
  });

  it('fixa a lista de status pagáveis na ordem do fluxo', () => {
    expect(PAYABLE_MAINTENANCE_STATUSES).toEqual([
      'Orçamento aprovado',
      'Serviço em execução',
      'Concluído',
      'Veículo retirado',
    ]);
  });

  it('recusa qualquer status quando o orçamento não está aprovado', () => {
    const statuses = [
      'Aguardando orçamento',
      'Aguardando aprovação',
      'Orçamento aprovado',
      'Serviço em execução',
      'Concluído',
      'Veículo retirado',
      'Cancelado',
    ] as const;
    for (const status of statuses) {
      expect(isOrderPayable(status, 'pendente')).toBe(false);
      expect(isOrderPayable(status, 'reprovado')).toBe(false);
      expect(isOrderPayable(status, 'sem_orcamento')).toBe(false);
      expect(isOrderPayable(status, 'reaberto')).toBe(false);
    }
  });
});

describe('describeStatusBlockReason', () => {
  it('descreve orçamento pendente e reaberto com mensagens distintas', () => {
    expect(describeStatusBlockReason('Concluído', 'pendente')).toBe(
      'Não é possível mudar para "Concluído": o orçamento ainda está aguardando aprovação.',
    );
    expect(describeStatusBlockReason('Veículo retirado', 'reaberto')).toBe(
      'Não é possível mudar para "Veículo retirado": o orçamento foi reaberto e ainda não foi reenviado para aprovação.',
    );
  });

  it('retorna undefined quando não há bloqueio', () => {
    expect(describeStatusBlockReason('Concluído', 'aprovado')).toBeUndefined();
    expect(describeStatusBlockReason('Cancelado', 'pendente')).toBeUndefined();
  });
});
