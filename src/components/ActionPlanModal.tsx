import React, { useState } from 'react';
import { X, Camera, Loader2, CheckCircle, UserCheck, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { actionPlanToRow, actionStatusLabel, actionStatusColor } from '../lib/actionPlanMappers';
import type { ActionPlan } from '../types';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface Props {
  plan: ActionPlan;
  onClose: () => void;
  onSaved: () => void;
}

const ROLE_RANK: Record<string, number> = {
  'Driver': 1,
  'Yard Auditor': 2,
  'Fleet Assistant': 3,
  'Fleet Analyst': 4,
  'Manager': 5,
  'Director': 6,
  'Admin Master': 7,
};

export default function ActionPlanModal({ plan, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const rank = ROLE_RANK[user?.role ?? ''] ?? 0;
  const isAnalystPlus = rank >= 4;
  const isAssistantPlus = rank >= 3;

  const [evidenceUrl, setEvidenceUrl] = useState(plan.conclusionEvidenceUrl ?? '');
  const [notes, setNotes] = useState(plan.completionNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = async (patch: Parameters<typeof actionPlanToRow>[0]) => {
    setSaving(true);
    setError('');
    try {
      const row = actionPlanToRow({ ...patch });
      const { error: upErr } = await supabase
        .from('action_plans')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', plan.id);
      if (upErr) throw upErr;
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setSaving(false);
    }
  };

  const handleClaim = () =>
    update({ status: 'in_progress', claimedBy: user?.id, claimedAt: new Date().toISOString() });

  const handleSubmitConclusion = () => {
    update({
      status: 'awaiting_conclusion',
      conclusionEvidenceUrl: evidenceUrl.trim() || undefined,
      completionNotes: notes.trim() || undefined,
    });
  };

  const handleApprove = () =>
    update({
      status: 'completed',
      completedBy: user?.id,
      completedAt: new Date().toISOString(),
    });

  const handleReject = () =>
    update({ status: 'in_progress' });

  const Field = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-zinc-800 mt-0.5">{value}</p>
      </div>
    ) : null;

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : undefined;

  const canClaim = plan.status === 'pending' && isAssistantPlus;
  const canConclude =
    plan.status === 'in_progress' &&
    (plan.claimedBy === user?.id || isAnalystPlus);
  const canApproveOrReject = plan.status === 'awaiting_conclusion' && isAnalystPlus;

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
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Read-only info */}
          <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Informações</h3>
            {plan.name && (
              <p className="text-sm font-semibold text-zinc-900">{plan.name}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veículo" value={plan.vehicleLicensePlate} />
              <Field label="Template" value={plan.templateName} />
              <Field label="Item inspecionado" value={plan.itemTitle} />
              <Field label="Reportado por" value={plan.reportedByName} />
              <Field label="Responsável sugerido" value={plan.responsibleName} />
              <Field label="Data limite" value={plan.dueDate} />
              <Field label="Criado em" value={fmtDate(plan.createdAt)} />
              <Field label="Atribuído por" value={plan.assignedByName} />
            </div>
            {plan.observedIssue && (
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">Observação</p>
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
                  <a href={plan.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    Ampliar
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Execution info (if claimed) */}
          {plan.claimedBy && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Em execução</p>
              <p className="text-sm text-blue-800">
                Assumido por <strong>{plan.claimedByName ?? plan.claimedBy}</strong>
                {plan.claimedAt && ` em ${fmtDate(plan.claimedAt)}`}
              </p>
            </div>
          )}

          {/* Conclusion evidence (if submitted) */}
          {plan.status === 'awaiting_conclusion' && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Conclusão enviada — aguardando aprovação</p>
              {plan.completionNotes && <p className="text-sm text-zinc-700">{plan.completionNotes}</p>}
              {plan.conclusionEvidenceUrl && (
                <div className="flex items-center gap-2">
                  <img src={plan.conclusionEvidenceUrl} alt="evidência" className="h-20 w-20 rounded-lg object-cover" />
                  <a href={plan.conclusionEvidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    Ampliar
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Completion info */}
          {plan.status === 'completed' && plan.completedByName && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-4 space-y-1">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Concluída</p>
              <p className="text-sm text-green-800">
                Aprovada por <strong>{plan.completedByName}</strong>
                {plan.completedAt && ` em ${fmtDate(plan.completedAt)}`}
              </p>
              {plan.completionNotes && <p className="text-sm text-zinc-600 mt-1">{plan.completionNotes}</p>}
            </div>
          )}

          {/* ── Action: Claim ── */}
          {canClaim && (
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assumir ação</h3>
              <p className="text-sm text-zinc-600">Clique para atribuir esta ação ao seu perfil e iniciar a execução.</p>
              <button
                onClick={handleClaim}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Assumir esta ação
              </button>
            </div>
          )}

          {/* ── Action: Submit conclusion ── */}
          {canConclude && (
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Marcar como concluída</h3>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">URL da evidência (foto/link)</label>
                <input
                  type="text"
                  value={evidenceUrl}
                  onChange={e => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
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
              <button
                onClick={handleSubmitConclusion}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Enviar para aprovação
              </button>
            </div>
          )}

          {/* ── Action: Approve / Reject ── */}
          {canApproveOrReject && (
            <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Análise da conclusão</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprovar conclusão
                </button>
                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-300 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Rejeitar / Reabrir
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t bg-zinc-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
