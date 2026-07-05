import { X, CheckCircle, XCircle, MinusCircle, Camera } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { checklistResponseFromRow, type ChecklistResponseRow } from '../lib/checklistMappers';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

import type { Checklist, ChecklistResponse } from '../types';

interface Props {
  checklist: Checklist;
  onClose: () => void;
}

const STATUS_ICON = {
  ok: <CheckCircle className="h-4 w-4 text-green-500" />,
  issue: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <MinusCircle className="h-4 w-4 text-zinc-400" />,
  not_applicable: <MinusCircle className="h-4 w-4 text-zinc-400" />,
};

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  issue: 'Problema',
  skipped: 'Pulado',
  not_applicable: 'N/A',
};

const STATUS_BG: Record<string, string> = {
  ok: 'bg-green-50 border-green-200',
  issue: 'bg-red-50 border-red-200',
  skipped: 'bg-zinc-50 border-zinc-200',
  not_applicable: 'bg-zinc-50 border-zinc-200',
};

export default function ChecklistDetailModal({ checklist, onClose }: Props) {
  const [responses, setResponses] = useState<ChecklistResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('checklist_responses')
        .select('*, checklist_items(title)')
        .eq('checklist_id', checklist.id)
        .order('responded_at');
      setResponses((data ?? []).map(r => checklistResponseFromRow(r as ChecklistResponseRow)));
      setLoading(false);
    })();
  }, [checklist.id]);

  const total = responses.length;
  const ok = responses.filter(r => r.status === 'ok').length;
  const issues = responses.filter(r => r.status === 'issue').length;
  const na = responses.filter(r => r.status === 'not_applicable').length;
  const conformRate = total > 0 ? Math.round((ok / total) * 100) : 0;

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{checklist.templateName ?? 'Checklist'}</h2>
            <p className="text-sm text-zinc-500">
              {checklist.vehicleLicensePlate ?? 'Livre'} · {formatDate(checklist.startedAt)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Conformidade', value: `${conformRate}%`, color: conformRate >= 80 ? 'text-green-600' : conformRate >= 60 ? 'text-yellow-600' : 'text-red-600' },
              { label: 'OK', value: ok, color: 'text-green-600' },
              { label: 'Problemas', value: issues, color: 'text-red-600' },
              { label: 'N/A', value: na, color: 'text-zinc-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-zinc-100 p-3 text-center">
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs tracking-wide text-zinc-400 uppercase">Preenchido por</p>
              <p className="font-medium text-zinc-800">{checklist.filledByName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-zinc-400 uppercase">Concluído em</p>
              <p className="font-medium text-zinc-800">{formatDate(checklist.completedAt)}</p>
            </div>
            {checklist.latitude && checklist.longitude && (
              <div className="col-span-2">
                <p className="text-xs tracking-wide text-zinc-400 uppercase">GPS</p>
                <p className="font-medium text-zinc-800">{checklist.latitude.toFixed(5)}, {checklist.longitude.toFixed(5)}</p>
              </div>
            )}
            {checklist.notes && (
              <div className="col-span-2">
                <p className="text-xs tracking-wide text-zinc-400 uppercase">Observações gerais</p>
                <p className="text-zinc-700">{checklist.notes}</p>
              </div>
            )}
          </div>

          {checklist.odometerKm != null && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-700">Hodômetro</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs tracking-wide text-zinc-400 uppercase">KM registrado</p>
                  <p className="font-medium text-zinc-800">{checklist.odometerKm.toLocaleString('pt-BR')} km</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-zinc-400 uppercase">Exigiu foto</p>
                  <p className="font-medium text-zinc-800">{checklist.odometerPhotoUrl ? 'Sim' : 'Não'}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-zinc-400 uppercase">Veículo</p>
                  <p className="font-medium text-zinc-800">{checklist.vehicleLicensePlate ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-zinc-400 uppercase">Preenchido por</p>
                  <p className="font-medium text-zinc-800">{checklist.filledByName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-zinc-400 uppercase">Iniciado em</p>
                  <p className="font-medium text-zinc-800">{formatDate(checklist.startedAt)}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-zinc-400 uppercase">Concluído em</p>
                  <p className="font-medium text-zinc-800">{formatDate(checklist.completedAt)}</p>
                </div>
                {checklist.odometerPhotoUrl && (
                  <div className="col-span-2 mt-1 flex items-center gap-2">
                    <img src={checklist.odometerPhotoUrl} alt="foto do hodômetro" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(checklist.odometerPhotoUrl!)}
                      className="flex items-center gap-1 text-xs text-orange-500 hover:underline"
                    >
                      <Camera className="h-3 w-3" />
                      Visualizar foto
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Responses */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">Respostas</h3>
            {loading ? (
              <p className="py-4 text-center text-sm text-zinc-400">Carregando...</p>
            ) : responses.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400 italic">Nenhuma resposta registrada.</p>
            ) : (
              <div className="space-y-2">
                {responses.map((r, idx) => (
                  <div
                    key={r.id}
                    className={cn('rounded-xl border p-3', STATUS_BG[r.status] ?? 'border-zinc-200 bg-zinc-50')}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{STATUS_ICON[r.status as keyof typeof STATUS_ICON]}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-900">
                            {idx + 1}. {r.itemTitle ?? `Item ${idx + 1}`}
                          </p>
                          <span className="flex-shrink-0 text-xs font-medium">{STATUS_LABEL[r.status]}</span>
                        </div>
                        {r.observation && (
                          <p className="mt-1 text-xs text-zinc-600">{r.observation}</p>
                        )}
                        {r.photoUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={r.photoUrl} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(r.photoUrl!)}
                              className="flex items-center gap-1 text-xs text-orange-500 hover:underline"
                            >
                              <Camera className="h-3 w-3" />
                              Visualizar foto
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <button onClick={onClose} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Fechar
          </button>
        </div>
      </div>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Foto do checklist" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Fechar"
          >
            <X size={28} />
          </button>
        </div>
      )}
    </div>
  );
}
