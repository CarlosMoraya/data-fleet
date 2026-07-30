import { Loader2, Paperclip, X } from 'lucide-react';
import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { createFleetTicketReport, listVehiclesForFleetTicketReport } from '../services/fleetTicketService';
import { useQuery } from '@tanstack/react-query';

interface CreateFleetTicketModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}

export default function CreateFleetTicketModal({ open, onClose, onCreated }: CreateFleetTicketModalProps) {
  const { currentClient } = useAuth();
  const [vehicleId, setVehicleId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehiclesQuery = useQuery({
    queryKey: ['fleetTicketReportVehicles', currentClient?.id],
    queryFn: listVehiclesForFleetTicketReport,
    enabled: open && !!currentClient?.id,
  });

  if (!open) return null;

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected.slice(0, 3));
    if (selected.length > 3) setError('O limite desta versão é de 3 anexos.');
  };

  const handleCreate = async () => {
    setError(null);
    if (!currentClient?.id) {
      setError('Selecione um cliente antes de criar o chamado.');
      return;
    }
    if (!vehicleId) {
      setError('Selecione um veículo.');
      return;
    }
    if (title.trim().length < 5) {
      setError('Informe um título com pelo menos 5 caracteres.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Informe uma descrição com pelo menos 10 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const result = await createFleetTicketReport({
        clientId: currentClient.id,
        vehicleId,
        title: title.trim(),
        description: description.trim(),
        files,
      });
      if (result.uploadWarnings.length > 0) {
        setError('Chamado criado, mas um ou mais anexos não foram enviados.');
      }
      onCreated(result.ticketId);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Não foi possível criar o chamado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative my-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Novo chamado</h2>
            <p className="mt-0.5 text-xs text-zinc-500">A criticidade será classificada pela Frota.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-zinc-100" aria-label="Fechar">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

          <div>
            <label htmlFor="fleet-ticket-vehicle" className="mb-1.5 block text-sm font-medium text-zinc-700">Veículo *</label>
            <select
              id="fleet-ticket-vehicle"
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              disabled={vehiclesQuery.isLoading || saving}
              className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {(vehiclesQuery.data ?? []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="fleet-ticket-title" className="mb-1.5 block text-sm font-medium text-zinc-700">Título *</label>
            <input
              id="fleet-ticket-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={saving}
              minLength={5}
              className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="fleet-ticket-description" className="mb-1.5 block text-sm font-medium text-zinc-700">Descrição *</label>
            <textarea
              id="fleet-ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving}
              minLength={10}
              rows={4}
              className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="fleet-ticket-files" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-700">
              <Paperclip className="h-4 w-4 text-zinc-400" /> Anexos (opcional, até 3)
            </label>
            <input id="fleet-ticket-files" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleFiles} disabled={saving} className="block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-orange-700" />
            {files.length > 0 && <p className="mt-1 text-xs text-zinc-500">{files.length} anexo(s) selecionado(s).</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100" disabled={saving}>Cancelar</button>
          <button type="button" onClick={() => { void handleCreate(); }} disabled={saving || vehiclesQuery.isLoading} className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar chamado
          </button>
        </div>
      </div>
    </div>
  );
}
