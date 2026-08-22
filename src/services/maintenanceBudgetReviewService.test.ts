import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  listBudgetReviewEvents,
  recordBudgetReview,
  reopenRejectedBudget,
} from './maintenanceBudgetReviewService';

/** Monta o mock de leitura da OS + insert no ledger + update da OS. */
function mockSupabase(options: {
  budgetStatus?: string | null;
  readError?: unknown;
  insertError?: unknown;
  updateError?: unknown;
} = {}) {
  const { budgetStatus = 'reprovado', readError = null, insertError = null, updateError = null } = options;

  const orderSingle = vi.fn().mockResolvedValue({
    data: readError ? null : { budget_status: budgetStatus, budget_rejection_reason: 'Valor acima do praticado' },
    error: readError,
  });
  const orderSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: orderSingle })) }));
  const orderUpdateEq = vi.fn().mockResolvedValue({ error: updateError });
  const orderUpdate = vi.fn((_payload: Record<string, unknown>) => ({ eq: orderUpdateEq }));
  const reviewInsert = vi.fn((_row: Record<string, unknown>) => Promise.resolve({ error: insertError }));

  fromMock.mockImplementation((table: string) => {
    if (table === 'maintenance_orders') return { select: orderSelect, update: orderUpdate };
    if (table === 'maintenance_budget_reviews') return { insert: reviewInsert };
    throw new Error(`Tabela inesperada: ${table}`);
  });

  return { orderSelect, orderUpdate, orderUpdateEq, reviewInsert };
}

beforeEach(() => {
  fromMock.mockReset();
});

describe('recordBudgetReview', () => {
  it('insere a linha do livro-razão com o autor da decisão', async () => {
    const { reviewInsert } = mockSupabase();

    await recordBudgetReview({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      decision: 'reprovado',
      reason: 'Valor acima do praticado',
      budgetTotal: 1370,
      profileId: 'p1',
    });

    expect(reviewInsert).toHaveBeenCalledWith({
      maintenance_order_id: 'os-1',
      client_id: 'c1',
      decision: 'reprovado',
      reason: 'Valor acima do praticado',
      budget_total: 1370,
      decided_by: 'p1',
    });
  });

  it('aprovação grava reason nulo', async () => {
    const { reviewInsert } = mockSupabase();

    await recordBudgetReview({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      decision: 'aprovado',
      budgetTotal: 1370,
      profileId: 'p1',
    });

    expect(reviewInsert.mock.calls[0][0]).toMatchObject({ decision: 'aprovado', reason: null });
  });

  it('propaga o erro do Supabase', async () => {
    mockSupabase({ insertError: { message: 'insert failed' } });

    await expect(recordBudgetReview({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      decision: 'reaberto',
      reason: 'Erro de digitação no valor',
      profileId: 'p1',
    })).rejects.toBeTruthy();
  });
});

describe('reopenRejectedBudget', () => {
  it('cenário feliz: grava o evento de reabertura e devolve a OS ao estado editável', async () => {
    const { reviewInsert, orderUpdate } = mockSupabase({ budgetStatus: 'reprovado' });

    await reopenRejectedBudget({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      reason: 'Oficina corrigiu o valor da mão de obra',
      profileId: 'p1',
    });

    expect(reviewInsert).toHaveBeenCalledWith({
      maintenance_order_id: 'os-1',
      client_id: 'c1',
      decision: 'reaberto',
      reason: 'Oficina corrigiu o valor da mão de obra',
      budget_total: null,
      decided_by: 'p1',
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      budget_status: 'reaberto',
      status: 'Aguardando orçamento',
      budget_rejection_reason: null,
    });
  });

  it('CRÍTICO: OS aprovada é recusada e nenhum update é executado', async () => {
    const { orderUpdate, reviewInsert } = mockSupabase({ budgetStatus: 'aprovado' });

    await expect(reopenRejectedBudget({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      reason: 'Quero editar os itens',
      profileId: 'p1',
    })).rejects.toThrow('Somente orçamentos reprovados podem ser reabertos.');

    expect(orderUpdate).not.toHaveBeenCalled();
    expect(reviewInsert).not.toHaveBeenCalled();
  });

  it('estados pendente e sem_orcamento também são recusados', async () => {
    for (const status of ['pendente', 'sem_orcamento', 'reaberto']) {
      const { orderUpdate } = mockSupabase({ budgetStatus: status });
      await expect(reopenRejectedBudget({
        maintenanceOrderId: 'os-1',
        clientId: 'c1',
        reason: 'Justificativa qualquer',
        profileId: 'p1',
      })).rejects.toThrow('Somente orçamentos reprovados podem ser reabertos.');
      expect(orderUpdate).not.toHaveBeenCalled();
    }
  });

  it('justificativa vazia lança sem nenhuma chamada ao Supabase', async () => {
    mockSupabase();

    await expect(reopenRejectedBudget({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      reason: '   ',
      profileId: 'p1',
    })).rejects.toThrow('Informe a justificativa da reabertura.');

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('edge case: falha ao gravar o evento impede o update da OS', async () => {
    const { orderUpdate } = mockSupabase({ insertError: { message: 'rls denied' } });

    await expect(reopenRejectedBudget({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      reason: 'Oficina corrigiu o valor',
      profileId: 'p1',
    })).rejects.toBeTruthy();

    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('propaga erro do update final da OS', async () => {
    mockSupabase({ updateError: { message: 'trigger blocked' } });

    await expect(reopenRejectedBudget({
      maintenanceOrderId: 'os-1',
      clientId: 'c1',
      reason: 'Oficina corrigiu o valor',
      profileId: 'p1',
    })).rejects.toBeTruthy();
  });
});

describe('listBudgetReviewEvents', () => {
  function mockList(data: unknown, error: unknown = null) {
    const order = vi.fn().mockResolvedValue({ data, error });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'maintenance_budget_reviews') return { select };
      throw new Error(`Tabela inesperada: ${table}`);
    });
    return { select, eq, order };
  }

  it('devolve a linha do tempo mapeada, da mais recente para a mais antiga', async () => {
    const { select, eq, order } = mockList([
      {
        id: 'rev-2', maintenance_order_id: 'os-1', decision: 'reaberto',
        reason: 'Oficina corrigiu o valor', budget_total: null,
        decided_at: '2026-08-22T12:00:00Z', decided_by_profile: { name: 'Ana' },
      },
      {
        id: 'rev-1', maintenance_order_id: 'os-1', decision: 'reprovado',
        reason: 'Valor acima do praticado', budget_total: '1370.00',
        decided_at: '2026-08-21T12:00:00Z', decided_by_profile: { name: 'Bruno' },
      },
    ]);

    const events = await listBudgetReviewEvents('os-1');

    expect(select).toHaveBeenCalledWith('*, decided_by_profile:profiles!decided_by (name)');
    expect(eq).toHaveBeenCalledWith('maintenance_order_id', 'os-1');
    expect(order).toHaveBeenCalledWith('decided_at', { ascending: false });
    expect(events.map(e => e.decision)).toEqual(['reaberto', 'reprovado']);
    expect(events[1].budgetTotal).toBe(1370);
    expect(events[0].decidedByName).toBe('Ana');
  });

  it('propaga o erro da query', async () => {
    mockList(null, { message: 'select failed' });
    await expect(listBudgetReviewEvents('os-1')).rejects.toBeTruthy();
  });
});
