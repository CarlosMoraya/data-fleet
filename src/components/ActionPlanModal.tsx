import React, { useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { actionPlanToRow, actionStatusLabel, actionStatusColor } from '../lib/actionPlanMappers';
import type { ActionPlan, ActionPlanStatus } from '../types';
import { cn } from '../lib/utils';

interface Props {
  plan: ActionPlan;
  onClose: () => void;
  onSaved: () => void;
}

const STATUSES: ActionPlanStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

export default function ActionPlanModal({ plan, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<ActionPlanStatus>(plan.status);
  const [workOrder, setWorkOrder] = useState(plan.workOrderNumber ?? '');
  const [notes, setNotes] = useState(plan.completionNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (status === 'completed' && !workOrder.trim()) {
      setError('Número da O.S. é obrigatório para concluir a ação.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const patch = actionPlanToRow({
        status,
        workOrderNumber: workOrder.trim() || undefined,
        completionNotes: notes.trim() || undefined,
        completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      });
      const { error: upErr } = await supabase
        .from('action_plans')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', plan.id);
      if (upErr) throw upErr;
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-zinc-800 mt-0.5">{value}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Plano de Ação</h2>
            <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium mt-1', actionStatusColor(plan.status))}>
              {actionStatusLabel(plan.status)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Read-only info */}
          <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Informações do ocorrido</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veículo" value={plan.vehicleLicensePlate} />
              <Field label="Template" value={plan.templateName} />
              <Field label="Item inspecionado" value={plan.itemTitle} />
              <Field label="Reportado por" value={plan.reportedByName} />
              {plan.createdAt && (
                <Field
                  label="Data"
                  value={new Date(plan.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                />
              )}
            </div>
            {plan.observedIssue && (
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Observação do motorista/auditor</p>
                <p className="text-sm text-zinc-700 mt-0.5 italic">"{plan.observedIssue}"</p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wide">Ação sugerida</p>
              <p className="text-sm text-zinc-800 font-medium mt-0.5">{plan.suggestedAction}</p>
            </div>
            {plan.photoUrl && (
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Foto do problema</p>
                <div className="flex items-center gap-2">
                  <img src={plan.photoUrl} alt="foto" className="h-20 w-20 rounded-lg object-cover" />
                  <a
                    href={plan.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                  >
                    <Camera className="h-3 w-3" />
                    Ampliar
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Editable section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Gestão da ação</h3>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ActionPlanStatus)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{actionStatusLabel(s)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Número da O.S.{status === 'completed' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={workOrder}
                onChange={e => setWorkOrder(e.target.value)}
                placeholder="Ex: OS-2025-001"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Notas de conclusão</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Descreva o que foi feito..."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {plan.completedByName && plan.completedAt && (
              <p className="text-xs text-zinc-400">
                Concluída por {plan.completedByName} em {new Date(plan.completedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-zinc-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}
