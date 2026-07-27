import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import React, { useState } from 'react';

import { listUnreadNotificationsForDriver, markNotificationRead } from '../services/vehicleLoanService';
import type { VehicleLoanNotification } from '../types/vehicleLoan';

interface Props {
  profileId: string;
}

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function messageFor(n: VehicleLoanNotification): string {
  if (n.kind === 'loan_created') {
    const plate = n.payload.license_plate ?? '';
    const temp = n.payload.temp_driver_name ?? '';
    const started = n.payload.started_at ? fmt(n.payload.started_at) : '';
    return `Seu veículo${plate ? ` (${plate})` : ''} foi emprestado${temp ? ` para ${temp}` : ''}${started ? ` em ${started}` : ''}.`;
  }
  if (n.kind === 'loan_ended_driver_changed') {
    const plate = n.payload.license_plate ?? '';
    const endedAt = n.payload.ended_at ? fmt(n.payload.ended_at) : '';
    return `O empréstimo do veículo${plate ? ` (${plate})` : ''} foi finalizado por troca de titular${endedAt ? ` em ${endedAt}` : ''}.`;
  }
  return 'Notificação de empréstimo.';
}

/**
 * Indicador mínimo de notificações de empréstimo para o motorista. Exibe um
 * contador de não-lidas e, ao abrir, lista as notificações com botão para
 * marcar como lida. Mantém-se enxuto — sem "central de notificações".
 */
export default function DriverLoanNotifications({ profileId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['driverLoanNotifications', profileId],
    queryFn: () => listUnreadNotificationsForDriver(profileId),
    enabled: !!profileId,
    staleTime: 0,
  });

  const markMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driverLoanNotifications', profileId] });
    },
  });

  const count = notifications.length;
  if (count === 0 && !open) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
          <Bell className="h-4 w-4 text-amber-500" />
          Notificações de empréstimo
          {count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {count}
            </span>
          )}
        </span>
        <span className="text-xs text-zinc-400">{open ? 'Fechar' : 'Abrir'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">Nenhuma notificação não lida.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-800">{messageFor(n)}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{fmt(n.createdAt)}</p>
                  {n.payload.notes && <p className="mt-1 text-xs text-zinc-500">Justificativa: {n.payload.notes}</p>}
                </div>
                <button
                  type="button"
                  disabled={markMutation.isPending}
                  onClick={() => markMutation.mutate(n.id)}
                  className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  title="Marcar como lida"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}