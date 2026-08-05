import { ThumbsDown, ThumbsUp, X } from 'lucide-react';
import React, { useEffect, useId } from 'react';

import type { MaintenancePaymentApprovalGroup } from '../../lib/paymentApprovalGroups';

interface MaintenanceInstallmentsModalProps {
  open: boolean;
  group: MaintenancePaymentApprovalGroup;
  processingInstallmentId: string | null;
  groupBusy: boolean;
  onApproveInstallment: (id: string) => void;
  onRejectInstallment: (id: string) => void;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function MaintenanceInstallmentsModal({
  open,
  group,
  processingInstallmentId,
  groupBusy,
  onApproveInstallment,
  onRejectInstallment,
  onClose,
}: MaintenanceInstallmentsModalProps): React.ReactElement | null {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-zinc-900">
              Parcelas — OS {group.osNumber}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {group.installmentCount} parcela(s) pendente(s) — {formatCurrency(group.totalPending)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="border-b border-zinc-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Parc.</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Vencimento</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Forma</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {group.installments.map((installment) => {
                const disabled = groupBusy || processingInstallmentId === installment.id;
                return (
                  <tr key={installment.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 text-zinc-500">{installment.installmentNumber}/{installment.installmentsTotal}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-800">{formatCurrency(installment.value)}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{formatDate(installment.dueDate)}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{installment.paymentMethod === 'pix' ? 'Pix' : 'Boleto'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onApproveInstallment(installment.id)}
                          className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onRejectInstallment(installment.id)}
                          className="flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                          Reprovar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
