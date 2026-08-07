import { X, Loader2, AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { actionPlanToRow } from '../lib/actionPlanMappers';
import { fleetTicketCriticalityLabel } from '../lib/fleetTicketRules';
import { supabase } from '../lib/supabase';

import type { ActionPlanRow } from '../lib/actionPlanMappers';
import type { Checklist } from '../types';
import type { FleetTicket } from '../types/fleetTicket';

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

export type CreateActionPlanOrigin =
  | { kind: 'checklist'; checklist: Checklist }
  | { kind: 'fleetTicket'; ticket: FleetTicket };

interface Props {
  origin: CreateActionPlanOrigin;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateActionPlanModal({ origin, onClose, onCreated }: Props) {
  const { user, currentClient } = useAuth();

  const [issueItems, setIssueItems] = useState<IssueItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [name, setName] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('');
  const [observedIssue, setObservedIssue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (origin.kind === 'fleetTicket') {
      setSuggestedAction(`Tratar chamado ${origin.ticket.ticketNumber ?? ''}: ${origin.ticket.title}`.trim());
      setObservedIssue(origin.ticket.description ?? '');
    }
  }, [origin]);

  useEffect(() => {
    void (async () => {
      setLoadingItems(true);

      const checklistId = origin.kind === 'checklist' ? origin.checklist.id : undefined;

      const respPromise: Promise<{ data: Record<string, unknown>[] | null }> = checklistId
        ? Promise.resolve(
            supabase
              .from('checklist_responses')
              .select('id, item_id, observation, photo_url, checklist_items(title, default_action)')
              .eq('checklist_id', checklistId)
              .eq('status', 'issue'),
          )
        : Promise.resolve({ data: null });

      const [{ data: respData }, { data: profileData }] = await Promise.all([
        respPromise,
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
  }, [origin, currentClient.id]);

  const buildChecklistActionPlanPayloads = (checklist: Checklist): Partial<ActionPlanRow>[] =>
    issueItems.map(it =>
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

  const buildFleetTicketActionPlanPayload = (ticket: FleetTicket): Partial<ActionPlanRow> =>
    actionPlanToRow({
      clientId: currentClient.id,
      fleetTicketId: ticket.id,
      vehicleId: ticket.vehicleId,
      reportedBy: ticket.openedBy,
      suggestedAction,
      observedIssue,
      photoUrl: ticket.attachmentPaths[0],
      status: 'pending',
      name: name.trim(),
      responsibleId,
      dueDate,
      assignedBy: user?.id,
    });

  const handleCreate = async () => {
    if (!name.trim()) { setError('Informe o nome da ação.'); return; }
    if (!responsibleId) { setError('Selecione um responsável.'); return; }
    if (!dueDate) { setError('Informe a data limite.'); return; }
    if (origin.kind === 'checklist' && issueItems.length === 0) {
      setError('Nenhum item não conforme encontrado.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const payload = origin.kind === 'checklist'
        ? buildChecklistActionPlanPayloads(origin.checklist)
        : buildFleetTicketActionPlanPayload(origin.ticket);

      const { error: insErr } = await supabase.from('action_plans').insert(payload);
      if (insErr) throw insErr;
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erro ao criar planos de ação';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const subtitle = origin.kind === 'checklist'
    ? `${origin.checklist.templateName} — ${origin.checklist.vehicleLicensePlate ?? 'sem veículo'}`
    : `Chamado ${origin.ticket.ticketNumber ?? '—'} — ${origin.ticket.vehicleLicensePlateSnapshot}`;

  const createDisabled = saving || loadingItems || (origin.kind === 'checklist' && issueItems.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Criar Plano de Ação</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {origin.kind === 'checklist' ? (
            /* Non-conforming items */
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
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
                    <li key={it.responseId} className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">{it.itemTitle}</p>
                        {it.observation && <p className="truncate text-xs text-zinc-500">{it.observation}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* Inherited ticket data */
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Dados herdados do chamado
              </h3>
              <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-900">{origin.ticket.title}</p>
                <p className="text-xs text-zinc-500">Criticidade: {fleetTicketCriticalityLabel(origin.ticket.criticality)}</p>
                <p className="text-xs text-zinc-500">Aberto por: {origin.ticket.openedByNameSnapshot}</p>
                <p className="text-xs text-zinc-500">
                  Data de abertura: {new Date(origin.ticket.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Nome da ação <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Revisão de freios — Frota pesada"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>

            {origin.kind === 'fleetTicket' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Ação sugerida <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={suggestedAction}
                    onChange={e => setSuggestedAction(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Problema observado
                  </label>
                  <textarea
                    value={observedIssue}
                    onChange={e => setObservedIssue(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Responsável <span className="text-red-500">*</span>
              </label>
              <select
                value={responsibleId}
                onChange={e => setResponsibleId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                <option value="">— Selecione —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Data limite <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            onClick={() => { void handleCreate(); }}
            disabled={createDisabled}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {origin.kind === 'checklist'
              ? `Criar ${issueItems.length > 1 ? `${issueItems.length} planos` : 'plano'}`
              : 'Criar plano'}
          </button>
        </div>
      </div>
    </div>
  );
}
