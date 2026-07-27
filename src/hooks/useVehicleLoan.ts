import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeVehicleLoan,
  createVehicleLoan,
  getActiveVehicleLoan,
  type CompleteVehicleLoanParams,
  type CreateVehicleLoanParams,
} from '../services/vehicleLoanService';

export interface UseVehicleLoanResult {
  activeLoan: Awaited<ReturnType<typeof getActiveVehicleLoan>>;
  isLoading: boolean;
  createLoan: (params: CreateVehicleLoanParams) => Promise<string>;
  completeLoan: (params: CompleteVehicleLoanParams) => Promise<void>;
  isCreating: boolean;
  isCompleting: boolean;
}

export function useVehicleLoan(vehicleId?: string): UseVehicleLoanResult {
  const queryClient = useQueryClient();

  const { data: activeLoan = null, isLoading } = useQuery({
    queryKey: ['activeVehicleLoan', vehicleId],
    queryFn: () => getActiveVehicleLoan(vehicleId!),
    enabled: !!vehicleId,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: (params: CreateVehicleLoanParams) => createVehicleLoan(params),
    onSuccess: () => {
      if (vehicleId) {
        void queryClient.invalidateQueries({ queryKey: ['activeVehicleLoan', vehicleId] });
        void queryClient.invalidateQueries({ queryKey: ['vehicleLoans', vehicleId] });
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: (params: CompleteVehicleLoanParams) => completeVehicleLoan(params),
    onSuccess: () => {
      if (vehicleId) {
        void queryClient.invalidateQueries({ queryKey: ['activeVehicleLoan', vehicleId] });
        void queryClient.invalidateQueries({ queryKey: ['vehicleLoans', vehicleId] });
      }
    },
  });

  return {
    activeLoan,
    isLoading,
    createLoan: (params) => createMutation.mutateAsync(params),
    completeLoan: (params) => completeMutation.mutateAsync(params),
    isCreating: createMutation.isPending,
    isCompleting: completeMutation.isPending,
  };
}