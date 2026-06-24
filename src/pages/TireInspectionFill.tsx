import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Gauge, Loader2, CheckCircle } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import OfflineBanner from '../components/OfflineBanner';
import { TireInspectionForm } from '../components/TireInspectionForm';
import { VehicleBlueprintDiagram } from '../components/VehicleBlueprintDiagram';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePendingTireInspectionCount } from '../hooks/usePendingTireInspectionCount';
import { enqueueOperation, enqueuePhoto } from '../lib/offline/syncService';
import { applyOfflineKm } from '../lib/offlineCacheUpdates';
import { supabase } from '../lib/supabase';
import { generatePositionsFromConfig } from '../lib/tirePositions';
import {
  fetchTireInspection,
  fetchTireInspectionResponses,
  fetchDistinctManufacturers,
  fetchDistinctBrands,
  saveInspectionResponse,
  completeTireInspection,
} from '../services/tireInspectionService';

import type { TireInspection, TireInspectionResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TireMapEntry {
  tireId?: string;
  tireCode?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TireInspectionFill() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const { currentClient, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingTireInspectionCount(inspectionId ?? '');

  const [kmInput, setKmInput] = useState('');
  const [kmConfirmed, setKmConfirmed] = useState(false);
  const [kmError, setKmError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [finishError, setFinishError] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: inspection, isLoading: loadingInspection } = useQuery({
    queryKey: ['tireInspection', inspectionId],
    queryFn: () => fetchTireInspection(inspectionId),
    enabled: !!inspectionId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['tireInspectionResponses', inspectionId],
    queryFn: () => fetchTireInspectionResponses(inspectionId),
    enabled: !!inspectionId && (kmConfirmed || !!inspection?.odometerKm),
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: manufacturers = [] } = useQuery({
    queryKey: ['tireManufacturers', inspection?.vehicleId],
    queryFn: () => fetchDistinctManufacturers(inspection.vehicleId),
    enabled: !!inspection?.vehicleId,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['tireBrands', inspection?.vehicleId],
    queryFn: () => fetchDistinctBrands(inspection.vehicleId),
    enabled: !!inspection?.vehicleId,
  });

  // Map positionCode → tireId + tireCode
  const { data: tireMap = {} } = useQuery<Record<string, TireMapEntry>>({
    queryKey: ['vehicleTireMap', inspection?.vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tires')
        .select('id, tire_code, current_position')
        .eq('vehicle_id', inspection.vehicleId)
        .eq('active', true);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((t: { id: string; tire_code: string; current_position: string }) => [
          t.current_position,
          { tireId: t.id, tireCode: t.tire_code },
        ]),
      );
    },
    enabled: !!inspection?.vehicleId,
  });

  // ── Derived state ─────────────────────────────────────────────────────────

  const answeredCodes = useMemo(
    () => new Set(responses.map(r => r.positionCode)),
    [responses],
  );

  const responseByCode = useMemo(
    () => Object.fromEntries(responses.map(r => [r.positionCode, r])),
    [responses],
  );

  const totalPositions = useMemo(
    () =>
      inspection
        ? generatePositionsFromConfig(
            inspection.axleConfigSnapshot,
            inspection.stepsCountSnapshot,
            '',
          ).length
        : 0,
    [inspection],
  );

  const isCompleted = inspection?.status === 'completed';

  useEffect(() => {
    if (inspection?.odometerKm && kmInput === '') {
      setKmInput(String(inspection.odometerKm));
    }
  }, [inspection?.odometerKm]);

  // ── KM confirmation ───────────────────────────────────────────────────────

  const confirmKmMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async (km: number) => {
      const startedAt = new Date().toISOString();
      if (!isOnline) {
        await enqueueOperation({ type: 'confirm_tire_km', odometerKm: km, startedAt }, '', inspectionId);
        queryClient.setQueryData(
          ['tireInspection', inspectionId],
          (old: TireInspection | undefined) => (old ? { ...applyOfflineKm(old, km), startedAt } : old),
        );
        return;
      }
      const { error } = await supabase
        .from('tire_inspections')
        .update({ odometer_km: km, started_at: startedAt })
        .eq('id', inspectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireInspection', inspectionId] });
      setKmConfirmed(true);
    },
  });

  function handleConfirmKm() {
    setKmError(null);
    const parsed = parseInt(kmInput, 10);
    if (!kmInput.trim() || isNaN(parsed) || parsed <= 0) {
      setKmError('Informe o Km atual do veículo.');
      return;
    }
    confirmKmMutation.mutate(parsed);
  }

  // ── Save response ─────────────────────────────────────────────────────────

  const saveResponseMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async ({ data, blob }: { data: Omit<TireInspectionResponse, 'id'>; blob?: Blob }) => {
      if (!isOnline && blob) {
        const photoKey = await enqueuePhoto(blob, currentClient!.id, inspectionId, data.positionCode);
        await enqueueOperation({
          type: 'save_tire_response',
          positionCode: data.positionCode,
          tireId: data.tireId,
          dot: data.dot,
          fireMarking: data.fireMarking,
          manufacturer: data.manufacturer,
          brand: data.brand,
          photoUrl: '',
          pendingPhotoKey: photoKey,
          photoTimestamp: data.photoTimestamp,
          status: data.status,
          observation: data.observation,
          respondedAt: data.respondedAt,
        }, inspectionId);
        queryClient.setQueryData(['tireInspectionResponses', inspectionId], (old: TireInspectionResponse[] | undefined) => {
          const response: TireInspectionResponse = { ...data, id: `offline-${data.positionCode}`, inspectionId: inspectionId, photoUrl: '' };
          const base = old ?? [];
          return [...base.filter(r => r.positionCode !== response.positionCode), response];
        });
        return;
      }
      await saveInspectionResponse({
        inspectionId: inspectionId,
        clientId: currentClient!.id,
        response: { ...data, inspectionId: inspectionId },
        photoBlob: blob,
        photoFilename: `${data.positionCode}_${Date.now()}.jpg`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireInspectionResponses', inspectionId] });
      setSelectedPosition(null);
    },
  });

  // ── Complete inspection ───────────────────────────────────────────────────

  const completeMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: async () => {
      if (!isOnline) {
        const completedAt = new Date().toISOString();
        await enqueueOperation({
          type: 'finish_tire_inspection',
          completedAt,
          vehicleId: inspection.vehicleId,
        }, inspectionId);
        queryClient.setQueryData(['tireInspection', inspectionId], (old: TireInspection | undefined) => old ? { ...old, status: 'completed', completedAt } : old);
        return;
      }
      await completeTireInspection(inspectionId, inspection.odometerKm ?? 0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireInspection', inspectionId] });
      navigate('/checklists');
    },
    onError: (e: Error) => setFinishError(e.message),
  });

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loadingInspection) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!inspection) return null;

  const showKmStep = !isCompleted && !kmConfirmed;

  const selectedTire = selectedPosition ? tireMap[selectedPosition] : undefined;
  const existingResponse = selectedPosition ? responseByCode[selectedPosition] : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
        <button type="button" onClick={() => navigate('/checklists')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">Inspeção de Pneus</p>
          <p className="truncate text-sm text-gray-500">{inspection.vehicleLicensePlate}</p>
        </div>
        {isCompleted && (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600">
            <CheckCircle size={16} />
            Concluída
          </span>
        )}
      </div>

      <div className="mx-auto max-w-lg space-y-6 p-4">

        {/* Step 1: KM */}
        {showKmStep && (
          <KmStep
            kmInput={kmInput}
            kmError={kmError}
            loading={confirmKmMutation.isPending}
            onChange={setKmInput}
            onConfirm={handleConfirmKm}
          />
        )}

        {/* Step 2: Blueprint */}
        {(kmConfirmed || isCompleted) && (
          <>
            <div className="rounded-xl border bg-white p-4">
              <p className="mb-3 text-sm text-gray-500">
                Toque em cada pneu para inspecionar.
              </p>
              <VehicleBlueprintDiagram
                axleConfig={inspection.axleConfigSnapshot}
                stepsCount={inspection.stepsCountSnapshot}
                answeredCodes={answeredCodes}
                onTireClick={isCompleted ? () => {} : setSelectedPosition}
              />
            </div>

            {/* Progress */}
            <ProgressBar total={totalPositions} done={answeredCodes.size} />

            {/* Finish button */}
            {!isCompleted && (
              <div>
                {finishError && <p className="mb-2 text-sm text-red-600">{finishError}</p>}
                <button
                  type="button"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="w-full rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {completeMutation.isPending ? 'Finalizando...' : 'Finalizar Inspeção'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de pneu */}
      {selectedPosition && !isCompleted && (
        <TireInspectionForm
          positionCode={selectedPosition}
          positionLabel={selectedPosition}
          tireId={selectedTire?.tireId}
          tireCode={selectedTire?.tireCode}
          manufacturers={manufacturers}
          brands={brands}
          existing={existingResponse}
          onSave={async (data, blob) => {
            await saveResponseMutation.mutateAsync({ data, blob });
          }}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KmStep({ kmInput, kmError, loading, onChange, onConfirm }: {
  kmInput: string;
  kmError: string | null;
  loading: boolean;
  onChange: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 text-gray-700">
        <Gauge size={20} />
        <span className="font-medium">KM atual do veículo</span>
      </div>
      <input
        type="number"
        min={0}
        value={kmInput}
        onChange={e => onChange(e.target.value)}
        className="input-field w-full"
        placeholder="Ex: 125000"
        onKeyDown={e => e.key === 'Enter' && onConfirm()}
      />
      {kmError && <p className="text-sm text-red-600">{kmError}</p>}
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Confirmando...' : 'Confirmar KM'}
      </button>
    </div>
  );
}

function ProgressBar({ total, done }: { total: number; done: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-2 flex justify-between text-sm text-gray-600">
        <span>Progresso</span>
        <span>{done} / {total} pneus</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
