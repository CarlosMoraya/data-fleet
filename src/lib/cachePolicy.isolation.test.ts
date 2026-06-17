import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { shouldPersistQuery } from './cachePolicy';

describe('cache isolation', () => {
  it('keeps same-prefix data isolated by client_id and excludes PII', () => {
    const queryClient = new QueryClient();
    const now = Date.now();
    const clienteAData = [{ id: 'a1' }];
    const clienteBData = [{ id: 'b1' }];

    queryClient.setQueryData(['vehicles', 'clienteA'], clienteAData);
    queryClient.setQueryData(['vehicles', 'clienteB'], clienteBData);

    expect(queryClient.getQueryData(['vehicles', 'clienteA'])).toBe(clienteAData);
    expect(queryClient.getQueryData(['vehicles', 'clienteB'])).toBe(clienteBData);
    expect(queryClient.getQueryData(['vehicles', 'clienteA'])).not.toBe(clienteBData);

    expect(shouldPersistQuery(['vehicles', 'clienteA'], now, now)).toBe(true);
    expect(shouldPersistQuery(['vehicles', 'clienteB'], now, now)).toBe(true);
    expect(shouldPersistQuery(['drivers', 'clienteA'], now, now)).toBe(false);
  });
});
