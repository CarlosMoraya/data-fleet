import { QueryClient } from '@tanstack/react-query';

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
