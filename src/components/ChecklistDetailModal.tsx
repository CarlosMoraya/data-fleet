import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, MinusCircle, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { checklistResponseFromRow, type ChecklistResponseRow } from '../lib/checklistMappers';
import type { Checklist, ChecklistResponse } from '../types';
import { cn } from '../lib/utils';

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

  useEffect(() => {
    (async () => {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{checklist.templateName ?? 'Checklist'}</h2>
            <p className="text-sm text-zinc-500">
              {checklist.vehicleLicensePlate ?? 'Livre'} · {formatDate(checklist.startedAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Conformidade', value: `${conformRate}%`, color: conformRate >= 80 ? 'text-green-600' : conformRate >= 60 ? 'text-yellow-600' : 'text-red-600' },
              { label: 'OK', value: ok, color: 'text-green-600' },
              { label: 'Problemas', value: issues, color: 'text-red-600' },
              { label: 'N/A', value: na, color: 'text-zinc-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center rounded-xl border border-zinc-100 p-3">
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wide">Preenchido por</p>
              <p className="font-medium text-zinc-800">{checklist.filledByName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wide">Concluído em</p>
              <p className="font-medium text-zinc-800">{formatDate(checklist.completedAt)}</p>
            </div>
            {checklist.latitude && checklist.longitude && (
              <div className="col-span-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">GPS</p>
                <p className="font-medium text-zinc-800">{checklist.latitude.toFixed(5)}, {checklist.longitude.toFixed(5)}</p>
              </div>
            )}
            {checklist.notes && (
              <div className="col-span-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Observações gerais</p>
                <p className="text-zinc-700">{checklist.notes}</p>
              </div>
            )}
          </div>

          {/* Responses */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Respostas</h3>
            {loading ? (
              <p className="text-sm text-zinc-400 text-center py-4">Carregando...</p>
            ) : responses.length === 0 ? (
              <p className="text-sm text-zinc-400 italic text-center py-4">Nenhuma resposta registrada.</p>
            ) : (
              <div className="space-y-2">
                {responses.map((r, idx) => (
                  <div
                    key={r.id}
                    className={cn('rounded-xl border p-3', STATUS_BG[r.status] ?? 'bg-zinc-50 border-zinc-200')}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{STATUS_ICON[r.status as keyof typeof STATUS_ICON]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-900">
                            {idx + 1}. {r.itemTitle ?? `Item ${idx + 1}`}
                          </p>
                          <span className="text-xs font-medium flex-shrink-0">{STATUS_LABEL[r.status]}</span>
                        </div>
                        {r.observation && (
                          <p className="text-xs text-zinc-600 mt-1">{r.observation}</p>
                        )}
                        {r.photoUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <img src={r.photoUrl} alt="foto" className="h-16 w-16 rounded-lg object-cover" />
                            <a
                              href={r.photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                            >
                              <Camera className="h-3 w-3" />
                              Visualizar foto
                            </a>
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

        <div className="flex justify-end px-6 py-4 border-t">
          <button onClick={onClose} className="px-5 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
