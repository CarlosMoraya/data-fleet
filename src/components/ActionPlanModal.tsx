import { X, Camera, Loader2, CheckCircle, UserCheck, XCircle, Paperclip, FileText, UploadCloud } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { actionPlanToRow, actionStatusLabel, actionStatusColor } from '../lib/actionPlanMappers';
import { uploadActionPlanEvidence } from '../lib/storageHelpers';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

import type { ActionPlan } from '../types';


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
  'Supervisor': 5,
  'Coordinator': 6,
  'Manager': 7,
  'Director': 8,
  'Admin Master': 9,
};

export default function ActionPlanModal({ plan, onClose, onSaved }: Props) {
  const { user, currentClient } = useAuth();
  const rank = ROLE_RANK[user?.role ?? ''] ?? 0;
  const isAnalystPlus = rank >= 4;
  const isAssistantPlus = rank >= 3;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [notes, setNotes] = useState(plan.completionNotes ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setEvidenceFile(file);
    if (file.type.startsWith('image/')) {
      setEvidencePreview(URL.createObjectURL(file));
    } else {
      setEvidencePreview(null);
    }
  };

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

  const handleSubmitConclusion = async () => {
    setSaving(true);
    setError('');
    try {
      let uploadedUrl: string | undefined = plan.conclusionEvidenceUrl;
      if (evidenceFile) {
        setUploading(true);
        uploadedUrl = await uploadActionPlanEvidence(currentClient.id, plan.id, evidenceFile);
        setUploading(false);
      }
      await update({
        status: 'awaiting_conclusion',
        conclusionEvidenceUrl: uploadedUrl || undefined,
        completionNotes: notes.trim() || undefined,
      });
    } catch (err: unknown) {
      setUploading(false);
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Erro ao enviar evidência');
    }
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
        <p className="text-xs tracking-wide text-zinc-400 uppercase">{label}</p>
        <p className="mt-0.5 text-sm text-zinc-800">{value}</p>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Plano de Ação</h2>
            <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium', actionStatusColor(plan.status))}>
              {actionStatusLabel(plan.status)}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Read-only info */}
          <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Informações</h3>
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
                <p className="text-xs tracking-wide text-zinc-400 uppercase">Observação</p>
                <p className="mt-0.5 text-sm text-zinc-700 italic">"{plan.observedIssue}"</p>
              </div>
            )}
            <div>
              <p className="text-xs tracking-wide text-zinc-400 uppercase">Ação sugerida</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-800">{plan.suggestedAction}</p>
            </div>
            {plan.photoUrl && (
              <div>
                <p className="mb-1 text-xs tracking-wide text-zinc-400 uppercase">Foto do problema</p>
                <div className="flex items-center gap-2">
                  <img src={plan.photoUrl} alt="foto" className="h-20 w-20 rounded-lg object-cover" />
                  <a href={plan.photoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-orange-500 hover:underline">
                    <Camera className="h-3 w-3" />
                    Ampliar
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Execution info (if claimed) */}
          {plan.claimedBy && (
            <div className="space-y-1 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">Em execução</p>
              <p className="text-sm text-blue-800">
                Assumido por <strong>{plan.claimedByName ?? plan.claimedBy}</strong>
                {plan.claimedAt && ` em ${fmtDate(plan.claimedAt)}`}
              </p>
            </div>
          )}

          {/* Conclusion evidence (if submitted) */}
          {plan.status === 'awaiting_conclusion' && (
            <div className="space-y-2 rounded-xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-semibold tracking-wider text-orange-600 uppercase">Conclusão enviada — aguardando aprovação</p>
              {plan.completionNotes && <p className="text-sm text-zinc-700">{plan.completionNotes}</p>}
              {plan.conclusionEvidenceUrl && (
                plan.conclusionEvidenceUrl.toLowerCase().includes('.pdf') ? (
                  <a
                    href={plan.conclusionEvidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-orange-600 hover:bg-orange-50"
                  >
                    <Paperclip className="h-4 w-4" />
                    Visualizar evidência (PDF)
                  </a>
                ) : (
                  <div className="flex items-center gap-2">
                    <img src={plan.conclusionEvidenceUrl} alt="evidência" className="h-20 w-20 rounded-lg object-cover" />
                    <a href={plan.conclusionEvidenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-orange-500 hover:underline">
                      <Camera className="h-3 w-3" />
                      Ampliar
                    </a>
                  </div>
                )
              )}
            </div>
          )}

          {/* Completion info */}
          {plan.status === 'completed' && plan.completedByName && (
            <div className="space-y-1 rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-xs font-semibold tracking-wider text-green-600 uppercase">Concluída</p>
              <p className="text-sm text-green-800">
                Aprovada por <strong>{plan.completedByName}</strong>
                {plan.completedAt && ` em ${fmtDate(plan.completedAt)}`}
              </p>
              {plan.completionNotes && <p className="mt-1 text-sm text-zinc-600">{plan.completionNotes}</p>}
            </div>
          )}

          {/* ── Action: Claim ── */}
          {canClaim && (
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Assumir ação</h3>
              <p className="text-sm text-zinc-600">Clique para atribuir esta ação ao seu perfil e iniciar a execução.</p>
              <button
                onClick={handleClaim}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Assumir esta ação
              </button>
            </div>
          )}

          {/* ── Action: Submit conclusion ── */}
          {canConclude && (
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Marcar como concluída</h3>

              {/* Evidence file upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Evidência <span className="font-normal text-zinc-400">(opcional — foto, PDF, NF)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!evidenceFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-orange-400 hover:text-orange-500"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Selecionar arquivo (imagem ou PDF, máx. 10MB)
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    {evidencePreview ? (
                      <img src={evidencePreview} alt="preview" className="h-12 w-12 flex-shrink-0 rounded object-cover" />
                    ) : (
                      <FileText className="h-8 w-8 flex-shrink-0 text-orange-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">{evidenceFile.name}</p>
                      <p className="text-xs text-zinc-400">{(evidenceFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEvidenceFile(null); setEvidencePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Notas de conclusão</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Descreva o que foi feito..."
                  className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSubmitConclusion}
                disabled={saving || uploading}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {(saving || uploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {uploading ? 'Enviando arquivo...' : 'Enviar para aprovação'}
              </button>
            </div>
          )}

          {/* ── Action: Approve / Reject ── */}
          {canApproveOrReject && (
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Análise da conclusão</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprovar conclusão
                </button>
                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Rejeitar / Reabrir
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
