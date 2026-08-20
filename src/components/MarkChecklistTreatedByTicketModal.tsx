import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { fleetTicketStatusLabel, isFleetTicketReadOnly } from '../lib/fleetTicketRules';
import { markChecklistTreatedByTicket } from '../services/checklistActionPlanService';
import { listFleetTickets } from '../services/fleetTicketService';

import type { Checklist } from '../types';
import type { FleetTicket } from '../types/fleetTicket';

interface Props {
  checklist: Checklist;
  onClose: () => void;
  onMarked: () => void;
}

export default function MarkChecklistTreatedByTicketModal({ checklist, onClose, onMarked }: Props) {
  const { currentClient, user } = useAuth();
  const [tickets, setTickets] = useState<FleetTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    const clientId = currentClient?.id;

    const loadTickets = async () => {
      setLoading(true);
      setLoadError('');
      setTickets([]);
      setSelectedTicketId('');
      if (!clientId) {
        setLoading(false);
        return;
      }
      try {
        const result = await listFleetTickets(clientId);
        if (!active) return;
        setTickets(
          result
            .filter((ticket) => ticket.vehicleId === checklist.vehicleId)
            .sort((left, right) => Number(isFleetTicketReadOnly(left.status)) - Number(isFleetTicketReadOnly(right.status))),
        );
      } catch (error) {
        console.error('listFleetTickets failed in treatment modal', error);
        if (active) setLoadError('Não foi possível carregar os chamados. Tente novamente.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadTickets();
    return () => {
      active = false;
    };
  }, [checklist.vehicleId, currentClient?.id]);

  const handleMark = async () => {
    if (!selectedTicketId) {
      setSaveError('Selecione um chamado.');
      return;
    }
    if (!currentClient?.id || !user?.id) {
      setSaveError('Você não tem permissão para marcar este checklist.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await markChecklistTreatedByTicket({
        clientId: currentClient.id,
        checklistId: checklist.id,
        fleetTicketId: selectedTicketId,
        markedBy: user.id,
      });
      onMarked();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? 'Não foi possível marcar este checklist.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDisabled = loading || saving || tickets.length === 0 || !selectedTicketId;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Marcar tratamento por chamado</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {checklist.templateName} — {checklist.vehicleLicensePlate ?? 'sem veículo'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100" aria-label="Fechar">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          {(loadError || saveError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {loadError || saveError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando chamados...</span>
            </div>
          ) : loadError ? null : tickets.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum chamado encontrado para este veículo.</p>
          ) : (
            <div>
              <label htmlFor="checklist-treatment-ticket" className="mb-1 block text-sm font-medium text-zinc-700">
                Chamado <span className="text-red-500">*</span>
              </label>
              <select
                id="checklist-treatment-ticket"
                value={selectedTicketId}
                onChange={(event) => setSelectedTicketId(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="">— Selecione —</option>
                {tickets.map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>
                    Chamado {ticket.ticketNumber ?? '—'} — {ticket.title} ({fleetTicketStatusLabel(ticket.status)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-sm text-zinc-600">
            Ao marcar, não será mais possível criar plano de ação a partir deste checklist. A marcação pode ser desfeita depois.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { void handleMark(); }}
            disabled={confirmDisabled}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Marcar tratamento
          </button>
        </div>
      </div>
    </div>
  );
}
