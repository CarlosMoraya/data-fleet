import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Gauge, Loader2, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePendingTireInspectionCount } from '../hooks/usePendingTireInspectionCount';
import OfflineBanner from '../components/OfflineBanner';
import { VehicleBlueprintDiagram } from '../components/VehicleBlueprintDiagram';
import { TireInspectionForm } from '../components/TireInspectionForm';
import { enqueueOperation, enqueuePhoto } from '../lib/offline/syncService';
import {
  fetchTireInspection,
  fetchTireInspectionResponses,
  fetchDistinctManufacturers,
  fetchDistinctBrands,
  saveInspectionResponse,
  completeTireInspection,
} from '../services/tireInspectionService';
import { supabase } from '../lib/supabase';
import type { TireInspectionResponse } from '../types';

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
    queryFn: () => fetchTireInspection(inspectionId!),
    enabled: !!inspectionId,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['tireInspectionResponses', inspectionId],
    queryFn: () => fetchTireInspectionResponses(inspectionId!),
    enabled: !!inspectionId && kmConfirmed,
    gcTime: Infinity,
    networkMode: 'offlineFirst',
  });

  const { data: manufacturers = [] } = useQuery({
    queryKey: ['tireManufacturers', inspection?.vehicleId],
    queryFn: () => fetchDistinctManufacturers(inspection!.vehicleId),
    enabled: !!inspection?.vehicleId,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['tireBrands', inspection?.vehicleId],
    queryFn: () => fetchDistinctBrands(inspection!.vehicleId),
    enabled: !!inspection?.vehicleId,
  });

  // Map positionCode → tireId + tireCode
  const { data: tireMap = {} } = useQuery<Record<string, TireMapEntry>>({
    queryKey: ['vehicleTireMap', inspection?.vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tires')
        .select('id, tire_code, current_position')
        .eq('vehicle_id', inspection!.vehicleId)
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

  const isCompleted = inspection?.status === 'completed';

  // KM: já confirmado se odometer_km está preenchido
  const odometerAlreadySet = !!inspection?.odometerKm;

  // ── KM confirmation ───────────────────────────────────────────────────────

  const confirmKmMutation = useMutation({
    mutationFn: async (km: number) => {
      if (!isOnline) {
        await enqueueOperation({ type: 'confirm_tire_km', odometerKm: km }, '', inspectionId!);
        return;
      }
      const { error } = await supabase
        .from('tire_inspections')
        .update({ odometer_km: km })
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
    mutationFn: async ({ data, blob }: { data: Omit<TireInspectionResponse, 'id'>; blob?: Blob }) => {
      if (!isOnline && blob) {
        const photoKey = await enqueuePhoto(blob, currentClient!.id, inspectionId!, data.positionCode);
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
        }, inspectionId!);
        return;
      }
      await saveInspectionResponse({
        inspectionId: inspectionId!,
        clientId: currentClient!.id,
        response: { ...data, inspectionId: inspectionId! },
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
    mutationFn: async () => {
      if (!isOnline) {
        await enqueueOperation({
          type: 'finish_tire_inspection',
          completedAt: new Date().toISOString(),
          vehicleId: inspection!.vehicleId,
        }, inspectionId!);
        return;
      }
      await completeTireInspection(inspectionId!, inspection!.odometerKm ?? 0);
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!inspection) return null;

  const showKmStep = !odometerAlreadySet && !kmConfirmed;

  const selectedTire = selectedPosition ? tireMap[selectedPosition] : undefined;
  const existingResponse = selectedPosition ? responseByCode[selectedPosition] : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/checklists')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">Inspeção de Pneus</p>
          <p className="text-sm text-gray-500 truncate">{inspection.vehicleLicensePlate}</p>
        </div>
        {isCompleted && (
          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
            <CheckCircle size={16} />
            Concluída
          </span>
        )}
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">

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
        {(kmConfirmed || odometerAlreadySet) && (
          <>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-sm text-gray-500 mb-3">
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
            <ProgressBar total={answeredCodes.size + (inspection.axleConfigSnapshot.length || 0)} done={answeredCodes.size} />

            {/* Finish button */}
            {!isCompleted && (
              <div>
                {finishError && <p className="text-sm text-red-600 mb-2">{finishError}</p>}
                <button
                  type="button"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="w-full py-3 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
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
    <div className="bg-white rounded-xl border p-4 space-y-3">
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
        className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
      >
        {loading ? 'Confirmando...' : 'Confirmar KM'}
      </button>
    </div>
  );
}

function ProgressBar({ total, done }: { total: number; done: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Progresso</span>
        <span>{done} / {total} pneus</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
