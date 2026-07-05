import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, CheckCircle2, Link2, Loader2, ShieldAlert } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import CameraCapture from '../components/CameraCapture';
import { useAuth } from '../context/AuthContext';
import { uploadChecklistPhoto } from '../lib/checklistStorageHelpers';
import { offlineDb } from '../lib/offline/offlineDb';
import { canFillCoupling } from '../lib/rolePermissions';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

import type { ChecklistTemplate } from '../types';

type CouplingAction = 'Engate' | 'Desengate';
type LookupResult = { exists: boolean; available: boolean };
type BootstrapRow = {
  checklist_id: string;
  trailer_id: string;
  tractor_id: string | null;
  third_party_tractor_id: string | null;
  third_party_driver_id: string | null;
  open_coupling_id: string | null;
  open_coupling_odometer: number | null;
};
type TemplateRow = {
  id: string;
  client_id: string;
  vehicle_category: string;
  context: string;
  name: string;
  description: string | null;
  current_version: number;
  status: string;
};

function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function asLookupResult(data: unknown): LookupResult {
  if (!data || typeof data !== 'object') {
    return { exists: false, available: false };
  }

  const row = data as Record<string, unknown>;
  return {
    exists: row.exists === true,
    available: row.available === true,
  };
}

function asBootstrapRow(data: unknown): BootstrapRow | null {
  if (!data || typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;
  if (typeof row.checklist_id !== 'string' || typeof row.trailer_id !== 'string') return null;

  return {
    checklist_id: row.checklist_id,
    trailer_id: row.trailer_id,
    tractor_id: typeof row.tractor_id === 'string' ? row.tractor_id : null,
    third_party_tractor_id: typeof row.third_party_tractor_id === 'string' ? row.third_party_tractor_id : null,
    third_party_driver_id: typeof row.third_party_driver_id === 'string' ? row.third_party_driver_id : null,
    open_coupling_id: typeof row.open_coupling_id === 'string' ? row.open_coupling_id : null,
    open_coupling_odometer: typeof row.open_coupling_odometer === 'number' ? row.open_coupling_odometer : null,
  };
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function CouplingAgent() {
  const { user, currentClient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [action, setAction] = useState<CouplingAction>('Engate');
  const [trailerPlate, setTrailerPlate] = useState('');
  const [tractorPlate, setTractorPlate] = useState('');
  const [tractorDriverName, setTractorDriverName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [platePhoto, setPlatePhoto] = useState<{
    file: File;
    previewUrl: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [error, setError] = useState('');

  const allowed = canFillCoupling(user?.role);
  const isFleetOperator = user?.role !== 'Coupling Agent';

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['couplingTemplates', currentClient?.id, action],
    enabled: !!currentClient?.id && allowed,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('client_id', currentClient!.id)
        .eq('vehicle_category', 'Semi-reboque/Implemento')
        .eq('context', action)
        .eq('status', 'published')
        .order('name');

      if (queryError) throw queryError;
      return (data as TemplateRow[] ?? []).map((row): ChecklistTemplate => ({
        id: row.id,
        clientId: row.client_id,
        vehicleCategory: row.vehicle_category as ChecklistTemplate['vehicleCategory'],
        context: row.context as ChecklistTemplate['context'],
        name: row.name,
        description: row.description ?? undefined,
        currentVersion: row.current_version,
        status: row.status as ChecklistTemplate['status'],
      }));
    },
  });

  useEffect(() => {
    if (templates.length === 1) {
      setSelectedTemplateId(templates[0].id);
      return;
    }
    if (!templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId('');
    }
  }, [selectedTemplateId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const lookupMutation = useMutation({
    mutationFn: async (plate: string) => {
      const response = await supabase.rpc('lookup_trailer_for_coupling', {
        p_plate: plate,
      });

      const lookupError = response.error;
      const rpcData: unknown = response.data;
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (lookupError) throw lookupError;
      return asLookupResult(row);
    },
    onSuccess: async (result) => {
      setLookupResult(result);
      setError('');
      if (result.exists && ((action === 'Engate' && result.available) || (action === 'Desengate' && !result.available))) {
        const hash = await sha256(normalizePlate(trailerPlate));
        await offlineDb.couplingPlateHashes.put({
          hash,
          plateHint: normalizePlate(trailerPlate).slice(-3),
          validatedAt: Date.now(),
        });
      }
    },
    onError: (mutationError: Error) => {
      setLookupResult(null);
      setError(mutationError.message);
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!currentClient?.id || !user?.id) throw new Error('Sessão inválida.');
      if (!selectedTemplate) throw new Error('Selecione um template.');
      if (!platePhoto?.file) throw new Error('A foto da placa é obrigatória.');
      if (platePhoto.latitude == null || platePhoto.longitude == null) {
        throw new Error('A foto precisa conter geolocalização.');
      }

      const normalizedTrailerPlate = normalizePlate(trailerPlate);
      const normalizedTractorPlate = normalizePlate(tractorPlate);

      const response = await supabase.rpc('bootstrap_coupling_checklist', {
        p_template_id: selectedTemplate.id,
        p_action: action,
        p_trailer_plate: normalizedTrailerPlate,
        p_tractor_plate: normalizedTractorPlate,
        p_tractor_driver_name: tractorDriverName.trim(),
        p_device_info: navigator.userAgent,
      });
      if (response.error) throw response.error;

      const rpcData: unknown = response.data;
      const bootstrapRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!bootstrapRow) throw new Error('Não foi possível preparar o checklist de engate/desengate.');

      const bootstrap = asBootstrapRow(bootstrapRow);
      if (!bootstrap) throw new Error('Resposta inválida ao preparar checklist de engate/desengate.');
      const checklistId = bootstrap.checklist_id;
      const platePhotoUrl = await uploadChecklistPhoto(currentClient.id, checklistId, 'plate', platePhoto.file);

      await offlineDb.couplingDrafts.put({
        checklistId,
        action,
        clientId: currentClient.id,
        trailerId: bootstrap.trailer_id,
        trailerPlate: normalizedTrailerPlate,
        tractorId: bootstrap.tractor_id,
        tractorPlate: normalizedTractorPlate,
        tractorDriverName: tractorDriverName.trim(),
        thirdPartyTractorId: bootstrap.third_party_tractor_id,
        thirdPartyDriverId: bootstrap.third_party_driver_id,
        platePhotoUrl,
        platePhotoLat: platePhoto.latitude,
        platePhotoLng: platePhoto.longitude,
        openCouplingId: bootstrap.open_coupling_id,
        openCouplingOdometer: bootstrap.open_coupling_odometer,
        savedAt: Date.now(),
      });

      return checklistId;
    },
    onSuccess: async (checklistId) => {
      await queryClient.invalidateQueries({ queryKey: ['openChecklist', user?.id, currentClient?.id] });
      await queryClient.invalidateQueries({ queryKey: ['checklists', currentClient?.id] });
      void navigate(`/checklists/preencher/${checklistId}`);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    },
  });

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  const normalizedTrailerPlate = normalizePlate(trailerPlate);
  const normalizedTractorPlate = normalizePlate(tractorPlate);
  const plateReady = normalizedTrailerPlate.length === 7;
  const tractorReady = normalizedTractorPlate.length === 7 && tractorDriverName.trim().length > 0;
  const lookupValid = lookupResult && lookupResult.exists && (
    (action === 'Engate' && lookupResult.available)
    || (action === 'Desengate' && !lookupResult.available)
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-zinc-400 uppercase">Fluxo isolado</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Engate e desengate</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Digite a placa da carreta, valide a disponibilidade no backend e registre a evidência fotográfica antes de iniciar o checklist.
            </p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
            <Link2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Ação</span>
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value as CouplingAction);
                  setLookupResult(null);
                }}
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none"
              >
                <option value="Engate">Engate</option>
                <option value="Desengate">Desengate</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Template</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none"
                disabled={templatesLoading || templates.length === 0}
              >
                <option value="">{templatesLoading ? 'Carregando...' : 'Selecione o template'}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Placa da carreta</span>
              <input
                value={trailerPlate}
                onChange={(event) => {
                  setTrailerPlate(normalizePlate(event.target.value));
                  setLookupResult(null);
                }}
                placeholder="ABC1D23"
                maxLength={7}
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2.5 font-medium tracking-[0.18em] text-zinc-900 uppercase focus:border-orange-400 focus:outline-none"
              />
            </label>

            <div className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Validação do backend</span>
              <button
                type="button"
                disabled={!plateReady || lookupMutation.isPending}
                onClick={() => lookupMutation.mutate(normalizedTrailerPlate)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {lookupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Validar placa
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Placa do cavalo</span>
              <input
                value={tractorPlate}
                onChange={(event) => setTractorPlate(normalizePlate(event.target.value))}
                placeholder="XYZ9K88"
                maxLength={7}
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2.5 font-medium tracking-[0.18em] text-zinc-900 uppercase focus:border-orange-400 focus:outline-none"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Nome do condutor</span>
              <input
                value={tractorDriverName}
                onChange={(event) => setTractorDriverName(event.target.value)}
                placeholder="Nome completo"
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-orange-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Foto obrigatória da placa física</p>
                <p className="mt-1 text-xs text-zinc-500">
                  A evidência precisa sair com geolocalização. O arquivo é enviado para o bucket <code>checklist-photos</code>.
                </p>
              </div>
              {platePhoto ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Evidência pronta
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
              >
                <Camera className="h-4 w-4" />
                {platePhoto ? 'Refazer foto' : 'Capturar foto'}
              </button>
              {platePhoto?.latitude != null && platePhoto.longitude != null ? (
                <span className="text-xs text-zinc-500">
                  GPS: {platePhoto.latitude.toFixed(5)}, {platePhoto.longitude.toFixed(5)}
                </span>
              ) : (
                <span className="text-xs text-red-600">Sem GPS a foto não libera o checklist.</span>
              )}
            </div>

            {platePhoto ? (
              <img
                src={platePhoto.previewUrl}
                alt="Prévia da placa"
                className="mt-4 h-48 w-full rounded-3xl object-cover"
              />
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!selectedTemplate || !lookupValid || !tractorReady || !platePhoto || platePhoto.latitude == null || platePhoto.longitude == null || startMutation.isPending}
            onClick={() => startMutation.mutate()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar checklist de {action.toLowerCase()}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">Resultado da validação</p>
            {!lookupResult ? (
              <p className="mt-3 text-sm text-zinc-500">Nenhuma placa validada ainda.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div className={cn(
                  'rounded-2xl px-3 py-2',
                  lookupResult.exists ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                )}>
                  {lookupResult.exists ? 'A placa existe no tenant atual.' : 'A placa não existe no tenant atual.'}
                </div>
                <div className={cn(
                  'rounded-2xl px-3 py-2',
                  lookupResult.available ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700',
                )}>
                  {lookupResult.available ? 'A carreta está desvinculada.' : 'A carreta já possui engate aberto.'}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-900">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold">Regras de segurança</p>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              <li>A digitação da placa é obrigatória; não há lista de carretas disponível na UI.</li>
              <li>A validação do servidor só devolve <code>exists</code> e <code>available</code>.</li>
              <li>Sem foto geolocalizada da placa física o fluxo não prossegue.</li>
              {!isFleetOperator ? (
                <li>O papel `Coupling Agent` fica isolado neste fluxo e na troca de senha.</li>
              ) : (
                <li>Perfis internos podem usar a rota para teste, sem receber o menu restrito do terceiro.</li>
              )}
            </ul>
          </div>

          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
              <p className="text-sm text-amber-900">
                O fluxo depende de conexão ativa para validar a placa, abrir o checklist e gravar o rascunho técnico do engate/desengate.
              </p>
            </div>
          </div>
        </div>
      </div>

      {cameraOpen ? (
        <CameraCapture
          onCapture={(file, latitude, longitude) => {
            setPlatePhoto({
              file,
              previewUrl: URL.createObjectURL(file),
              latitude,
              longitude,
            });
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}
    </div>
  );
}
