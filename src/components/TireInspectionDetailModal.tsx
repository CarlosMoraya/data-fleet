import React from 'react';
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchTireInspectionComparison,
  fetchTireInspectionResponses,
  type PositionComparison,
} from '../services/tireInspectionService';
import type { TireInspection } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  inspection: TireInspection;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TireInspectionDetailModal({ inspection, onClose }: Props) {
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['tireInspectionResponses', inspection.id],
    queryFn: () => fetchTireInspectionResponses(inspection.id),
  });

  const {
    data: comparison = [],
    isLoading: loadingComparison,
    isError: comparisonError,
  } = useQuery({
    queryKey: ['tireInspectionComparison', inspection.id],
    queryFn: () => fetchTireInspectionComparison(inspection.vehicleId, inspection),
  });

  const total = responses.length;
  const conformes = responses.filter(r => r.status === 'conforme').length;
  const naoConformes = total - conformes;
  const conformRate = total > 0 ? Math.round((conformes / total) * 100) : 0;

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Inspeção de Pneus</h2>
            <p className="text-sm text-zinc-500">
              {inspection.vehicleLicensePlate} — {formatDate(inspection.startedAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        </div>

        {/* Meta */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b text-sm">
          <MetaField label="Inspetor" value={inspection.filledByName ?? '—'} />
          <MetaField label="KM" value={inspection.odometerKm ? `${inspection.odometerKm.toLocaleString('pt-BR')} km` : '—'} />
          <MetaField label="Início" value={formatDate(inspection.startedAt)} />
          <MetaField label="Conclusão" value={formatDate(inspection.completedAt)} />
        </div>

        {/* Summary */}
        <div className="px-6 py-4 flex gap-6 border-b text-sm">
          <SummaryBadge label="Total" value={total} color="gray" />
          <SummaryBadge label="Conformes" value={conformes} color="green" />
          <SummaryBadge label="Não Conformes" value={naoConformes} color="red" />
          <SummaryBadge label="Conformidade" value={`${conformRate}%`} color="blue" />
        </div>

        {/* Comparison */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">Comparação (3 últimas inspeções)</h3>
          {loadingComparison || isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-zinc-400" size={28} />
            </div>
          ) : comparisonError ? (
            <p className="text-sm text-red-600 py-8 text-center">Não foi possível carregar a comparação.</p>
          ) : comparison.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">Nenhuma foto registrada para esta inspeção.</p>
          ) : (
            <div className="space-y-3">
              {comparison.map(item => (
                <div key={item.positionCode}>
                  <PositionComparisonRow comparison={item} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="font-medium text-zinc-800">{value}</p>
    </div>
  );
}

function SummaryBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'text-zinc-700 bg-zinc-100',
    green: 'text-green-700 bg-green-50',
    red: 'text-red-700 bg-red-50',
    blue: 'text-blue-700 bg-blue-50',
  };
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${colorMap[color]}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function PositionComparisonRow({ comparison }: { comparison: PositionComparison }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 sm:flex sm:gap-4">
      <div className="mb-3 sm:mb-0 sm:w-32 sm:flex-shrink-0">
        <p className="text-sm font-semibold text-zinc-900">{comparison.positionCode}</p>
        <p className="text-xs text-zinc-500">{comparison.positionLabel}</p>
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex gap-3 pb-1" style={{ minWidth: 'max-content' }}>
          {comparison.photos.map(photo => (
            <div key={photo.inspectionId}>
              <ComparisonPhotoCard
                photo={photo}
                positionCode={comparison.positionCode}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonPhotoCard({
  photo,
  positionCode,
}: {
  photo: PositionComparison['photos'][number];
  positionCode: string;
}) {
  const isConform = photo.status === 'conforme';
  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="flex-shrink-0 w-40 rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
      <div className="relative w-full h-32 bg-zinc-100">
        {photo.photoUrl ? (
          <img src={photo.photoUrl} alt={positionCode} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-300 text-xs">Sem foto</div>
        )}
        <div className={`absolute top-1 right-1 rounded-full p-0.5 ${isConform ? 'bg-green-500' : 'bg-red-500'}`}>
          {isConform
            ? <CheckCircle size={14} className="text-white" />
            : <XCircle size={14} className="text-white" />
          }
        </div>
        {photo.isCurrent && (
          <span className="absolute left-1 top-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            Atual
          </span>
        )}
      </div>
      <div className="p-2 space-y-1 text-xs">
        <p className="font-medium text-zinc-800">{formatDate(photo.inspectionDate)}</p>
        <p className={isConform ? 'text-green-700' : 'text-red-700'}>
          {isConform ? 'Conforme' : 'Não conforme'}
        </p>
      </div>
    </div>
  );
}
