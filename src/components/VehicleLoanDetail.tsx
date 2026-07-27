import { X } from 'lucide-react';
import React from 'react';

import { getVehicleLoanStatusTag, getVehicleLoanEndedReasonLabel } from '../lib/vehicleLoanStatus';
import type { VehicleLoan } from '../types/vehicleLoan';

interface Props {
  loan: VehicleLoan;
  onClose: () => void;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-800">{value ?? '—'}</p>
    </div>
  );
}

export default function VehicleLoanDetail({ loan, onClose }: Props) {
  const tag = getVehicleLoanStatusTag(loan);
  // Nomes resolvidos via RPC SECURITY DEFINER (create_vehicle_loan /
  // get_vehicle_loans_by_vehicle). Faz fallback ao ID quando a RLS de
  // profiles bloqueia o caller (ex.: Yard Auditor) — caso nunca deveria
  // acontecer com a RPC, mas mantemos o resgate defensivo.
  const createdByDisplay = loan.createdByName ?? loan.createdBy ?? '—';
  const endedByDisplay = loan.endedByName ?? loan.endedBy ?? '—';
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Detalhes do empréstimo</h2>
            <span className={tag.className}>{tag.icon} {tag.label}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-6">
          <div className="space-y-3">
            <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Linha do tempo</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Início" value={fmt(loan.startedAt)} />
              <Field label="Fim" value={fmt(loan.endedAt)} />
              <Field label="Motivo da finalização" value={getVehicleLoanEndedReasonLabel(loan.endedReason)} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Envolvidos</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Motorista temporário" value={loan.driverName} />
              <Field label="Criado por" value={createdByDisplay} />
              <Field label="Finalizado por" value={endedByDisplay} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Checklists associados</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Checklist de Entrega" value={loan.deliveryChecklistAt ? fmt(loan.deliveryChecklistAt) : '—'} />
              <Field label="Checklist de Devolução" value={loan.returnChecklistAt ? fmt(loan.returnChecklistAt) : '—'} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Justificativa</h3>
            <p className="text-sm text-zinc-700">{loan.notes ?? '—'}</p>
            {loan.endedNotes && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{loan.endedNotes}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}