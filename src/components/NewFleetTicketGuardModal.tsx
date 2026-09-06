import { AlertTriangle, X } from 'lucide-react';
import React, { useEffect, useId, useState } from 'react';

import {
  FLEET_TICKET_CRITICALITY_DESCRIPTIONS,
  FLEET_TICKET_CRITICALITY_ORDER,
  fleetTicketCriticalityLabel,
} from '../lib/fleetTicketRules';

interface NewFleetTicketGuardModalProps {
  open: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

interface GuardDialogShellProps {
  title: string;
  stepLabel: string;
  children: React.ReactNode;
  onCancel: () => void;
  onProceed: () => void;
}

function GuardDialogShell({ title, stepLabel, children, onCancel, onProceed }: GuardDialogShellProps): React.ReactElement {
  const titleId = useId();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs text-zinc-500">{stepLabel}</p>
            <h2 id={titleId} className="text-base font-semibold text-zinc-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="rounded-lg p-1.5 hover:bg-zinc-100"
          >
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-zinc-700">{children}</div>
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            Prosseguir
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewFleetTicketGuardModal({ open, onProceed, onCancel }: NewFleetTicketGuardModalProps): React.ReactElement | null {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  if (step === 1) {
    return (
      <GuardDialogShell
        title="Antes de abrir um chamado"
        stepLabel="Passo 1 de 2"
        onCancel={onCancel}
        onProceed={() => setStep(2)}
      >
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Tem certeza que o problema que você vai relatar já não foi informado por meio de um checklist realizado pelo motorista desse veículo? Muitos chamados abertos para o mesmo problema podem dificultar a gestão, gerando atrasos na resolução do problema do veículo.</span>
        </div>
      </GuardDialogShell>
    );
  }

  return (
    <GuardDialogShell
      title="Guia de classificação"
      stepLabel="Passo 2 de 2"
      onCancel={onCancel}
      onProceed={onProceed}
    >
      <p>Abra o chamado seguindo o guia de classificação abaixo:</p>
      <ul className="space-y-2">
        {FLEET_TICKET_CRITICALITY_ORDER.map((criticality) => (
          <li key={criticality}>
            <strong>{fleetTicketCriticalityLabel(criticality)}</strong>: {FLEET_TICKET_CRITICALITY_DESCRIPTIONS[criticality]}
          </li>
        ))}
      </ul>
    </GuardDialogShell>
  );
}
