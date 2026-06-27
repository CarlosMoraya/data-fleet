import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, X } from 'lucide-react';
import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { validateOdometerCorrection } from '../lib/odometerCorrectionValidation';
import { canCorrectOdometer } from '../lib/rolePermissions';
import {
  createOdometerCorrection,
  listVehicleOdometerHistory,
} from '../services/odometerCorrectionService';

import type { OdometerReading } from '../types/odometerCorrection';

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function formatKm(value: number): string {
  return value.toLocaleString('pt-BR');
}

function StatusBadge({ corrected, hasEvidence }: { corrected: boolean; hasEvidence: boolean }) {
  const styles = corrected
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : hasEvidence
      ? 'bg-sky-100 text-sky-700 border-sky-200'
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';
  const label = corrected ? 'Corrigido' : hasEvidence ? 'Válido com evidência' : 'Válido';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

function KmHistoryTable({
  readings,
  canCorrect,
  onCorrect,
}: {
  readings: OdometerReading[];
  canCorrect: boolean;
  onCorrect: (reading: OdometerReading) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr className="text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">KM informado</th>
              <th className="px-4 py-3">KM válido</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registrado por</th>
              {canCorrect && <th className="px-4 py-3">Ação</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {readings.map((reading) => (
              <tr key={reading.checklistId} className="text-zinc-700">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(reading.readingAt)}</td>
                <td className="px-4 py-3">{reading.sourceContext ?? 'Checklist'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatKm(reading.originalKm)}</td>
                <td className="px-4 py-3 font-medium whitespace-nowrap text-zinc-900">{formatKm(reading.effectiveKm)}</td>
                <td className="px-4 py-3"><StatusBadge corrected={reading.isCorrected} hasEvidence={reading.hasEvidence} /></td>
                <td className="px-4 py-3">{reading.isCorrected ? reading.correctedBy ?? '—' : '—'}</td>
                {canCorrect && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onCorrect(reading)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Corrigir KM
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CorrectKmModal({
  reading,
  vehicleId,
  correctedBy,
  onClose,
}: {
  reading: OdometerReading;
  vehicleId: string;
  correctedBy: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rawValue, setRawValue] = useState(String(reading.effectiveKm));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createOdometerCorrection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicle-odometer-history', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['lastOdometerKm', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['lastOdometerReadingAt', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['warrantyOverview'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-vehicle-km'] });
      onClose();
    },
    onError: (err) => {
      console.error(err);
      setError('Não foi possível salvar a correção.');
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const validation = validateOdometerCorrection({ rawValue, reason });
    if (!validation.ok) {
      setError('message' in validation ? validation.message : 'Não foi possível validar a correção.');
      return;
    }
    mutation.mutate({
      checklistId: reading.checklistId,
      correctedKm: validation.correctedKm,
      reason: reason.trim(),
      correctedBy,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Corrigir KM</h3>
            <p className="text-sm text-zinc-500">KM informado: {formatKm(reading.originalKm)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Km correto</span>
            <input
              type="number"
              min="0"
              value={rawValue}
              onChange={(event) => setRawValue(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Motivo</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar correção
          </button>
        </div>
      </form>
    </div>
  );
}

export default function VehicleKmHistoryTab({ vehicleId }: { vehicleId: string }) {
  const { user } = useAuth();
  const [editingReading, setEditingReading] = useState<OdometerReading | null>(null);
  const canCorrect = canCorrectOdometer(user?.role);
  const { data: readings = [], isLoading, isError } = useQuery({
    queryKey: ['vehicle-odometer-history', vehicleId],
    queryFn: () => listVehicleOdometerHistory(vehicleId),
  });

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Carregando histórico de KM...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600">Não foi possível carregar o histórico. Recarregue a tela.</p>;
  }

  if (readings.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhuma leitura de KM registrada para este veículo.</p>;
  }

  return (
    <>
      <KmHistoryTable readings={readings} canCorrect={canCorrect} onCorrect={setEditingReading} />
      {editingReading && user?.id && (
        <CorrectKmModal
          reading={editingReading}
          vehicleId={vehicleId}
          correctedBy={user.id}
          onClose={() => setEditingReading(null)}
        />
      )}
    </>
  );
}
