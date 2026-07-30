import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { capturePosition } from '../lib/geolocation';
import { canOpenSosTicket } from '../lib/fleetTicketRules';
import {
  createSosTicket,
  listVehiclesForSos,
} from '../services/fleetTicketService';

import type {
  FleetTicketLocationStatus,
  FleetTicketSosType,
} from '../types/fleetTicket';

const SOS_TYPES: Array<{ value: FleetTicketSosType; label: string }> = [
  { value: 'breakdown', label: 'Veículo enguiçado' },
  { value: 'collision', label: 'Colisão/Sinistro' },
  { value: 'theft', label: 'Roubo do veículo' },
];

function locationStatusLabel(status: FleetTicketLocationStatus): string {
  if (status === 'captured') return 'captured';
  if (status === 'denied') return 'denied';
  return 'unavailable';
}

export default function SosTicket() {
  const { user, currentClient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [vehicleId, setVehicleId] = useState('');
  const [sosType, setSosType] = useState<FleetTicketSosType | ''>('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [locationStatus, setLocationStatus] = useState<FleetTicketLocationStatus>('unavailable');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehiclesQuery = useQuery({
    queryKey: ['sosVehicles', currentClient?.id],
    queryFn: listVehiclesForSos,
    enabled: canOpenSosTicket(user?.role) && !!currentClient?.id,
  });

  useEffect(() => {
    let active = true;
    void capturePosition().then((position) => {
      if (!active) return;
      setLocationStatus(position.status);
      setLatitude(position.latitude);
      setLongitude(position.longitude);
    });
    return () => {
      active = false;
    };
  }, []);

  if (user && !canOpenSosTicket(user.role)) {
    return <Navigate to="/" replace />;
  }

  const requiresManualLocation = locationStatus === 'denied' || locationStatus === 'unavailable';

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected.slice(0, 3));
    if (selected.length > 3) {
      setWarning('Somente os três primeiros anexos serão enviados.');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    setSubmitError(null);
    setWarning(null);

    if (!isOnline) {
      setValidationError('Você está sem conexão. Em emergência, acione imediatamente a Frota pelo canal operacional da empresa.');
      return;
    }
    if (!currentClient?.id) {
      setSubmitError('Cliente não selecionado. Contate o administrador.');
      return;
    }
    if (!vehicleId || !sosType || description.trim().length < 5) {
      setValidationError('Selecione o veículo e o tipo de emergência e informe uma descrição com pelo menos 5 caracteres.');
      return;
    }
    if (requiresManualLocation && !locationText.trim()) {
      setValidationError('Informe o local manualmente quando a localização do dispositivo não estiver disponível.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createSosTicket({
        clientId: currentClient.id,
        vehicleId,
        sosType,
        description: description.trim(),
        locationText: locationText.trim() || undefined,
        latitude,
        longitude,
        locationStatus: requiresManualLocation && locationText.trim() ? 'manual' : locationStatus,
        files,
      });
      await queryClient.invalidateQueries({ queryKey: ['fleetTickets'] });
      setSubmittedTicketId(result.ticketId);
      const warnings = [...result.uploadWarnings];
      if (result.telegramWarning) warnings.push('A criação foi concluída, mas a notificação Telegram falhou.');
      if (warnings.length > 0) setWarning(warnings.join(' '));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível enviar o S.O.S.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedTicketId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-semibold text-emerald-900">S.O.S. enviado</h1>
          <p className="mt-2 text-sm text-emerald-800">A Frota foi acionada.</p>
        </div>
        {warning && (
          <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {warning}
          </div>
        )}
        {user?.role !== 'Driver' && (
          <button
            type="button"
            onClick={() => navigate(`/chamados?ticket=${submittedTicketId}`)}
            className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            Ver chamado
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">S.O.S.</h1>
        <p className="mt-1 text-sm text-zinc-500">Use apenas em emergência: veículo enguiçado, colisão/sinistro ou roubo.</p>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p>Ao enviar um S.O.S., sua localização e os dados do veículo poderão ser compartilhados com o grupo de emergência configurado pela sua empresa.</p>
        </div>
      </div>

      <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        {(validationError || submitError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {validationError ?? submitError}
          </div>
        )}

        <div>
          <label htmlFor="sos-vehicle" className="mb-2 block text-sm font-medium text-zinc-800">Veículo</label>
          <select
            id="sos-vehicle"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            disabled={vehiclesQuery.isLoading || isSubmitting}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">Selecione o veículo</option>
            {(vehiclesQuery.data ?? []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-zinc-800">Tipo de emergência</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {SOS_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={sosType === type.value}
                onClick={() => setSosType(type.value)}
                disabled={isSubmitting}
                className={`min-h-16 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${sosType === type.value ? 'border-red-500 bg-red-100 text-red-800' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-red-300 hover:bg-red-50'}`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="sos-description" className="mb-2 block text-sm font-medium text-zinc-800">Descrição</label>
          <textarea
            id="sos-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            minLength={5}
            disabled={isSubmitting}
            placeholder="Descreva rapidamente o que aconteceu."
            className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-3 text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <MapPin className="h-4 w-4 text-orange-500" />
            Localização: {locationStatusLabel(locationStatus)}
          </div>
          <p className="mt-1 text-xs text-zinc-500">A captura é feita ao abrir esta tela. Informe um endereço ou referência para complementar a localização.</p>
          <div className="mt-3">
            <label htmlFor="sos-location" className="mb-2 block text-sm font-medium text-zinc-800">
              Endereço ou referência manual {requiresManualLocation ? '(obrigatório)' : '(opcional)'}
            </label>
            <input
              id="sos-location"
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              disabled={isSubmitting}
              aria-required={requiresManualLocation}
              placeholder="Rua, número, bairro, cidade ou ponto de referência"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        <div>
          <label htmlFor="sos-files" className="mb-2 block text-sm font-medium text-zinc-800">Fotos ou documentos (opcional, até 3)</label>
          <label htmlFor="sos-files" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 transition-colors hover:border-orange-400 hover:bg-orange-50">
            <Upload className="h-4 w-4" />
            Selecionar anexos
          </label>
          <input id="sos-files" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleFiles} className="sr-only" disabled={isSubmitting} />
          {files.length > 0 && <p className="mt-2 text-xs text-zinc-500">{files.length} anexo(s) selecionado(s).</p>}
        </div>

        {warning && !submittedTicketId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{warning}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || vehiclesQuery.isLoading}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {isSubmitting ? 'Enviando...' : 'Enviar S.O.S.'}
        </button>
      </form>
    </div>
  );
}
