import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { groupPendingMaintenancePayments } from '../../lib/paymentApprovalGroups';
import {
  approveMaintenancePaymentGroup,
  approvePaymentInstallment,
  listPaymentInstallments,
  rejectPaymentInstallment,
} from '../../services/paymentInstallmentService';

import BudgetDocumentPreviewModal from './BudgetDocumentPreviewModal';
import FinancialApprovalConfirmModal from './FinancialApprovalConfirmModal';
import MaintenanceInstallmentsModal from './MaintenanceInstallmentsModal';
import MaintenancePaymentApprovalGroupCard from './MaintenancePaymentApprovalGroupCard';

import type { MaintenancePaymentApprovalGroup } from '../../lib/paymentApprovalGroups';

const CONFLICT_MESSAGE = 'As parcelas desta OS foram alteradas. Nada foi aprovado; revise os dados novamente.';

export default function PaymentApprovalsTab(): React.ReactElement {
  const { currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [processingInstallmentId, setProcessingInstallmentId] = useState<string | null>(null);
  const [confirmingGroup, setConfirmingGroup] = useState<MaintenancePaymentApprovalGroup | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [previewGroup, setPreviewGroup] = useState<MaintenancePaymentApprovalGroup | null>(null);
  const [viewingGroupKey, setViewingGroupKey] = useState<string | null>(null);

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['paymentInstallments', 'approvals', { clientId: currentClient?.id, sourceType: 'maintenance_order' }],
    queryFn: () => listPaymentInstallments({
      clientId: currentClient?.id ?? undefined,
      sourceType: 'maintenance_order',
    }),
  });

  const groups = useMemo(() => groupPendingMaintenancePayments(installments), [installments]);
  const viewingGroup = viewingGroupKey ? (groups.find((g) => g.key === viewingGroupKey) ?? null) : null;

  const reviewMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      setProcessingInstallmentId(id);
      if (approve) await approvePaymentInstallment(id);
      else await rejectPaymentInstallment(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao processar aprovação.';
      window.alert(msg);
    },
    onSettled: () => setProcessingInstallmentId(null),
  });

  const groupMutation = useMutation({
    mutationFn: (group: MaintenancePaymentApprovalGroup) =>
      approveMaintenancePaymentGroup(
        group.maintenanceOrderId,
        group.installments.map((i) => ({ id: i.id, updatedAt: i.updatedAt })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      setConfirmingGroup(null);
      setConfirmError(null);
    },
    onError: async (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Não foi possível aprovar as parcelas. Tente novamente.';
      setConfirmError(msg);
      if (msg === CONFLICT_MESSAGE) {
        await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      }
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-16 text-zinc-400 shadow-sm">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium">Nenhuma parcela pendente de aprovação.</p>
        </div>
      ) : (
        groups.map((group) => (
          <MaintenancePaymentApprovalGroupCard
            key={group.key}
            group={group}
            groupBusy={groupMutation.isPending && groupMutation.variables?.maintenanceOrderId === group.maintenanceOrderId}
            onApproveGroup={(g) => { setConfirmingGroup(g); setConfirmError(null); }}
            onViewBudget={(g) => setPreviewGroup(g)}
            onViewInstallments={(g) => setViewingGroupKey(g.key)}
          />
        ))
      )}

      {confirmingGroup && (
        <FinancialApprovalConfirmModal
          open
          title="Aprovar parcelas"
          entityLabel={`OS ${confirmingGroup.osNumber}`}
          installmentCount={confirmingGroup.installmentCount}
          totalValue={confirmingGroup.totalPending}
          confirmLabel="Confirmar aprovação"
          submitting={groupMutation.isPending}
          error={confirmError}
          onConfirm={() => groupMutation.mutate(confirmingGroup)}
          onClose={() => { if (!groupMutation.isPending) { setConfirmingGroup(null); setConfirmError(null); } }}
        />
      )}

      {previewGroup && (
        <BudgetDocumentPreviewModal
          open
          maintenanceOrderId={previewGroup.maintenanceOrderId}
          osNumber={previewGroup.osNumber}
          pendingInstallmentCount={previewGroup.installmentCount}
          pendingInstallmentTotal={previewGroup.totalPending}
          onClose={() => setPreviewGroup(null)}
        />
      )}

      {viewingGroup && (
        <MaintenanceInstallmentsModal
          open
          group={viewingGroup}
          processingInstallmentId={processingInstallmentId}
          groupBusy={groupMutation.isPending && groupMutation.variables?.maintenanceOrderId === viewingGroup.maintenanceOrderId}
          onApproveInstallment={(id) => reviewMutation.mutate({ id, approve: true })}
          onRejectInstallment={(id) => reviewMutation.mutate({ id, approve: false })}
          onClose={() => setViewingGroupKey(null)}
        />
      )}
    </div>
  );
}
