import { X, CalendarClock, MapPin, ExternalLink } from 'lucide-react';
import React from 'react';

import { isScheduleActionAvailable, type ScheduleActionKey } from '../lib/workshopScheduleActions';
import { formatScheduleDate, SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_BADGE_CLASS } from '../lib/workshopScheduleDisplay';
import { formatWorkshopAddress, buildGoogleMapsUrl } from '../lib/workshopScheduleMappers';

import type { WorkshopSchedule } from '../types';

export interface ScheduleDetailActions {
  canWriteSchedules: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onGenerateMaintenance: () => void;
}

interface Props {
  schedule: WorkshopSchedule;
  onClose: () => void;
  actions?: ScheduleDetailActions;
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value || '—'}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
      {title}
    </h3>
  );
}

export default function ScheduleDetailModal({ schedule, onClose, actions }: Props) {
  const address = formatWorkshopAddress(schedule);
  const hasAddress = address.trim().length > 0;
  const mapsUrl = buildGoogleMapsUrl(schedule);
  const can = (action: ScheduleActionKey): boolean =>
    actions != null &&
    isScheduleActionAvailable(action, schedule.status, {
      canWriteSchedules: actions.canWriteSchedules,
      canDelete: actions.canDelete,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <CalendarClock className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900">Detalhes do Agendamento</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 transition-colors hover:bg-zinc-100"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Agendamento */}
          <div>
            <SectionTitle title="Agendamento" />
            <div className="mt-3 grid grid-cols-2 gap-4">
              <DetailField label="Veículo (Placa)" value={schedule.vehicleLicensePlate} />
              <DetailField label="Data do Agendamento" value={formatScheduleDate(schedule.scheduledDate)} />
              <div>
                <p className="text-xs text-zinc-400">Status</p>
                <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SCHEDULE_STATUS_BADGE_CLASS[schedule.status]}`}>
                  {SCHEDULE_STATUS_LABELS[schedule.status]}
                </span>
              </div>
              <DetailField label="Criado por" value={schedule.createdByName} />
              {schedule.completedAt && (
                <DetailField label="Concluído em" value={formatScheduleDate(schedule.completedAt.split('T')[0])} />
              )}
            </div>
          </div>

          {/* Oficina */}
          <div>
            <SectionTitle title="Oficina" />
            <div className="mt-3 space-y-3">
              <DetailField label="Nome" value={schedule.workshopName} />
              <div>
                <p className="text-xs text-zinc-400">Endereço</p>
                {hasAddress ? (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />
                    <p className="text-sm font-medium whitespace-pre-line text-zinc-800">{address}</p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">Endereço não cadastrado</p>
                )}
              </div>
              {hasAddress && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-orange-600 underline underline-offset-2 hover:text-orange-700"
                >
                  Abrir no Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Observações do Agendamento */}
          <div>
            <SectionTitle title="Observações do Agendamento" />
            {schedule.notes ? (
              <p className="mt-3 text-sm whitespace-pre-line text-zinc-800">{schedule.notes}</p>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">Nenhuma observação registrada.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 flex-col-reverse gap-2 border-t border-zinc-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between tall:py-4">
          <div className="flex flex-wrap items-center gap-2">
            {actions && can('cancel') && (
              <button
                type="button"
                onClick={actions.onCancel}
                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                Cancelar agendamento
              </button>
            )}
            {actions && can('delete') && (
              <button
                type="button"
                onClick={actions.onDelete}
                className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Excluir
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Fechar
            </button>
            {actions && can('edit') && (
              <button
                type="button"
                onClick={actions.onEdit}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Editar
              </button>
            )}
            {actions && can('generateMaintenance') && (
              <button
                type="button"
                onClick={actions.onGenerateMaintenance}
                className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
              >
                Gerar OS
              </button>
            )}
            {actions && can('complete') && (
              <button
                type="button"
                onClick={actions.onComplete}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
