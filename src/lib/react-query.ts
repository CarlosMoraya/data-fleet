import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minuto
      gcTime: 1000 * 60 * 5, // 5 minutos (antigo cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Evita refetch agressivo ao trocar de aba (opcional, pode ser true se preferir dados sempre frescos)
    },
  },
});
