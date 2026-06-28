import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, MinusCircle, Camera, ChevronLeft, Loader2, Lock, AlertTriangle, Building2, Gauge } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import CameraCapture from '../components/CameraCapture';
import OfflineBanner from '../components/OfflineBanner';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { validateChecklistOdometerKm } from '../lib/checklistKmValidation';
import { checklistFromRow, type ChecklistRow } from '../lib/checklistMappers';
import { uploadChecklistPhoto } from '../lib/checklistStorageHelpers';
import { checklistItemFromRow, type ChecklistItemRow } from '../lib/checklistTemplateMappers';
import { evaluateOdometerTolerance } from '../lib/odometerToleranceValidation';
import { enqueueOperation, enqueuePhoto } from '../lib/offline/syncService';
import { applyOfflineKm, applyOfflineWorkshop, upsertResponse } from '../lib/offlineCacheUpdates';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { autoCompleteWorkshopSchedule, autoRetireVehicleFromWorkshop } from '../lib/workshopScheduleUtils';
import { ODOMETER_UPDATE_CONTEXT, WORKSHOP_CONTEXTS } from '../types';

import type { Checklist, ChecklistItem, ResponseStatus } from '../types';

interface ItemState {
  item: ChecklistItem;
  status: ResponseStatus | null;
  observation: string;
  photoUrl: string;
  photoFile: File | null;
  photoLat?: number;
  photoLng?: number;
  uploading: boolean;
}

interface WorkshopOption {
  id: string;
  name: string;
}

type ChecklistResponseRow = {
  item_id: string;
  status: ResponseStatus | null;
  observation: string | null;
  photo_url: string | null;
  responded_at?: string | null;
  checklist_id?: string;
};

type VehicleInitialKmRow = { initial_km: number | null };
type OdometerIntervalSettingsRow = {
  odometer_km_tolerance_per_day: number | null;
  odometer_update_day_interval: number | null;
};

export default function ChecklistFill() {
  const { checklistId } = useParams<{ checklistId: string }>();
  const { currentClient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOnline = useOnlineStatus();
  const pendingCount = usePendingSyncCount(checklistId ?? '');

  const [cameraItemIdx, setCameraItemIdx] = useState<number | null>(null);
  const [localItemChanges, setLocalItemChanges] = useState<Record<string, Partial<ItemState>>>({});
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [error, setError] = useState('');
  const [kmInput, setKmInput] = useState('');
  const [kmConfirmed, setKmConfirmed] = useState(false);
  const [kmError, setKmError] = useState<string | null>(null);
  const [odometerPhotoUrl, setOdometerPhotoUrl] = useState('');
  const [odometerCameraOpen, setOdometerCameraOpen] = useState(false);
  const [toleranceState, setToleranceState] = useState<{
    requiresPhoto: boolean;
    expectedMaxKm?: number;
    exceededBy?: number;
  }>({ requiresPhoto: false });

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: checklist, isLoading: isLoadingChecklist } = useQuery({
    queryKey: ['checklist', checklistId],
    queryFn: async () => {
      const response = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context), workshops(name)')
        .eq('id', checklistId)
        .single();
      const data = response.data as ChecklistRow | null;
      const error = response.error;
      if (error) throw error;
      if (!data) throw new Error('Checklist não encontrado.');
      return checklistFromRow(data as ChecklistRow);
    },
    enabled: !!checklistId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['checklistItems', checklist?.templateId, checklist?.versionNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('template_id', checklist.templateId)
        .eq('version_number', checklist.versionNumber)
        .order('order_number');
      if (error) throw error;
      return (data ?? []).map(r => checklistItemFromRow(r as ChecklistItemRow));
    },
    enabled: !!checklist?.templateId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: responses = [], isLoading: isLoadingResponses } = useQuery({
    queryKey: ['checklistResponses', checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_responses')
        .select('*')
        .eq('checklist_id', checklistId);
      if (error) throw error;
      return (data ?? []) as ChecklistResponseRow[];
    },
    enabled: !!checklistId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const templateContext = checklist?.templateContext;
  const isOdometerContext = templateContext === ODOMETER_UPDATE_CONTEXT;
  const needsWorkshop = templateContext !== null && WORKSHOP_CONTEXTS.includes(templateContext);
  // Use workshop from checklist record or selected via local UI
  const workshopSaved = !!checklist?.workshopId;
  const workshopReady = !needsWorkshop || workshopSaved;
  const canShowItems = workshopReady && kmConfirmed && !isOdometerContext;

  // KM do cadastro do veículo (fallback quando não há checklist anterior)
  const { data: vehicleInitialKm = null } = useQuery({
    queryKey: ['vehicleInitialKm', checklist?.vehicleId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('initial_km')
        .eq('id', checklist.vehicleId)
        .single();
      const vehicle = data as VehicleInitialKmRow | null;
      return vehicle?.initial_km ?? null;
    },
    enabled: !!checklist?.vehicleId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  // Maior KM efetivo registrado em qualquer checklist concluído deste veículo
  // Usa RPC SECURITY DEFINER para bypassar RLS — motoristas precisam validar
  // contra o último registro de QUALQUER usuário, não apenas os próprios.
  const { data: lastOdometerKm = null } = useQuery({
    queryKey: ['lastOdometerKm', checklist?.vehicleId],
    queryFn: async () => {
      const response = await supabase.rpc('get_vehicle_max_effective_km', {
        p_vehicle_id: checklist.vehicleId,
      });
      const data = response.data as number | null;
      const error = response.error;
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!checklist?.vehicleId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: lastReadingAt = null } = useQuery({
    queryKey: ['lastOdometerReadingAt', checklist?.vehicleId],
    queryFn: async () => {
      const response = await supabase.rpc('get_vehicle_last_odometer_reading_at', {
        p_vehicle_id: checklist.vehicleId,
      });
      const data = response.data as string | null;
      const error = response.error;
      if (error) throw error;
      return data ?? null;
    },
    enabled: isOdometerContext && !!checklist?.vehicleId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: odometerIntervalSettings = null } = useQuery({
    queryKey: ['checklistDayIntervals', currentClient?.id, 'odometer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_day_intervals')
        .select('odometer_km_tolerance_per_day, odometer_update_day_interval')
        .eq('client_id', currentClient!.id)
        .maybeSingle();
      if (error) throw error;
      return data as OdometerIntervalSettingsRow | null;
    },
    enabled: isOdometerContext && !!currentClient?.id,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: workshops = [] } = useQuery({
    queryKey: ['workshops', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name')
        .eq('client_id', currentClient!.id)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as WorkshopOption[];
    },
    enabled: needsWorkshop && !!currentClient?.id,
    gcTime: 30 * 60 * 1000,
    networkMode: 'offlineFirst',
  });

  // Inicializa KM quando checklist já tem odometerKm (checklist retomado)
  React.useEffect(() => {
    if (checklist?.odometerKm != null && !kmConfirmed) {
      setKmInput(String(checklist.odometerKm));
      setKmConfirmed(true);
    }
  }, [checklist?.odometerKm]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (checklist?.odometerPhotoUrl) {
      setOdometerPhotoUrl(checklist.odometerPhotoUrl);
    }
  }, [checklist?.odometerPhotoUrl]);

  // Referência para exibir ao usuário: último checklist > initial_km do veículo
  const referenceKm = lastOdometerKm ?? vehicleInitialKm ?? null;

  // ── Derived State ────────────────────────────────────────────────────────

  const itemStates: ItemState[] = useMemo(() => {
    const respMap = new Map(responses.map(r => [r.item_id, r]));
    return items.map(item => {
      const existing = respMap.get(item.id);
      const local = localItemChanges[item.id] || {};
      return {
        item,
        status: local.status !== undefined ? local.status : ((existing?.status as ResponseStatus) ?? null),
        observation: local.observation !== undefined ? local.observation : ((existing?.observation as string) ?? ''),
        photoUrl: local.photoUrl !== undefined ? local.photoUrl : ((existing?.photo_url as string) ?? ''),
        photoFile: local.photoFile || null,
        uploading: local.uploading || false,
      };
    });
  }, [items, responses, localItemChanges]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveResponseMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ itemId, status, observation, photoUrl }: { itemId: string; status: ResponseStatus; observation: string; photoUrl: string }) => {
      if (!navigator.onLine) {
        const respondedAt = new Date().toISOString();
        await enqueueOperation(
          { type: 'save_response', itemId, status, observation, photoUrl, respondedAt },
          checklistId,
        );
        queryClient.setQueryData(['checklistResponses', checklistId], (old: ChecklistResponseRow[] | undefined) => upsertResponse(old, {
          checklist_id: checklistId,
          item_id: itemId,
          status,
          observation,
          photo_url: photoUrl || null,
          responded_at: respondedAt,
        }));
        return;
      }
      const { error } = await supabase.from('checklist_responses').upsert({
        checklist_id: checklistId,
        item_id: itemId,
        status,
        observation: observation.trim() || null,
        photo_url: photoUrl || null,
        responded_at: new Date().toISOString(),
      }, { onConflict: 'checklist_id,item_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      if (navigator.onLine) {
        void queryClient.invalidateQueries({ queryKey: ['checklistResponses', checklistId] });
      }
    }
  });

  const confirmKmMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async (km: number) => {
      if (!navigator.onLine) {
        await enqueueOperation({ type: 'confirm_km', odometerKm: km }, checklistId);
        queryClient.setQueryData(['checklist', checklistId], (old: Checklist | undefined) => applyOfflineKm(old, km));
        return;
      }
      const { error } = await supabase
        .from('checklists')
        .update({ odometer_km: km })
        .eq('id', checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (navigator.onLine) {
        void queryClient.invalidateQueries({ queryKey: ['checklist', checklistId] });
      }
    },
  });

  const handleConfirmKm = () => {
    setKmError(null);
    if (isOdometerContext) {
      const validation = evaluateOdometerTolerance({
        rawValue: kmInput,
        lastValidKm: lastOdometerKm,
        lastReadingAt,
        initialKm: vehicleInitialKm,
        tolerancePerDay: odometerIntervalSettings?.odometer_km_tolerance_per_day ?? null,
        dayInterval: odometerIntervalSettings?.odometer_update_day_interval ?? null,
        mustExceed: true,
      });
      if (validation.ok === false) {
        setKmError(validation.message);
        return;
      }
      setToleranceState(validation.requiresPhoto
        ? {
            requiresPhoto: true,
            expectedMaxKm: validation.expectedMaxKm,
            exceededBy: validation.exceededBy,
          }
        : { requiresPhoto: false });
      confirmKmMutation.mutate(validation.value, { onSuccess: () => setKmConfirmed(true) });
      return;
    }

    const validation = validateChecklistOdometerKm({ rawValue: kmInput, referenceKm, mustExceed: true });
    if (!validation.ok) {
      setKmError(validation.message);
      return;
    }
    confirmKmMutation.mutate(validation.value, { onSuccess: () => setKmConfirmed(true) });
  };

  const confirmWorkshopMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async (workshopId: string) => {
      if (!navigator.onLine) {
        await enqueueOperation({ type: 'confirm_workshop', workshopId }, checklistId);
        queryClient.setQueryData(['checklist', checklistId], (old: Checklist | undefined) => applyOfflineWorkshop(old, workshopId));
        return;
      }
      const { error } = await supabase
        .from('checklists')
        .update({ workshop_id: workshopId })
        .eq('id', checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (navigator.onLine) {
        void queryClient.invalidateQueries({ queryKey: ['checklist', checklistId] });
      }
    }
  });

  const finishChecklistMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async () => {
      if (!checklist?.vehicleId) throw new Error('Este checklist não está associado a um veículo.');

      if (!navigator.onLine) {
        const completedAt = new Date().toISOString();
        await enqueueOperation(
          {
            type: 'finish_checklist',
            completedAt,
            templateContext: templateContext ?? null,
            workshopId: checklist.workshopId || selectedWorkshopId || undefined,
            vehicleId: checklist.vehicleId,
          },
          checklistId,
        );
        queryClient.setQueryData(['checklist', checklistId], (old: Checklist | undefined) => old ? { ...old, status: 'completed', completedAt } : old);
        queryClient.setQueriesData({ queryKey: ['openChecklist'] }, null);
        return;
      }

      const completedAt = new Date().toISOString();
      const { error: chkErr } = await supabase
        .from('checklists')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('id', checklistId);
      if (chkErr) throw chkErr;

      // Auto-concluir agendamento de oficina
      if (templateContext === 'Entrada em Oficina' && checklist.workshopId && checklist.vehicleId) {
        await autoCompleteWorkshopSchedule(
          checklist.vehicleId,
          checklist.workshopId,
          completedAt,
          checklistId,
        );
      }

      // Auto-retirar veículo quando checklist de "Saída de Oficina" é concluído
      if (templateContext === 'Saída de Oficina' && checklist.workshopId && checklist.vehicleId) {
        await autoRetireVehicleFromWorkshop(
          checklist.vehicleId,
          checklist.workshopId,
          checklistId,
        );
      }
    },
    onSuccess: () => {
      if (!navigator.onLine) {
        void navigate('/checklists');
        return;
      }
      // Remove o checklist aberto do cache imediatamente para evitar flash
      queryClient.setQueriesData({ queryKey: ['openChecklist'] }, null);
      // Invalida as queries de referência de hodômetro do veículo para que o
      // próximo checklist exija um valor estritamente maior que o recém-registrado.
      if (checklist?.vehicleId) {
        void queryClient.invalidateQueries({ queryKey: ['lastOdometerKm', checklist.vehicleId] });
        void queryClient.invalidateQueries({ queryKey: ['lastOdometerReadingAt', checklist.vehicleId] });
        void queryClient.invalidateQueries({ queryKey: ['vehicleInitialKm', checklist.vehicleId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['checklists'] });
      void navigate('/checklists');
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  // ── Actions ─────────────────────────────────────────────────────────────

  const updateItemLocal = (itemId: string, patch: Partial<ItemState>) => {
    setLocalItemChanges(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch }
    }));
  };

  const handleStatusChange = (idx: number, status: ResponseStatus) => {
    const item = itemStates[idx];
    updateItemLocal(item.item.id, { status });
    if (status !== 'issue') {
      saveResponseMutation.mutate({
        itemId: item.item.id,
        status,
        observation: item.observation,
        photoUrl: item.photoUrl
      });
    }
  };

  const handlePhotoCapture = async (idx: number, file: File, lat?: number, lng?: number) => {
    const itemId = itemStates[idx].item.id;
    setCameraItemIdx(null);
    updateItemLocal(itemId, { photoFile: file, photoLat: lat, photoLng: lng, uploading: !navigator.onLine });

    if (!navigator.onLine) {
      // Armazena o blob offline e cria URL local para preview
      const pendingPhotoKey = await enqueuePhoto(file, currentClient!.id, checklistId, itemId);
      const localPreviewUrl = URL.createObjectURL(file);
      updateItemLocal(itemId, { photoUrl: localPreviewUrl, uploading: false });

      const currentState = itemStates[idx];
      const respondedAt = new Date().toISOString();
      await enqueueOperation(
        {
          type: 'save_response',
          itemId,
          status: currentState.status,
          observation: currentState.observation,
          photoUrl: '',
          pendingPhotoKey,
          respondedAt,
        },
        checklistId,
      );
      queryClient.setQueryData(['checklistResponses', checklistId], (old: ChecklistResponseRow[] | undefined) => upsertResponse(old, {
        checklist_id: checklistId,
        item_id: itemId,
        status: currentState.status,
        observation: currentState.observation,
        photo_url: '',
        responded_at: respondedAt,
      }));
      return;
    }

    updateItemLocal(itemId, { uploading: true });
    try {
      const url = await uploadChecklistPhoto(currentClient!.id, checklistId, itemId, file);
      updateItemLocal(itemId, { photoUrl: url, uploading: false });

      const currentState = itemStates[idx];
      saveResponseMutation.mutate({
        itemId,
        status: currentState.status,
        observation: currentState.observation,
        photoUrl: url
      });
    } catch (err) {
      updateItemLocal(itemId, { uploading: false });
      console.error('Upload error:', err);
    }
  };

  const handleOdometerPhotoCapture = async (file: File) => {
    setOdometerCameraOpen(false);
    setKmError(null);

    if (!navigator.onLine) {
      setKmError('Você precisa estar online para enviar a foto do hodômetro.');
      return;
    }

    try {
      const url = await uploadChecklistPhoto(currentClient!.id, checklistId, 'odometer', file);
      const { error: updateError } = await supabase
        .from('checklists')
        .update({ odometer_photo_url: url })
        .eq('id', checklistId);
      if (updateError) throw updateError;

      setOdometerPhotoUrl(url);
      queryClient.setQueryData(['checklist', checklistId], (old: Checklist | undefined) => old ? { ...old, odometerPhotoUrl: url } : old);
    } catch (err) {
      console.error('Odometer photo upload error:', err);
      setKmError('Não foi possível enviar a foto. Tente novamente.');
    }
  };

  const handleObservationBlur = (idx: number) => {
    const s = itemStates[idx];
    if (s.status) {
      saveResponseMutation.mutate({
        itemId: s.item.id,
        status: s.status,
        observation: s.observation,
        photoUrl: s.photoUrl
      });
    }
  };

  const mandatoryAnswered = itemStates.filter(s => s.item.isMandatory).every(s => s.status !== null);
  const odometerPhotoRequired = isOdometerContext && toleranceState.requiresPhoto;
  const odometerPhotoGateBlocked = odometerPhotoRequired && !odometerPhotoUrl;
  const totalAnswered = itemStates.filter(s => s.status !== null).length;
  const progress = itemStates.length > 0 ? Math.round((totalAnswered / itemStates.length) * 100) : 0;

  const isLoading = isLoadingChecklist || isLoadingItems || isLoadingResponses;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !checklist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50">
        <p className="text-red-600">{error}</p>
        <button onClick={() => { void navigate('/checklists'); }} className="text-sm text-orange-500 hover:underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-50">
      {/* Top bar */}
      <div className="z-10 flex-shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <button onClick={() => { void navigate('/checklists'); }} className="rounded-lg p-1.5 hover:bg-zinc-100">
              <ChevronLeft className="h-5 w-5 text-zinc-500" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {templateContext && <span className="text-orange-500">{templateContext} · </span>}
                {checklist?.templateName}
              </p>
              {checklist?.vehicleLicensePlate && (
                <p className="text-xs text-zinc-500">{checklist.vehicleLicensePlate}</p>
              )}
            </div>
            <span className="flex-shrink-0 text-xs text-zinc-400">{totalAnswered}/{itemStates.length}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-200">
            <div className="h-1.5 rounded-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">

        <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

        {/* Workshop selector (for Entrada/Saída de Oficina) */}
        {needsWorkshop && (
          <div className="mx-auto w-full max-w-2xl px-4 py-4">
            <div className={cn(
              'space-y-3 rounded-2xl border p-4',
              workshopSaved ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-white',
            )}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 flex-shrink-0 text-orange-500" />
                <p className="text-sm font-semibold text-zinc-800">
                  {workshopSaved ? `Oficina: ${workshops.find(w => w.id === selectedWorkshopId)?.name ?? checklist?.workshopName ?? '—'}` : 'Selecione a oficina'}
                </p>
              </div>
              {!workshopSaved && (
                <>
                  <select
                    value={selectedWorkshopId}
                    onChange={e => setSelectedWorkshopId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  >
                    <option value="">— Selecione uma oficina —</option>
                    {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <button
                    disabled={!selectedWorkshopId}
                    onClick={() => { confirmWorkshopMutation.mutate(selectedWorkshopId); }}
                    className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
                  >
                    Confirmar oficina
                  </button>
                  <p className="text-center text-xs text-zinc-500">Selecione a oficina para liberar os itens do checklist</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Odometer KM */}
        {workshopReady && (
          <div className="mx-auto w-full max-w-2xl px-4 py-4">
            <div className={cn(
              'space-y-3 rounded-2xl border p-4',
              kmConfirmed ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-white',
            )}>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 flex-shrink-0 text-orange-500" />
                <p className="text-sm font-semibold text-zinc-800">
                  {kmConfirmed
                    ? `Hodômetro: ${parseInt(kmInput).toLocaleString('pt-BR')} km`
                    : 'Informe o hodômetro'}
                </p>
              </div>
              {referenceKm !== null && (
                <p className="text-xs text-zinc-500">
                  Último Km registrado: {referenceKm.toLocaleString('pt-BR')} km
                </p>
              )}
              {!kmConfirmed && (
                <>
                  {kmError && <p className="text-xs text-red-600">{kmError}</p>}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={kmInput}
                      onChange={e => setKmInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 45000"
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    />
                    <span className="flex-shrink-0 text-sm text-zinc-500">km</span>
                  </div>
                  <button
                    disabled={confirmKmMutation.isPending}
                    onClick={handleConfirmKm}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
                  >
                    {confirmKmMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar hodômetro
                  </button>
                  <p className="text-center text-xs text-zinc-500">Informe o hodômetro para liberar os itens do checklist</p>
                </>
              )}
              {isOdometerContext && kmConfirmed && toleranceState.requiresPhoto && (
                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
                  <p className="text-xs text-sky-800">
                    O KM informado excedeu a tolerância esperada (máximo {toleranceState.expectedMaxKm?.toLocaleString('pt-BR')} km). Para concluir, envie uma foto do hodômetro como evidência.
                  </p>
                  {kmError && <p className="text-xs text-red-600">{kmError}</p>}
                  {odometerPhotoUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={odometerPhotoUrl} alt="foto do hodômetro" className="h-16 w-16 rounded-lg object-cover" />
                      <button onClick={() => setOdometerCameraOpen(true)} className="text-xs text-orange-500 hover:underline">Refazer foto</button>
                      <span className="text-xs font-medium text-green-600">✓ Foto registrada</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!navigator.onLine) {
                          setKmError('Você precisa estar online para enviar a foto do hodômetro.');
                          return;
                        }
                        setOdometerCameraOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
                    >
                      <Camera className="h-4 w-4" />
                      Tirar foto do hodômetro
                    </button>
                  )}
                </div>
              )}
              {kmConfirmed && (
                <button onClick={() => setKmConfirmed(false)} className="text-xs text-orange-500 hover:underline">
                  Alterar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        {canShowItems && (
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-4 py-4">
            {itemStates.map((s, idx) => (
              <div
                key={s.item.id}
                className={cn(
                  'space-y-3 rounded-2xl border bg-white p-4 transition-colors',
                  s.status === 'ok' && 'border-green-300 bg-green-50/30',
                  s.status === 'issue' && 'border-red-300 bg-red-50/30',
                  s.status === 'not_applicable' && 'border-zinc-300 bg-zinc-50/30',
                  !s.status && 'border-zinc-200',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {idx + 1}. {s.item.title}
                      {s.item.isMandatory && (
                        <span title="Obrigatório">
                          <Lock className="ml-1 inline h-3 w-3 text-zinc-400" />
                        </span>
                      )}
                      {s.item.canBlockVehicle && (
                        <span className="ml-1.5 inline rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">⚠ Bloqueio</span>
                      )}
                    </p>
                    {s.item.description && (
                      <p className="mt-0.5 text-xs text-zinc-500">{s.item.description}</p>
                    )}
                    {s.item.canBlockVehicle && (
                      <p className="mt-0.5 text-xs text-red-500">Este item pode bloquear o veículo se reprovado</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {(
                    [
                      { val: 'ok', label: 'OK', Icon: CheckCircle, active: 'bg-green-500 text-white border-green-500', inactive: 'border-zinc-200 text-zinc-500 hover:border-green-400 hover:text-green-600' },
                      { val: 'issue', label: 'Problema', Icon: XCircle, active: 'bg-red-500 text-white border-red-500', inactive: 'border-zinc-200 text-zinc-500 hover:border-red-400 hover:text-red-600' },
                      { val: 'not_applicable', label: 'N/A', Icon: MinusCircle, active: 'bg-zinc-400 text-white border-zinc-400', inactive: 'border-zinc-200 text-zinc-400 hover:border-zinc-400' },
                    ] as const
                  ).map(({ val, label, Icon, active, inactive }) => (
                    <button
                      key={val}
                      onClick={() => handleStatusChange(idx, val)}
                      className={cn(
                        'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        s.status === val ? active : inactive,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>

                {s.status === 'issue' && (
                  <div className="space-y-2">
                    <textarea
                      value={s.observation}
                      onChange={e => updateItemLocal(s.item.id, { observation: e.target.value })}
                      onBlur={() => handleObservationBlur(idx)}
                      placeholder="Descreva o problema observado..."
                      rows={2}
                      className="w-full resize-none rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                    />

                    {s.item.canBlockVehicle && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                        <p className="text-xs text-red-700">Item crítico de segurança — será registrado para alerta de bloqueio</p>
                      </div>
                    )}

                    {s.photoUrl ? (
                      <div className="flex items-center gap-2">
                        <img src={s.photoUrl} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
                        <button onClick={() => setCameraItemIdx(idx)} className="text-xs text-orange-500 hover:underline">Refazer foto</button>
                        {s.item.requirePhotoIfIssue && (
                          <span className="text-xs font-medium text-green-600">✓ Foto registrada</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setCameraItemIdx(idx)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                          s.item.requirePhotoIfIssue
                            ? 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100'
                            : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50',
                        )}
                      >
                        {s.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {s.item.requirePhotoIfIssue ? 'Foto obrigatória' : 'Tirar foto'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>{/* end scrollable area */}

      {/* Bottom bar */}
      <div className="flex-shrink-0 border-t border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl space-y-2">
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          {!workshopReady && (
            <p className="text-center text-xs text-amber-600">Selecione e confirme a oficina para liberar o checklist</p>
          )}
          {workshopReady && !kmConfirmed && (
            <p className="text-center text-xs text-amber-600">Informe o hodômetro para liberar os itens do checklist</p>
          )}
          {workshopReady && kmConfirmed && !mandatoryAnswered && (
            <p className="text-center text-xs text-amber-600">Responda todos os itens obrigatórios para finalizar</p>
          )}
          {odometerPhotoGateBlocked && (
            <p className="text-center text-xs text-amber-600">Envie a foto do hodômetro para concluir.</p>
          )}
          <button
            onClick={() => finishChecklistMutation.mutate()}
            disabled={!mandatoryAnswered || finishChecklistMutation.isPending || !workshopReady || !kmConfirmed || odometerPhotoGateBlocked}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
          >
            {finishChecklistMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {finishChecklistMutation.isPending ? 'Finalizando...' : 'Finalizar Checklist'}
          </button>
        </div>
      </div>

      {cameraItemIdx !== null && (
        <CameraCapture
          onClose={() => setCameraItemIdx(null)}
          onCapture={(file, lat, lng) => { void handlePhotoCapture(cameraItemIdx, file, lat, lng); }}
        />
      )}
      {odometerCameraOpen && (
        <CameraCapture
          onClose={() => setOdometerCameraOpen(false)}
          onCapture={(file) => { void handleOdometerPhotoCapture(file); }}
        />
      )}
    </div>
  );
}
