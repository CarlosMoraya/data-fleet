import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { getVehicleLoanStatusTag } from '../lib/vehicleLoanStatus';
import { listVehicleLoansByVehicle } from '../services/vehicleLoanService';
import type { VehicleLoan, VehicleLoanStatus } from '../types/vehicleLoan';

import { cn } from '../lib/utils';

interface Props {
  vehicleId: string;
  onSelect: (loan: VehicleLoan) => void;
}

type StatusFilter = 'all' | VehicleLoanStatus;

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function VehicleLoanHistory({ vehicleId, onSelect }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['vehicleLoans', vehicleId],
    queryFn: () => listVehicleLoansByVehicle(vehicleId),
    enabled: !!vehicleId,
    staleTime: 0,
  });

  const filtered = useMemo(
    () => (statusFilter === 'all' ? loans : loans.filter((l) => l.status === statusFilter)),
    [loans, statusFilter],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {(['all', 'active', 'completed', 'cancelled'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-medium',
              statusFilter === s ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
            )}
          >
            {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : s === 'completed' ? 'Concluídos' : 'Cancelados'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum empréstimo encontrado para este veículo.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-100">
            <thead className="bg-zinc-50">
              <tr>
                {['Motorista', 'Início', 'Fim', 'Status', 'Motivo', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 bg-white">
              {filtered.map((loan) => {
                const tag = getVehicleLoanStatusTag(loan);
                return (
                  <tr
                    key={loan.id}
                    onClick={() => onSelect(loan)}
                    className="cursor-pointer hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2.5 text-sm text-zinc-900">{loan.driverName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">{fmt(loan.startedAt)}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">{fmt(loan.endedAt)}</td>
                    <td className="px-3 py-2.5">
                      <span className={tag.className}>{tag.icon} {tag.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">{loan.endedReason ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" className="text-xs font-medium text-orange-600 hover:text-orange-700">Ver</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}