import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Eye, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { listExtraPaymentInstallments } from '../../services/paymentInstallmentService';
import {
  approveExtraPaymentRequestGroup,
  listExtraPaymentRequests,
  rejectExtraPaymentRequest,
} from '../../services/serviceExpenseService';

import ExtraPaymentViewModal from './ExtraPaymentViewModal';
import FinancialApprovalConfirmModal from './FinancialApprovalConfirmModal';

import type { PaymentInstallment } from '../../types/payment';
import type { ExtraPaymentCategory, ExtraPaymentRequest } from '../../types/serviceExpense';

const CATEGORY_LABELS: Record<ExtraPaymentCategory, string> = {
  guincho: 'Guincho',
  borracheiro: 'Borracheiro',
  chaveiro: 'Chaveiro',
  uber: 'Uber',
  taxi: 'Táxi',
  frete_apoio: 'Frete de apoio',
  outro: 'Outro',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sumInstallments(installments: PaymentInstallment[]): number {
  const cents = installments.reduce((sum, i) => sum + Math.round(i.value * 100), 0);
  return cents / 100;
}

interface RequestCardProps {
  request: ExtraPaymentRequest;
  installments: PaymentInstallment[];
  processing: boolean;
  onViewDetails: (request: ExtraPaymentRequest) => void;
  onApprove: (request: ExtraPaymentRequest, installments: PaymentInstallment[]) => void;
  onReject: (request: ExtraPaymentRequest) => void;
}

function RequestCard({
  request,
  installments,
  processing,
  onViewDetails,
  onApprove,
  onReject,
}: RequestCardProps): React.ReactElement {
  const sum = sumInstallments(installments);
  const hasInstallments = installments.length > 0;
  const sumMatches = hasInstallments && sum === request.amount;
  const canApprove = hasInstallments && sumMatches;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-800">{request.requestNumber}</span>
            <span className="text-sm text-zinc-500">{CATEGORY_LABELS[request.category]}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>{request.supplierName}{request.supplierDocument && ` · ${request.supplierDocument}`}</span>
            <span>{request.vehicleLicensePlate ?? '—'}{request.driverName && ` · ${request.driverName}`}</span>
            <span>Valor do pedido: <strong className="text-zinc-700">{formatCurrency(request.amount)}</strong></span>
            <span>{installments.length} parcela(s) — soma: <strong className="text-zinc-700">{formatCurrency(sum)}</strong></span>
          </div>
          {!hasInstallments && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Este pedido não possui parcelas e não pode ser aprovado.
            </div>
          )}
          {hasInstallments && !sumMatches && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              A soma das parcelas ({formatCurrency(sum)}) não corresponde ao valor do pedido ({formatCurrency(request.amount)}).
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onViewDetails(request)}
            className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver detalhes
          </button>
          <button
            type="button"
            disabled={processing || !canApprove}
            title={canApprove ? undefined : 'Pedido sem parcelas ou com soma divergente.'}
            onClick={() => onApprove(request, installments)}
            className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Aprovar pedido e parcelas
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={() => onReject(request)}
            className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Reprovar
          </button>
        </div>
    </div>
  );
}

const CONFLICT_MESSAGE = 'Este pedido foi alterado. Nada foi aprovado; revise novamente.';

export default function ExtraPaymentApprovalsTab(): React.ReactElement {
  const { currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ExtraPaymentRequest | null>(null);
  const [viewing, setViewing] = useState<ExtraPaymentRequest | null>(null);
  const [confirming, setConfirming] = useState<{ request: ExtraPaymentRequest; installments: PaymentInstallment[] } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['extraPaymentRequests', 'approvals', currentClient?.id],
    queryFn: () => listExtraPaymentRequests({ clientId: currentClient?.id }),
  });

  const { data: allInstallments = [] } = useQuery({
    queryKey: ['paymentInstallments', 'extraApprovals', currentClient?.id],
    queryFn: () => listExtraPaymentInstallments({ clientId: currentClient?.id }),
  });

  const pending = useMemo(
    () => requests
      .filter((r) => r.status === 'pendente_aprovacao')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [requests],
  );

  const installmentsByRequest = useMemo(() => {
    const map = new Map<string, PaymentInstallment[]>();
    for (const installment of allInstallments) {
      if (!installment.extraPaymentRequestId) continue;
      const list = map.get(installment.extraPaymentRequestId) ?? [];
      list.push(installment);
      map.set(installment.extraPaymentRequestId, list);
    }
    return map;
  }, [allInstallments]);

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      setProcessingId(id);
      await rejectExtraPaymentRequest(id, reason);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extraPaymentRequests'] });
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      setRejecting(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao reprovar o pagamento extra.';
      window.alert(msg);
    },
    onSettled: () => setProcessingId(null),
  });

  const approveGroupMutation = useMutation({
    mutationFn: ({ request, installments }: { request: ExtraPaymentRequest; installments: PaymentInstallment[] }) =>
      approveExtraPaymentRequestGroup(
        request.id,
        request.updatedAt,
        installments.map((i) => ({ id: i.id, updatedAt: i.updatedAt })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extraPaymentRequests'] });
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      setConfirming(null);
      setConfirmError(null);
    },
    onError: async (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Não foi possível aprovar o pagamento extra.';
      setConfirmError(msg);
      if (msg === CONFLICT_MESSAGE) {
        await queryClient.invalidateQueries({ queryKey: ['extraPaymentRequests'] });
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
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-16 text-zinc-400 shadow-sm">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium">Nenhum pagamento extra pendente de aprovação.</p>
        </div>
      ) : (
        pending.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            installments={installmentsByRequest.get(request.id) ?? []}
            processing={processingId === request.id || approveGroupMutation.isPending}
            onViewDetails={(r) => setViewing(r)}
            onApprove={(r, installments) => { setConfirming({ request: r, installments }); setConfirmError(null); }}
            onReject={(r) => { setRejecting(r); }}
          />
        ))
      )}

      {rejecting && (
        <RejectReasonModal
          request={rejecting}
          submitting={rejectMutation.isPending}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejecting.id, reason })}
        />
      )}

      {viewing && (
        <ExtraPaymentViewModal open request={viewing} onClose={() => setViewing(null)} />
      )}

      {confirming && (
        <FinancialApprovalConfirmModal
          open
          title="Aprovar pagamento extra"
          entityLabel={`Pedido ${confirming.request.requestNumber}`}
          installmentCount={confirming.installments.length}
          totalValue={sumInstallments(confirming.installments)}
          confirmLabel="Confirmar aprovação"
          submitting={approveGroupMutation.isPending}
          error={confirmError}
          onConfirm={() => approveGroupMutation.mutate(confirming)}
          onClose={() => { if (!approveGroupMutation.isPending) { setConfirming(null); setConfirmError(null); } }}
        />
      )}
    </div>
  );
}

interface RejectReasonModalProps {
  request: ExtraPaymentRequest;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

function RejectReasonModal({ request, submitting, onCancel, onConfirm }: RejectReasonModalProps): React.ReactElement {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Reprovar {request.requestNumber}</h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 hover:bg-zinc-100">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
        <div className="space-y-2 px-5 py-4">
          <label className="block text-sm font-medium text-zinc-700">
            Motivo da reprovação <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t bg-zinc-50 px-5 py-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Reprovando…' : 'Confirmar reprovação'}
          </button>
        </div>
      </div>
    </div>
  );
}
