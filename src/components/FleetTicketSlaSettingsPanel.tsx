import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Timer } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { FLEET_TICKET_SLA_HOURS_MAX, FLEET_TICKET_SLA_HOURS_MIN } from '../lib/fleetTicketSla';
import { getFleetTicketSlaSettings, saveFleetTicketSlaSettings } from '../services/fleetTicketSlaSettingsService';

import type { ClientFleetTicketSlaSettings } from '../types/fleetTicket';

export interface FleetTicketSlaSettingsPanelProps {
  clientId: string;
  userId: string;
}

const defaultSettings = (clientId: string): ClientFleetTicketSlaSettings => ({
  clientId,
  openSlaHours: 24,
  assignedSlaHours: 72,
});

function isInRange(value: number): boolean {
  return Number.isInteger(value) && value >= FLEET_TICKET_SLA_HOURS_MIN && value <= FLEET_TICKET_SLA_HOURS_MAX;
}

export default function FleetTicketSlaSettingsPanel({ clientId, userId }: FleetTicketSlaSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ClientFleetTicketSlaSettings>(() => defaultSettings(clientId));
  const [isDirty, setIsDirty] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['fleetTicketSlaSettings', clientId],
    queryFn: () => getFleetTicketSlaSettings(clientId),
    enabled: !!clientId,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
      setIsDirty(false);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveFleetTicketSlaSettings(settings, userId),
    onSuccess: (saved) => {
      setSettings(saved);
      setIsDirty(false);
      setError(null);
      setSuccess('Configurações de SLA salvas com sucesso.');
      void queryClient.invalidateQueries({ queryKey: ['fleetTicketSlaSettings', clientId] });
    },
    onError: (mutationError: Error) => {
      setSuccess(null);
      setError(mutationError.message || 'Não foi possível salvar as configurações de SLA.');
    },
  });

  const updateSettings = (update: Partial<ClientFleetTicketSlaSettings>) => {
    setSettings((current) => ({ ...current, ...update }));
    setIsDirty(true);
    setSuccess(null);
    setError(null);
  };

  const valuesInRange = isInRange(settings.openSlaHours) && isInRange(settings.assignedSlaHours);

  if (settingsQuery.isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="animate-in fade-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm duration-300">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
        <Timer className="h-5 w-5 text-zinc-400" />
        <div>
          <h2 className="text-lg font-medium text-zinc-900">SLA de Chamados</h2>
          <p className="text-sm text-zinc-500">Defina em quantas horas um chamado deve sair de cada situação.</p>
        </div>
      </div>

      {(settingsQuery.isError || error) && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Não foi possível carregar as configurações de SLA.'}
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      <div className="space-y-6 px-6 py-5">
        <label className="block" htmlFor="sla-open-hours">
          <span className="mb-1 block text-sm font-medium text-zinc-800">Chamado sem responsável (horas)</span>
          <span className="mb-2 block text-xs text-zinc-500">Vale enquanto ninguém assumiu o atendimento. Padrão: 24 h.</span>
          <input
            id="sla-open-hours"
            type="number"
            min={1}
            max={8760}
            step={1}
            value={settings.openSlaHours}
            onChange={(event) => updateSettings({ openSlaHours: Number(event.target.value) })}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
          />
        </label>

        <label className="block" htmlFor="sla-assigned-hours">
          <span className="mb-1 block text-sm font-medium text-zinc-800">Chamado assumido (horas)</span>
          <span className="mb-2 block text-xs text-zinc-500">
            Vale depois que um agente de frota assume o chamado. A contagem não reinicia — continua valendo desde a abertura. Padrão: 72 h.
          </span>
          <input
            id="sla-assigned-hours"
            type="number"
            min={1}
            max={8760}
            step={1}
            value={settings.assignedSlaHours}
            onChange={(event) => updateSettings({ assignedSlaHours: Number(event.target.value) })}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
          />
        </label>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Chamados que ultrapassam o SLA recebem um alerta visual na tela de Chamados: vermelho quando ninguém assumiu, âmbar quando já há um responsável.
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending || !valuesInRange}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
