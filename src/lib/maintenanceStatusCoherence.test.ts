import { describe, expect, it } from 'vitest';

import {
  BUDGET_GATED_STATUSES,
  canAdvanceMaintenanceStatus,
  describeStatusBlockReason,
  isOrderPayable,
  PAYABLE_MAINTENANCE_STATUSES,
  requiresBudgetOverrideReason,
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
    // Os dois status pré-aprovação deixaram de ser livres com orçamento
    // 'aprovado' em 2026-09-20 — ver o describe dedicado logo abaixo.
    for (const target of ['Aguardando orçamento', 'Aguardando aprovação'] as const) {
      for (const budgetStatus of ['sem_orcamento', 'pendente', 'reprovado', 'reaberto'] as const) {
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

describe('canAdvanceMaintenanceStatus — Regra A', () => {
  it('só libera "Orçamento aprovado" quando o orçamento está aprovado', () => {
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', 'aprovado')).toBe(true);
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', 'sem_orcamento')).toBe(false);
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', 'pendente')).toBe(false);
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', 'reprovado')).toBe(false);
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', 'reaberto')).toBe(false);
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', undefined)).toBe(false);
    expect(canAdvanceMaintenanceStatus('Orçamento aprovado', null)).toBe(false);
  });
});

describe('describeStatusBlockReason — Regra A', () => {
  it('explica que o status vem da aprovação no Financeiro', () => {
    expect(describeStatusBlockReason('Orçamento aprovado', 'sem_orcamento')).toBe(
      'Não é possível mudar para "Orçamento aprovado": este status é definido automaticamente quando o orçamento é aprovado em Financeiro → Aprovação de Orçamentos.',
    );
  });

  it('não bloqueia quando o orçamento está aprovado', () => {
    expect(describeStatusBlockReason('Orçamento aprovado', 'aprovado')).toBeUndefined();
  });
});

describe('requiresBudgetOverrideReason — Regra C', () => {
  it('exige motivo ao entrar na faixa operacional sem orçamento aprovado', () => {
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Serviço em execução', 'sem_orcamento')).toBe(true);
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Serviço em execução', 'reprovado')).toBe(true);
    expect(requiresBudgetOverrideReason('Aguardando aprovação', 'Concluído', 'sem_orcamento')).toBe(true);
    expect(requiresBudgetOverrideReason('Orçamento aprovado', 'Serviço em execução', 'reprovado')).toBe(true);
    expect(requiresBudgetOverrideReason(undefined, 'Veículo retirado', 'sem_orcamento')).toBe(true);
    expect(requiresBudgetOverrideReason(null, 'Serviço em execução', 'sem_orcamento')).toBe(true);
  });

  it('não exige motivo em transições dentro da faixa operacional', () => {
    expect(requiresBudgetOverrideReason('Serviço em execução', 'Concluído', 'sem_orcamento')).toBe(false);
    expect(requiresBudgetOverrideReason('Concluído', 'Veículo retirado', 'sem_orcamento')).toBe(false);
    expect(requiresBudgetOverrideReason('Concluído', 'Veículo retirado', 'reprovado')).toBe(false);
    expect(requiresBudgetOverrideReason('Serviço em execução', 'Serviço em execução', 'sem_orcamento')).toBe(false);
  });

  it('não exige motivo quando o orçamento está aprovado', () => {
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Serviço em execução', 'aprovado')).toBe(false);
  });

  it('cede ao bloqueio duro de pendente e reaberto', () => {
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Serviço em execução', 'pendente')).toBe(false);
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Serviço em execução', 'reaberto')).toBe(false);
  });

  it('não exige motivo para alvos fora da faixa operacional', () => {
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Cancelado', 'sem_orcamento')).toBe(false);
    expect(requiresBudgetOverrideReason('Aguardando orçamento', 'Aguardando aprovação', 'sem_orcamento')).toBe(false);
    expect(requiresBudgetOverrideReason(undefined, 'Aguardando orçamento', 'sem_orcamento')).toBe(false);
  });
});

describe('canAdvanceMaintenanceStatus — orçamento aprovado não volta para a faixa pré-aprovação', () => {
  it('bloqueia os dois status anteriores à decisão do orçamento', () => {
    expect(canAdvanceMaintenanceStatus('Aguardando orçamento', 'aprovado')).toBe(false);
    expect(canAdvanceMaintenanceStatus('Aguardando aprovação', 'aprovado')).toBe(false);
  });

  it('libera a volta em todos os demais estados do orçamento', () => {
    for (const target of ['Aguardando orçamento', 'Aguardando aprovação'] as const) {
      expect(canAdvanceMaintenanceStatus(target, 'pendente')).toBe(true);
      expect(canAdvanceMaintenanceStatus(target, 'reaberto')).toBe(true);
      expect(canAdvanceMaintenanceStatus(target, 'reprovado')).toBe(true);
      expect(canAdvanceMaintenanceStatus(target, 'sem_orcamento')).toBe(true);
      expect(canAdvanceMaintenanceStatus(target, undefined)).toBe(true);
      expect(canAdvanceMaintenanceStatus(target, null)).toBe(true);
    }
  });

  it('não interfere nos demais alvos com orçamento aprovado', () => {
    expect(canAdvanceMaintenanceStatus('Serviço em execução', 'aprovado')).toBe(true);
    expect(canAdvanceMaintenanceStatus('Concluído', 'aprovado')).toBe(true);
    expect(canAdvanceMaintenanceStatus('Veículo retirado', 'aprovado')).toBe(true);
    expect(canAdvanceMaintenanceStatus('Cancelado', 'aprovado')).toBe(true);
  });
});

describe('describeStatusBlockReason — faixa pré-aprovação', () => {
  it('nomeia o status alvo e aponta "Reabrir orçamento" como caminho correto', () => {
    expect(describeStatusBlockReason('Aguardando aprovação', 'aprovado')).toBe(
      'Este orçamento já foi aprovado no Financeiro, então a OS não volta para "Aguardando aprovação". Para revisá-lo, use "Reabrir orçamento".',
    );
    expect(describeStatusBlockReason('Aguardando orçamento', 'aprovado')).toBe(
      'Este orçamento já foi aprovado no Financeiro, então a OS não volta para "Aguardando orçamento". Para revisá-lo, use "Reabrir orçamento".',
    );
  });

  it('não descreve bloqueio quando o orçamento não está aprovado', () => {
    expect(describeStatusBlockReason('Aguardando aprovação', 'pendente')).toBeUndefined();
    expect(describeStatusBlockReason('Aguardando orçamento', 'reaberto')).toBeUndefined();
  });
});
