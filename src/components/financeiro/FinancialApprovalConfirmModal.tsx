import { AlertTriangle, Loader2, X } from 'lucide-react';
import React, { useEffect, useId } from 'react';

interface FinancialApprovalConfirmModalProps {
  open: boolean;
  title: string;
  entityLabel: string;
  installmentCount: number;
  totalValue: number;
  confirmLabel: string;
  submitting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FinancialApprovalConfirmModal({
  open,
  title,
  entityLabel,
  installmentCount,
  totalValue,
  confirmLabel,
  submitting,
  error,
  onConfirm,
  onClose,
}: FinancialApprovalConfirmModalProps): React.ReactElement | null {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => { if (!submitting) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 id={titleId} className="text-base font-semibold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 hover:bg-zinc-100 disabled:opacity-50"
          >
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-zinc-700">
          <p>
            Confirma a aprovação de <strong>{entityLabel}</strong>?
          </p>
          <p>
            {installmentCount} parcela(s) — total de{' '}
            <strong className="text-zinc-900">{formatCurrency(totalValue)}</strong>.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-zinc-600 transition-colors hover:text-zinc-900 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
