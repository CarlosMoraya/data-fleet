import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  approveExtraPaymentRequest,
  listExtraPaymentRequests,
  rejectExtraPaymentRequest,
} from '../../services/serviceExpenseService';

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

const STATUS_BADGE: Record<string, string> = {
  aprovado: 'bg-blue-100 text-blue-700',
  reprovado: 'bg-red-100 text-red-700',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export default function ExtraPaymentApprovalsTab(): React.ReactElement {
  const { currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ExtraPaymentRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['extraPaymentRequests', 'approvals', currentClient?.id],
    queryFn: () => listExtraPaymentRequests({ clientId: currentClient?.id }),
  });

  const pending = useMemo(
    () => requests
      .filter((r) => r.status === 'pendente_aprovacao')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [requests],
  );
  const processed = useMemo(
    () => requests
      .filter((r) => r.status === 'aprovado' || r.status === 'reprovado')
      .sort((a, b) => (b.approvedAt ?? b.rejectedAt ?? '').localeCompare(a.approvedAt ?? a.rejectedAt ?? '')),
    [requests],
  );

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      setProcessingId(id);
      await approveExtraPaymentRequest(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extraPaymentRequests'] });
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao aprovar o pagamento extra.';
      window.alert(msg);
    },
    onSettled: () => setProcessingId(null),
  });

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Pending */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Pagamentos extras aguardando aprovação</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Lançamentos em ordem de chegada</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <p className="text-sm font-medium">Nenhum pagamento extra pendente de aprovação.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Veículo/Motorista</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Data do serviço</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {pending.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700">{r.requestNumber}</td>
                    <td className="px-4 py-3 text-zinc-600">{CATEGORY_LABELS[r.category]}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {r.supplierName}
                      {r.supplierDocument && <span className="ml-1 text-xs text-zinc-400">· {r.supplierDocument}</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {r.vehicleLicensePlate ?? '—'}
                      {r.driverName && <span className="ml-1 text-xs text-zinc-400">· {r.driverName}</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 text-zinc-600">{formatDate(r.serviceDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={processingId === r.id}
                          onClick={() => approveMutation.mutate(r.id)}
                          className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          Aprovar
                        </button>
                        <button
                          disabled={processingId === r.id}
                          onClick={() => setRejecting(r)}
                          className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                          Reprovar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Processed */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Já processados</h2>
        </div>
        {processed.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">
            Nenhum pagamento extra processado ainda.
          </div>
        ) : (
          <div className="max-h-[280px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Aprovador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {processed.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-zinc-700">{r.requestNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-800">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[r.status])}>
                        {r.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{r.approvedByName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {formatDateTime(r.approvedAt ?? r.rejectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejecting && (
        <RejectReasonModal
          request={rejecting}
          submitting={rejectMutation.isPending}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejecting.id, reason })}
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
