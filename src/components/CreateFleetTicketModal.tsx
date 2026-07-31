import { useQuery } from '@tanstack/react-query';
import { Camera, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import {
  FLEET_TICKET_CRITICALITY_DESCRIPTIONS,
  evaluateFleetTicketOdometer,
  requiresFleetTicketPhoto,
} from '../lib/fleetTicketRules';
import { createFleetTicketReport, listVehiclesForFleetTicketReport } from '../services/fleetTicketService';
import { getVehicleLastKmMap } from '../services/vehicleOdometerService';
import { supabase } from '../lib/supabase';
import CameraCapture from './CameraCapture';
import LastKmLabel from './LastKmLabel';

import type { FleetTicketCriticality } from '../types/fleetTicket';

interface CreateFleetTicketModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}

const CRITICALITY_OPTIONS: Array<{ value: FleetTicketCriticality; label: string }> = [
  { value: 'critical', label: 'Crítico' },
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Médio' },
  { value: 'low', label: 'Baixo' },
];

interface OdometerIntervalSettingsRow {
  odometer_km_tolerance_per_day: number | null;
}

export default function CreateFleetTicketModal({ open, onClose, onCreated }: CreateFleetTicketModalProps) {
  const { currentClient } = useAuth();
  const [vehicleId, setVehicleId] = useState('');
  const [criticality, setCriticality] = useState<FleetTicketCriticality | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kmInput, setKmInput] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vehiclesQuery = useQuery({
    queryKey: ['fleetTicketReportVehicles', currentClient?.id],
    queryFn: listVehiclesForFleetTicketReport,
    enabled: open && !!currentClient?.id,
  });

  const lastKmQuery = useQuery({
    queryKey: ['vehicleLastKmMap', vehicleId],
    queryFn: () => getVehicleLastKmMap([vehicleId]),
    enabled: open && !!vehicleId,
  });

  const odometerIntervalQuery = useQuery({
    queryKey: ['checklistDayIntervals', currentClient?.id, 'odometer'],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('checklist_day_intervals')
        .select('odometer_km_tolerance_per_day, odometer_update_day_interval')
        .eq('client_id', currentClient!.id)
        .maybeSingle();
      if (queryError) throw queryError;
      return data as OdometerIntervalSettingsRow | null;
    },
    enabled: open && !!currentClient?.id,
  });

  if (!open) return null;

  const lastKmInfo = lastKmQuery.data?.get(vehicleId) ?? null;
  const odometerAdvice = evaluateFleetTicketOdometer({
    rawValue: kmInput,
    lastOfficialKm: lastKmInfo?.value ?? null,
    lastReadingAt: null,
    tolerancePerDay: odometerIntervalQuery.data?.odometer_km_tolerance_per_day ?? null,
  });

  const photoRequired = requiresFleetTicketPhoto('report', criticality || undefined);
  const kmBlocking = odometerAdvice.level === 'empty' || odometerAdvice.level === 'invalid';

  const handleKmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setKmInput(event.target.value.replace(/\D/g, ''));
  };

  const handlePhotoCapture = (file: File) => {
    setPhotos((prev) => [...prev, file].slice(0, 3));
    setCameraOpen(false);
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
    if (!criticality) {
      setError('Selecione a criticidade do chamado.');
      return;
    }
    if (kmBlocking) {
      setError(odometerAdvice.level === 'invalid' ? odometerAdvice.message : 'Informe o Km atual do veículo.');
      return;
    }
    if (photoRequired && photos.length === 0) {
      setError('Foto obrigatória para chamados críticos.');
      return;
    }

    setSaving(true);
    try {
      const result = await createFleetTicketReport({
        clientId: currentClient.id,
        vehicleId,
        title: title.trim(),
        description: description.trim(),
        files: photos,
        odometerKm: odometerAdvice.level === 'ok' || odometerAdvice.level === 'below' || odometerAdvice.level === 'above'
          ? odometerAdvice.value
          : 0,
        criticality,
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

  const canSubmit = !saving && !vehiclesQuery.isLoading && !kmBlocking && !(photoRequired && photos.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative my-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Novo chamado</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Classifique a criticidade e informe o Km atual do veículo.</p>
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
            <label htmlFor="fleet-ticket-criticality" className="mb-1.5 block text-sm font-medium text-zinc-700">Criticidade *</label>
            <select
              id="fleet-ticket-criticality"
              value={criticality}
              onChange={(event) => setCriticality(event.target.value as FleetTicketCriticality)}
              disabled={saving}
              className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {CRITICALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {criticality ? (
              <p className="mt-1.5 text-xs text-zinc-500">{FLEET_TICKET_CRITICALITY_DESCRIPTIONS[criticality]}</p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-xs text-zinc-500">
                {CRITICALITY_OPTIONS.map((option) => (
                  <li key={option.value}><span className="font-medium text-zinc-600">{option.label}:</span> {FLEET_TICKET_CRITICALITY_DESCRIPTIONS[option.value]}</li>
                ))}
              </ul>
            )}
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
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="fleet-ticket-km" className="text-sm font-medium text-zinc-700">Km atual *</label>
              <LastKmLabel info={lastKmInfo} />
            </div>
            <input
              id="fleet-ticket-km"
              inputMode="numeric"
              value={kmInput}
              onChange={handleKmChange}
              disabled={saving}
              className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none"
            />
            {(odometerAdvice.level === 'below' || odometerAdvice.level === 'above') && (
              <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{odometerAdvice.message}</p>
            )}
            {odometerAdvice.level === 'invalid' && (
              <p className="mt-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{odometerAdvice.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-700">
              <Camera className="h-4 w-4 text-zinc-400" />
              {photoRequired ? 'Foto obrigatória para chamados críticos' : 'Fotos (opcional, até 3)'}
            </label>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={saving || photos.length >= 3}
              className="flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Tirar foto
            </button>
            {photos.length > 0 && <p className="mt-1 text-xs text-zinc-500">{photos.length} foto(s) capturada(s).</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100" disabled={saving}>Cancelar</button>
          <button type="button" onClick={() => { void handleCreate(); }} disabled={!canSubmit} className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar chamado
          </button>
        </div>
      </div>

      {cameraOpen && (
        <CameraCapture
          requireLiveCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => handlePhotoCapture(file)}
        />
      )}
    </div>
  );
}
