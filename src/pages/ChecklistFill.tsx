import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, MinusCircle, Camera, ChevronLeft, Loader2, Lock, AlertTriangle, Building2, Gauge } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { checklistFromRow, type ChecklistRow } from '../lib/checklistMappers';
import { checklistItemFromRow, type ChecklistItemRow } from '../lib/checklistTemplateMappers';
import { uploadChecklistPhoto } from '../lib/checklistStorageHelpers';
import { enqueueOperation, enqueuePhoto } from '../lib/offline/syncService';
import CameraCapture from '../components/CameraCapture';
import OfflineBanner from '../components/OfflineBanner';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import type { Checklist, ChecklistItem, ChecklistContext, ResponseStatus } from '../types';
import { WORKSHOP_CONTEXTS } from '../types';
import { cn } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: checklist, isLoading: isLoadingChecklist } = useQuery({
    queryKey: ['checklist', checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists')
        .select('*, vehicles(license_plate), profiles(name), checklist_templates(name, context), workshops(name)')
        .eq('id', checklistId)
        .single();
      if (error) throw error;
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
        .eq('template_id', checklist!.templateId)
        .eq('version_number', checklist!.versionNumber)
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
      return data ?? [];
    },
    enabled: !!checklistId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const templateContext = checklist?.templateContext as ChecklistContext | null;
  const needsWorkshop = templateContext !== null && WORKSHOP_CONTEXTS.includes(templateContext as typeof WORKSHOP_CONTEXTS[number]);
  // Use workshop from checklist record or selected via local UI
  const effectiveWorkshopId = checklist?.workshopId || selectedWorkshopId;
  const workshopSaved = !!checklist?.workshopId;
  const workshopReady = !needsWorkshop || workshopSaved;
  const canShowItems = workshopReady && kmConfirmed;

  // KM do cadastro do veículo (fallback quando não há checklist anterior)
  const { data: vehicleInitialKm = null } = useQuery({
    queryKey: ['vehicleInitialKm', checklist?.vehicleId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('initial_km')
        .eq('id', checklist!.vehicleId!)
        .single();
      return (data as { initial_km: number | null } | null)?.initial_km ?? null;
    },
    enabled: !!checklist?.vehicleId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  // Último KM registrado em qualquer checklist concluído deste veículo
  const { data: lastOdometerKm = null } = useQuery({
    queryKey: ['lastOdometerKm', checklist?.vehicleId],
    queryFn: async () => {
      const { data } = await supabase
        .from('checklists')
        .select('odometer_km')
        .eq('vehicle_id', checklist!.vehicleId!)
        .eq('status', 'completed')
        .not('odometer_km', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as { odometer_km: number } | null)?.odometer_km ?? null;
    },
    enabled: !!checklist?.vehicleId,
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
    mutationFn: async ({ itemId, status, observation, photoUrl }: { itemId: string; status: ResponseStatus; observation: string; photoUrl: string }) => {
      if (!navigator.onLine) {
        await enqueueOperation(
          { type: 'save_response', itemId, status, observation, photoUrl, respondedAt: new Date().toISOString() },
          checklistId!,
        );
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
        queryClient.invalidateQueries({ queryKey: ['checklistResponses', checklistId] });
      }
    }
  });

  const confirmKmMutation = useMutation({
    mutationFn: async (km: number) => {
      if (!navigator.onLine) {
        await enqueueOperation({ type: 'confirm_km', odometerKm: km }, checklistId!);
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
        queryClient.invalidateQueries({ queryKey: ['checklist', checklistId] });
      }
    },
  });

  const handleConfirmKm = () => {
    setKmError(null);
    const parsed = parseInt(kmInput, 10);
    if (!kmInput.trim() || isNaN(parsed)) {
      setKmError('Informe o Km atual do veículo.');
      return;
    }
    if (referenceKm !== null && parsed < referenceKm) {
      setKmError(
        `O Km informado (${parsed.toLocaleString('pt-BR')}) é menor que o último registrado (${referenceKm.toLocaleString('pt-BR')} km).`
      );
      return;
    }
    confirmKmMutation.mutate(parsed, { onSuccess: () => setKmConfirmed(true) });
  };

  const confirmWorkshopMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      if (!navigator.onLine) {
        await enqueueOperation({ type: 'confirm_workshop', workshopId }, checklistId!);
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
        queryClient.invalidateQueries({ queryKey: ['checklist', checklistId] });
      }
    }
  });

  const finishChecklistMutation = useMutation({
    mutationFn: async () => {
      if (!checklist?.vehicleId) throw new Error('Este checklist não está associado a um veículo.');

      if (!navigator.onLine) {
        await enqueueOperation(
          {
            type: 'finish_checklist',
            completedAt: new Date().toISOString(),
            templateContext: templateContext ?? null,
            workshopId: checklist.workshopId || selectedWorkshopId || undefined,
            vehicleId: checklist.vehicleId,
          },
          checklistId!,
        );
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
        const { data: matchingSchedule } = await supabase
          .from('workshop_schedules')
          .select('id')
          .eq('vehicle_id', checklist.vehicleId)
          .eq('workshop_id', checklist.workshopId)
          .eq('status', 'scheduled')
          .order('scheduled_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (matchingSchedule) {
          await supabase
            .from('workshop_schedules')
            .update({
              status: 'completed',
              completed_at: completedAt,
              checklist_id: checklistId,
            })
            .eq('id', matchingSchedule.id);
        }
      }
    },
    onSuccess: () => {
      if (!navigator.onLine) {
        navigate('/checklists');
        return;
      }
      // Remove o checklist aberto do cache imediatamente para evitar flash
      queryClient.setQueriesData({ queryKey: ['openChecklist'] }, null);
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      navigate('/checklists');
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
      const pendingPhotoKey = await enqueuePhoto(file, currentClient!.id, checklistId!, itemId);
      const localPreviewUrl = URL.createObjectURL(file);
      updateItemLocal(itemId, { photoUrl: localPreviewUrl, uploading: false });

      const currentState = itemStates[idx];
      await enqueueOperation(
        {
          type: 'save_response',
          itemId,
          status: currentState.status!,
          observation: currentState.observation,
          photoUrl: '',
          pendingPhotoKey,
          respondedAt: new Date().toISOString(),
        },
        checklistId!,
      );
      return;
    }

    updateItemLocal(itemId, { uploading: true });
    try {
      const url = await uploadChecklistPhoto(currentClient!.id, checklistId!, itemId, file);
      updateItemLocal(itemId, { photoUrl: url, uploading: false });

      const currentState = itemStates[idx];
      saveResponseMutation.mutate({
        itemId,
        status: currentState.status!,
        observation: currentState.observation,
        photoUrl: url
      });
    } catch (err) {
      updateItemLocal(itemId, { uploading: false });
      console.error('Upload error:', err);
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
  const totalAnswered = itemStates.filter(s => s.status !== null).length;
  const progress = itemStates.length > 0 ? Math.round((totalAnswered / itemStates.length) * 100) : 0;

  const isLoading = isLoadingChecklist || isLoadingItems || isLoadingResponses;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error && !checklist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-50">
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate('/checklists')} className="text-orange-500 hover:underline text-sm">Voltar</button>
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-zinc-200 px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/checklists')} className="p-1.5 rounded-lg hover:bg-zinc-100">
              <ChevronLeft className="h-5 w-5 text-zinc-500" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {templateContext && <span className="text-orange-500">{templateContext} · </span>}
                {checklist?.templateName}
              </p>
              {checklist?.vehicleLicensePlate && (
                <p className="text-xs text-zinc-500">{checklist.vehicleLicensePlate}</p>
              )}
            </div>
            <span className="text-xs text-zinc-400 flex-shrink-0">{totalAnswered}/{itemStates.length}</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-200 rounded-full">
            <div className="h-1.5 bg-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">

      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

      {/* Workshop selector (for Entrada/Saída de Oficina) */}
      {needsWorkshop && (
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          <div className={cn(
            'rounded-2xl border p-4 space-y-3',
            workshopSaved ? 'bg-green-50 border-green-200' : 'bg-white border-orange-200',
          )}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-zinc-800">
                {workshopSaved ? `Oficina: ${workshops.find(w => w.id === selectedWorkshopId)?.name ?? checklist?.workshopName ?? '—'}` : 'Selecione a oficina'}
              </p>
            </div>
            {!workshopSaved && (
              <>
                <select
                  value={selectedWorkshopId}
                  onChange={e => setSelectedWorkshopId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">— Selecione uma oficina —</option>
                  {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button
                  disabled={!selectedWorkshopId}
                  onClick={() => confirmWorkshopMutation.mutate(selectedWorkshopId)}
                  className="w-full py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-40"
                >
                  Confirmar oficina
                </button>
                <p className="text-xs text-zinc-500 text-center">Selecione a oficina para liberar os itens do checklist</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Odometer KM */}
      {workshopReady && (
        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          <div className={cn(
            'rounded-2xl border p-4 space-y-3',
            kmConfirmed ? 'bg-green-50 border-green-200' : 'bg-white border-orange-200',
          )}>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-orange-500 flex-shrink-0" />
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
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <span className="text-sm text-zinc-500 flex-shrink-0">km</span>
                </div>
                <button
                  disabled={confirmKmMutation.isPending}
                  onClick={handleConfirmKm}
                  className="w-full py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {confirmKmMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar hodômetro
                </button>
                <p className="text-xs text-zinc-500 text-center">Informe o hodômetro para liberar os itens do checklist</p>
              </>
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
        <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full space-y-3">
          {itemStates.map((s, idx) => (
            <div
              key={s.item.id}
              className={cn(
                'bg-white rounded-2xl border p-4 space-y-3 transition-colors',
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
                      <Lock className="inline ml-1 h-3 w-3 text-zinc-400" title="Obrigatório" />
                    )}
                    {s.item.canBlockVehicle && (
                      <span className="inline ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">⚠ Bloqueio</span>
                    )}
                  </p>
                  {s.item.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">{s.item.description}</p>
                  )}
                  {s.item.canBlockVehicle && (
                    <p className="text-xs text-red-500 mt-0.5">Este item pode bloquear o veículo se reprovado</p>
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
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium flex-1 justify-center min-h-[44px] transition-colors',
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
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />

                  {s.item.canBlockVehicle && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-700">Item crítico de segurança — será registrado para alerta de bloqueio</p>
                    </div>
                  )}

                  {s.photoUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={s.photoUrl} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
                      <button onClick={() => setCameraItemIdx(idx)} className="text-xs text-orange-500 hover:underline">Refazer foto</button>
                      {s.item.requirePhotoIfIssue && (
                        <span className="text-xs text-green-600 font-medium">✓ Foto registrada</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setCameraItemIdx(idx)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                        s.item.requirePhotoIfIssue
                          ? 'border-red-400 text-red-600 bg-red-50 hover:bg-red-100'
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
      <div className="flex-shrink-0 bg-white border-t border-zinc-200 px-4 py-3">
        <div className="max-w-2xl mx-auto space-y-2">
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {!workshopReady && (
            <p className="text-xs text-amber-600 text-center">Selecione e confirme a oficina para liberar o checklist</p>
          )}
          {workshopReady && !kmConfirmed && (
            <p className="text-xs text-amber-600 text-center">Informe o hodômetro para liberar os itens do checklist</p>
          )}
          {workshopReady && kmConfirmed && !mandatoryAnswered && (
            <p className="text-xs text-amber-600 text-center">Responda todos os itens obrigatórios para finalizar</p>
          )}
          <button
            onClick={() => finishChecklistMutation.mutate()}
            disabled={!mandatoryAnswered || finishChecklistMutation.isPending || !workshopReady || !kmConfirmed}
            className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-40 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            {finishChecklistMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {finishChecklistMutation.isPending ? 'Finalizando...' : 'Finalizar Checklist'}
          </button>
        </div>
      </div>

      {cameraItemIdx !== null && (
        <CameraCapture
          onClose={() => setCameraItemIdx(null)}
          onCapture={(file, lat, lng) => handlePhotoCapture(cameraItemIdx, file, lat, lng)}
        />
      )}
    </div>
  );
}
