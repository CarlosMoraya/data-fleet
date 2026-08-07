import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, ExternalLink, Loader2, MapPin, Paperclip, UserCheck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { actionStatusColor, actionStatusLabel } from '../lib/actionPlanMappers';
import { fleetTicketActionPlanLabel } from '../lib/fleetTicketActionPlanLink';
import {
  FLEET_TICKET_CRITICALITY_DESCRIPTIONS,
  canCreateActionPlanFromFleetTicket,
  canEditFleetTicketCriticality,
  canHandleFleetTicket,
  fleetTicketCriticalityColor,
  fleetTicketCriticalityLabel,
  fleetTicketSosTypeLabel,
  fleetTicketStatusColor,
  fleetTicketStatusLabel,
  isFleetTicketReadOnly,
  requiresAssigneeToSetStatus,
} from '../lib/fleetTicketRules';
import { cn } from '../lib/utils';
import {
  assignFleetTicketToSelf,
  classifyFleetTicket,
  getFleetTicketAttachmentUrls,
  listFleetTicketEvents,
  updateFleetTicketStatus,
} from '../services/fleetTicketService';
import { getVehicleLastKmMap } from '../services/vehicleOdometerService';
import { getVehicleOpenTreatment } from '../services/vehicleOpenTreatmentService';

import CreateActionPlanModal from './CreateActionPlanModal';
import LastKmLabel from './LastKmLabel';

import type { FleetTicket, FleetTicketCriticality, FleetTicketEvent, FleetTicketStatus } from '../types/fleetTicket';

interface FleetTicketModalProps {
  ticket: FleetTicket;
  onClose: () => void;
  onSaved: () => void;
}

const STATUSES: FleetTicketStatus[] = ['in_analysis', 'in_progress', 'resolved', 'closed', 'cancelled'];

const EVENT_LABELS: Record<string, string> = {
  created: 'Chamado criado',
  attachments_added: 'Anexos adicionados',
  classified: 'Criticidade classificada',
  assigned: 'Atendimento assumido',
  status_changed: 'Status alterado',
  telegram_sent: 'Telegram enviado',
  telegram_failed: 'Falha no Telegram',
};

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function eventLabel(event: FleetTicketEvent): string {
  if (event.eventType === 'status_changed') {
    const to = event.payload.to;
    if (typeof to === 'string') {
      return `Status alterado para ${fleetTicketStatusLabel(to as FleetTicketStatus)}`;
    }
  }
  return EVENT_LABELS[event.eventType] ?? event.eventType;
}

export default function FleetTicketModal({ ticket, onClose, onSaved }: FleetTicketModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [criticality, setCriticality] = useState<FleetTicketCriticality | ''>(ticket.criticality ?? '');
  const [status, setStatus] = useState<FleetTicketStatus>(ticket.status);
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolutionNotes ?? '');
  const [actionError, setActionError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionPlanOpen, setActionPlanOpen] = useState(false);

  const eventsQuery = useQuery({
    queryKey: ['fleetTicketEvents', ticket.id],
    queryFn: () => listFleetTicketEvents(ticket.id),
  });
  const attachmentUrlsQuery = useQuery({
    queryKey: ['fleetTicketAttachmentUrls', ticket.id, ticket.attachmentPaths],
    queryFn: () => getFleetTicketAttachmentUrls(ticket.attachmentPaths),
    enabled: ticket.attachmentPaths.length > 0,
  });
  const lastKmQuery = useQuery({
    queryKey: ['vehicleLastKmMap', ticket.vehicleId],
    queryFn: () => getVehicleLastKmMap([ticket.vehicleId]),
  });
  const openTreatmentQuery = useQuery({
    queryKey: ['vehicleOpenTreatment', ticket.vehicleId],
    queryFn: () => getVehicleOpenTreatment(ticket.vehicleId),
  });

  useEffect(() => {
    setCriticality(ticket.criticality ?? '');
    setStatus(ticket.status);
    setResolutionNotes(ticket.resolutionNotes ?? '');
    setActionError(null);
    setWarning(null);
  }, [ticket]);

  const canEditCriticality = canEditFleetTicketCriticality(user?.role) && ticket.source === 'report' && !isFleetTicketReadOnly(ticket.status);
  const canHandle = canHandleFleetTicket(user?.role) && !isFleetTicketReadOnly(ticket.status);
  const canOpenActionPlan = canCreateActionPlanFromFleetTicket(user?.role, ticket);
  const lastKmInfo = lastKmQuery.data?.get(ticket.vehicleId) ?? null;
  const blockedByMissingAssignee = requiresAssigneeToSetStatus(status) && !ticket.assignedTo;
  const openTreatment = openTreatmentQuery.data;
  const hasOpenTreatment = !!openTreatment && (openTreatment.actionPlans.length > 0 || openTreatment.schedules.length > 0);
  const hasPlan = !!openTreatment?.ticketPlanIds.includes(ticket.id);
  const planLabel = fleetTicketActionPlanLabel(ticket.status, hasPlan);

  const runAction = async (action: () => Promise<{ telegramWarning?: string } | void>) => {
    setSaving(true);
    setActionError(null);
    setWarning(null);
    try {
      const result = await action();
      if (result && 'telegramWarning' in result && result.telegramWarning) setWarning('A ação foi concluída, mas a notificação Telegram falhou.');
      await queryClient.invalidateQueries({ queryKey: ['fleetTicketEvents', ticket.id] });
      onSaved();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível salvar o chamado.');
    } finally {
      setSaving(false);
    }
  };

  const handleClassify = () => {
    if (!criticality) {
      setActionError('Selecione uma criticidade.');
      return;
    }
    void runAction(() => classifyFleetTicket(ticket.id, criticality));
  };

  const handleStatus = () => {
    if (blockedByMissingAssignee) {
      setActionError('Assuma o atendimento antes de alterar o status deste chamado.');
      return;
    }
    if (status === 'resolved' && resolutionNotes.trim().length < 5) {
      setActionError('Informe notas de resolução com pelo menos 5 caracteres.');
      return;
    }
    void runAction(() => updateFleetTicketStatus(ticket.id, status, resolutionNotes));
  };

  const mapUrl = ticket.latitude != null && ticket.longitude != null
    ? `https://maps.google.com/?q=${ticket.latitude},${ticket.longitude}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900">{ticket.title}</h2>
              {ticket.source === 'sos' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">S.O.S.</span>}
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', fleetTicketCriticalityColor(ticket.criticality))}>{fleetTicketCriticalityLabel(ticket.criticality)}</span>
              {planLabel && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">{planLabel}</span>}
              <span className="text-xs text-zinc-500">{ticket.ticketNumber ? `Chamado ${ticket.ticketNumber}` : '—'}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Criado em {formatDate(ticket.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100" aria-label="Fechar">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {actionError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
          {warning && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{warning}</div>}

          <div className="grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-2">
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Veículo</p><p className="mt-0.5 text-sm font-semibold text-zinc-900">{ticket.vehicleLicensePlateSnapshot}</p></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Status</p><span className={cn('mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium', fleetTicketStatusColor(ticket.status))}>{fleetTicketStatusLabel(ticket.status)}</span></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Aberto por</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.openedByNameSnapshot}</p></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Responsável</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.assignedToNameSnapshot ?? '—'}</p></div>
            {ticket.driverNameSnapshot && <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Motorista</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.driverNameSnapshot}</p></div>}
            {ticket.source === 'sos' && ticket.sosType && <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Tipo de emergência</p><p className="mt-0.5 text-sm text-zinc-800">{fleetTicketSosTypeLabel(ticket.sosType)}</p></div>}
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Km informado</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.odometerKm != null ? `${ticket.odometerKm.toLocaleString('pt-BR')} km` : '—'}</p></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Último Km oficial</p><LastKmLabel info={lastKmInfo} className="mt-0.5 text-sm text-zinc-800" /></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Modelo</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.vehicleModelSnapshot ?? '—'}</p></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Proprietário</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.vehicleOwnerSnapshot ?? '—'}</p></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Embarcador</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.shipperNameSnapshot ?? '—'}</p></div>
            <div><p className="text-xs tracking-wide text-zinc-400 uppercase">Base</p><p className="mt-0.5 text-sm text-zinc-800">{ticket.operationalUnitNameSnapshot ?? '—'}</p></div>
          </div>

          {hasOpenTreatment && openTreatment && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Este veículo já está em tratamento
              </div>
              {openTreatment.actionPlans.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {openTreatment.actionPlans.map((plan) => (
                    <li key={plan.id} className="text-sm text-amber-900">
                      <span className="font-medium">{plan.name || plan.suggestedAction}</span>{' '}
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', actionStatusColor(plan.status))}>{actionStatusLabel(plan.status)}</span>
                      {' '}— {plan.responsibleName ?? 'sem responsável'} · prazo {formatDate(plan.dueDate)}
                    </li>
                  ))}
                </ul>
              )}
              {openTreatment.schedules.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {openTreatment.schedules.map((schedule) => (
                    <li key={schedule.id} className="text-sm text-amber-900">
                      Agendamento em {new Date(schedule.scheduledDate).toLocaleDateString('pt-BR')} — {schedule.workshopName ?? 'oficina não informada'}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-amber-700">Aviso informativo — você pode seguir com este chamado normalmente.</p>
            </div>
          )}

          {ticket.description && <div><h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Descrição</h3><p className="mt-1 text-sm whitespace-pre-wrap text-zinc-800">{ticket.description}</p></div>}

          {ticket.resolutionNotes && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <h3 className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">Notas de Resolução</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap text-emerald-900">{ticket.resolutionNotes}</p>
              <p className="mt-1.5 text-xs text-emerald-700">{ticket.resolvedByNameSnapshot ?? 'Sistema'} · {formatDate(ticket.resolvedAt)}</p>
            </div>
          )}

          {(mapUrl || ticket.locationText) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-900"><MapPin className="h-4 w-4" /> Localização</div>
              {ticket.locationText && <p className="mt-1 text-sm text-blue-800">{ticket.locationText}</p>}
              {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">Abrir no mapa <ExternalLink className="h-3 w-3" /></a>}
            </div>
          )}

          {ticket.attachmentPaths.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase"><Paperclip className="h-4 w-4" /> Anexos</h3>
              <ul className="mt-2 space-y-2">
                {ticket.attachmentPaths.map((path) => (
                  <li key={path} className="text-sm">
                    {attachmentUrlsQuery.data?.[path] ? <a href={attachmentUrlsQuery.data[path]} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline">Abrir anexo</a> : <span className="text-zinc-500">{path.split('/').pop()}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canEditCriticality && (
            <div className="rounded-xl border border-zinc-200 p-4">
              <label htmlFor="ticket-criticality" className="mb-2 block text-sm font-medium text-zinc-800">Alterar criticidade</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select id="ticket-criticality" value={criticality} onChange={(event) => setCriticality(event.target.value as FleetTicketCriticality | '')} disabled={saving} className="flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none">
                  <option value="">Selecione...</option>
                  <option value="critical">Crítico</option><option value="high">Alto</option><option value="medium">Médio</option><option value="low">Baixo</option>
                </select>
                <button type="button" onClick={handleClassify} disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">Classificar</button>
              </div>
              {criticality && <p className="mt-1.5 text-xs text-zinc-500">{FLEET_TICKET_CRITICALITY_DESCRIPTIONS[criticality]}</p>}
            </div>
          )}

          {canHandle && (
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { void runAction(() => assignFleetTicketToSelf(ticket.id)); }} disabled={saving || ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'cancelled'} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Assumir atendimento
                </button>
                {canOpenActionPlan && (
                  <button type="button" onClick={() => setActionPlanOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                    <ClipboardList className="h-4 w-4" />
                    Abrir plano de ação
                  </button>
                )}
              </div>
              <div className="border-t border-zinc-100 pt-3">
                <label htmlFor="ticket-status" className="mb-2 block text-sm font-medium text-zinc-800">Alterar status</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select id="ticket-status" value={status} onChange={(event) => setStatus(event.target.value as FleetTicketStatus)} disabled={saving} className="flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none">
                    {STATUSES.map((item) => <option key={item} value={item}>{fleetTicketStatusLabel(item)}</option>)}
                  </select>
                  <button type="button" onClick={handleStatus} disabled={saving || blockedByMissingAssignee} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">Salvar status</button>
                </div>
                {status === 'resolved' && <textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} placeholder="Notas de resolução (mínimo 5 caracteres)" rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none" />}
                {blockedByMissingAssignee && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Assuma o atendimento antes de alterar o status deste chamado.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Histórico</h3>
            {eventsQuery.isLoading ? <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...</div> : (
              <ol className="mt-2 space-y-2 border-l border-zinc-200 pl-4">
                {(eventsQuery.data ?? []).map((event) => <li key={event.id} className="text-sm"><p className="font-medium text-zinc-800">{eventLabel(event)}</p><p className="text-xs text-zinc-400">{event.actorNameSnapshot ?? 'Sistema'} · {formatDate(event.createdAt)}</p></li>)}
              </ol>
            )}
          </div>
        </div>
      </div>

      {actionPlanOpen && (
        <CreateActionPlanModal
          origin={{ kind: 'fleetTicket', ticket }}
          onClose={() => setActionPlanOpen(false)}
          onCreated={() => {
            setActionPlanOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['actionPlans'] });
            void queryClient.invalidateQueries({ queryKey: ['vehicleOpenTreatment', ticket.vehicleId] });
            onSaved();
          }}
        />
      )}
    </div>
  );
}
