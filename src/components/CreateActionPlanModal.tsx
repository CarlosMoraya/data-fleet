import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { actionPlanToRow } from '../lib/actionPlanMappers';
import type { Checklist } from '../types';

interface IssueItem {
  responseId: string;
  itemId: string;
  itemTitle: string;
  observation: string;
  photoUrl?: string;
  defaultAction?: string;
}

interface ProfileOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  checklist: Checklist;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateActionPlanModal({ checklist, onClose, onCreated }: Props) {
  const { user, currentClient } = useAuth();

  const [issueItems, setIssueItems] = useState<IssueItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [name, setName] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoadingItems(true);

      const [{ data: respData }, { data: profileData }] = await Promise.all([
        supabase
          .from('checklist_responses')
          .select('id, item_id, observation, photo_url, checklist_items(title, default_action)')
          .eq('checklist_id', checklist.id)
          .eq('status', 'issue'),
        supabase
          .from('profiles')
          .select('id, name, role')
          .eq('client_id', currentClient.id)
          .not('role', 'in', '("Driver","Yard Auditor")')
          .order('name'),
      ]);

      setIssueItems(
        (respData ?? []).map((r: Record<string, unknown>) => {
          const item = r.checklist_items as Record<string, unknown> | null;
          return {
            responseId: r.id as string,
            itemId: r.item_id as string,
            itemTitle: (item?.title as string) ?? '—',
            observation: (r.observation as string) ?? '',
            photoUrl: (r.photo_url as string) ?? undefined,
            defaultAction: (item?.default_action as string) ?? undefined,
          };
        }),
      );

      setProfiles((profileData ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        role: p.role as string,
      })));

      setLoadingItems(false);
    })();
  }, [checklist.id, currentClient.id]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Informe o nome da ação.'); return; }
    if (!responsibleId) { setError('Selecione um responsável.'); return; }
    if (!dueDate) { setError('Informe a data limite.'); return; }
    if (issueItems.length === 0) { setError('Nenhum item não conforme encontrado.'); return; }

    setError('');
    setSaving(true);
    try {
      const payloads = issueItems.map(it =>
        actionPlanToRow({
          clientId: currentClient.id,
          checklistId: checklist.id,
          checklistResponseId: it.responseId,
          vehicleId: checklist.vehicleId,
          reportedBy: checklist.filledBy,
          suggestedAction: it.defaultAction || `Verificar e corrigir: ${it.itemTitle}`,
          observedIssue: it.observation || undefined,
          photoUrl: it.photoUrl,
          status: 'pending',
          name: name.trim(),
          responsibleId,
          dueDate,
          assignedBy: user?.id,
        }),
      );

      const { error: insErr } = await supabase.from('action_plans').insert(payloads);
      if (insErr) throw insErr;
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar planos de ação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Criar Plano de Ação</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {checklist.templateName} — {checklist.vehicleLicensePlate ?? 'sem veículo'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Non-conforming items */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Itens não conformes ({issueItems.length})
            </h3>
            {loadingItems ? (
              <div className="flex items-center gap-2 py-3 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando itens...</span>
              </div>
            ) : issueItems.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">Nenhum item com problema encontrado.</p>
            ) : (
              <ul className="space-y-1.5">
                {issueItems.map(it => (
                  <li key={it.responseId} className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{it.itemTitle}</p>
                      {it.observation && <p className="text-xs text-zinc-500 truncate">{it.observation}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Nome da ação <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Revisão de freios — Frota pesada"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Responsável <span className="text-red-500">*</span>
              </label>
              <select
                value={responsibleId}
                onChange={e => setResponsibleId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">— Selecione —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Data limite <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-zinc-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || loadingItems || issueItems.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar {issueItems.length > 1 ? `${issueItems.length} planos` : 'plano'}
          </button>
        </div>
      </div>
    </div>
  );
}
