import React from 'react';
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchTireInspectionResponses } from '../services/tireInspectionService';
import type { TireInspection, TireInspectionResponse } from '../types';

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

        {/* Photo gallery */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-zinc-400" size={28} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
                {responses.map(r => (
                  <div key={r.id}>
                    <TireResponseCard response={r} />
                  </div>
                ))}
              </div>
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

function TireResponseCard({ response }: { response: TireInspectionResponse }) {
  const isConform = response.status === 'conforme';

  return (
    <div className="flex-shrink-0 w-40 rounded-xl border overflow-hidden bg-white shadow-sm">
      {/* Photo */}
      <div className="relative w-full h-32 bg-zinc-100">
        {response.photoUrl ? (
          <img src={response.photoUrl} alt={response.positionCode} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-300 text-xs">Sem foto</div>
        )}
        {/* Status badge */}
        <div className={`absolute top-1 right-1 rounded-full p-0.5 ${isConform ? 'bg-green-500' : 'bg-red-500'}`}>
          {isConform
            ? <CheckCircle size={14} className="text-white" />
            : <XCircle size={14} className="text-white" />
          }
        </div>
      </div>

      {/* Info */}
      <div className="p-2 space-y-1 text-xs">
        <p className="font-semibold text-zinc-800">{response.positionCode}</p>
        {response.dot && <p className="text-zinc-500">DOT: {response.dot}</p>}
        {response.fireMarking && <p className="text-zinc-500">MF: {response.fireMarking}</p>}
        <p className="text-zinc-600 truncate" title={response.manufacturer}>{response.manufacturer}</p>
        <p className="text-zinc-600 truncate" title={response.brand}>{response.brand}</p>
        {response.observation && (
          <p className="text-zinc-400 italic truncate" title={response.observation}>{response.observation}</p>
        )}
      </div>
    </div>
  );
}
