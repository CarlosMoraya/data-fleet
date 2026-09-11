import { X } from 'lucide-react';
import React, { useState } from 'react';

import {
  CANCELLATION_IRREVERSIBLE_WARNING,
  CANCELLATION_REASON_MAX_LENGTH,
  normalizeCancellationReason,
} from '../../lib/paymentCancellation';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface CancelPaymentModalProps {
  open: boolean;
  title: string;
  entityLabel: string;
  amount: number;
  submitting: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function CancelPaymentModal(props: CancelPaymentModalProps): React.ReactElement | null {
  const { open, title, entityLabel, amount, submitting, error, onConfirm, onClose } = props;
  const [reason, setReason] = useState('');
  const normalized = normalizeCancellationReason(reason);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-payment-title" className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 id="cancel-payment-title" className="text-sm font-semibold text-zinc-900">{title}</h3>
          <button type="button" aria-label="Fechar" disabled={submitting} onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-zinc-700">{entityLabel} · {formatCurrency(amount)}</p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{CANCELLATION_IRREVERSIBLE_WARNING}</p>
          <label htmlFor="cancel-payment-reason" className="block text-sm font-medium text-zinc-700">
            Motivo do cancelamento <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cancel-payment-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={CANCELLATION_REASON_MAX_LENGTH}
            placeholder="Descreva por que este pagamento está sendo cancelado"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-5 py-4">
          <button type="button" disabled={submitting} onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Voltar
          </button>
          <button
            type="button"
            disabled={submitting || normalized === null}
            onClick={() => { if (normalized) onConfirm(normalized); }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Cancelando…' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
