import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { getYardAuditorActionPlanLabels } from './actionPlanLabelsService';

describe('getYardAuditorActionPlanLabels', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('retorna [] sem chamar rpc quando a lista está vazia', async () => {
    const result = await getYardAuditorActionPlanLabels([]);
    expect(result).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('chama a rpc e converte as linhas para camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          action_plan_id: 'p1',
          reported_by_name: 'Beatriz Lima',
          assigned_by_name: null,
          claimed_by_name: null,
          completed_by_name: null,
          responsible_name: 'Carlos Auditor',
          template_name: null,
          item_title: null,
        },
      ],
      error: null,
    });

    const result = await getYardAuditorActionPlanLabels(['p1']);

    expect(rpcMock).toHaveBeenCalledWith('get_yard_auditor_action_plan_labels', { p_action_plan_ids: ['p1'] });
    expect(result[0].reportedByName).toBe('Beatriz Lima');
    expect(result[0].responsibleName).toBe('Carlos Auditor');
    expect(result[0].templateName).toBeUndefined();
  });

  it('propaga erro da rpc', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getYardAuditorActionPlanLabels(['p1'])).rejects.toEqual({ message: 'boom' });
  });
});
