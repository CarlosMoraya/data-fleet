import { FileText, ListChecks, ThumbsUp } from 'lucide-react';
import React from 'react';

import type { MaintenancePaymentApprovalGroup } from '../../lib/paymentApprovalGroups';

interface MaintenancePaymentApprovalGroupCardProps {
  group: MaintenancePaymentApprovalGroup;
  groupBusy: boolean;
  onApproveGroup: (group: MaintenancePaymentApprovalGroup) => void;
  onViewBudget: (group: MaintenancePaymentApprovalGroup) => void;
  onViewInstallments: (group: MaintenancePaymentApprovalGroup) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MaintenancePaymentApprovalGroupCard({
  group,
  groupBusy,
  onApproveGroup,
  onViewBudget,
  onViewInstallments,
}: MaintenancePaymentApprovalGroupCardProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-zinc-800">{group.osNumber}</span>
          <span className="text-sm text-zinc-500">{group.workshopName}</span>
          {group.workshopCnpj && <span className="text-xs text-zinc-400">· {group.workshopCnpj}</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>Custo aprovado: <strong className="text-zinc-700">{formatCurrency(group.approvedCost)}</strong></span>
          <span>{group.installmentCount} parcela(s) pendente(s)</span>
          <span>Total pendente: <strong className="text-zinc-700">{formatCurrency(group.totalPending)}</strong></span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewBudget(group)}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <FileText className="h-3.5 w-3.5" />
          Ver orçamento
        </button>
        <button
          type="button"
          onClick={() => onViewInstallments(group)}
          className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <ListChecks className="h-3.5 w-3.5" />
          Ver parcelas
        </button>
        {group.installmentCount > 0 && (
          <button
            type="button"
            disabled={groupBusy}
            onClick={() => onApproveGroup(group)}
            className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Aprovar todas
          </button>
        )}
      </div>
    </div>
  );
}
