import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutos — navegação normal sem dado obsoleto
      gcTime: 1000 * 60 * 15,   // 15 minutos — cache na memória por sessão típica de uso
      retry: 1,
      refetchOnWindowFocus: true, // Revalida ao voltar para a aba apenas se dados tiverem > 3 min
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'betafleet-rq-cache',
});
