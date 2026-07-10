import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import {
  approvePaymentInstallment,
  listPaymentInstallments,
  rejectPaymentInstallment,
} from '../../services/paymentInstallmentService';

import BudgetDocumentPreviewModal from './BudgetDocumentPreviewModal';

import type { PaymentInstallment } from '../../types/payment';

const STATUS_BADGE: Record<string, string> = {
  aprovado: 'bg-blue-100 text-blue-700',
  reprovado: 'bg-red-100 text-red-700',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

export default function PaymentApprovalsTab(): React.ReactElement {
  const { currentClient } = useAuth();
  const queryClient = useQueryClient();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; os: string } | null>(null);

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['paymentInstallments', 'approvals', { clientId: currentClient?.id }],
    queryFn: () => listPaymentInstallments({ clientId: currentClient?.id ?? undefined }),
  });

  const pending = useMemo(
    () => installments
      .filter((i) => i.status === 'pendente_aprovacao')
      .sort((a, b) => a.installmentNumber - b.installmentNumber),
    [installments],
  );
  const processed = useMemo(
    () => installments
      .filter((i) => i.status === 'aprovado' || i.status === 'reprovado')
      .sort((a, b) => (b.paymentApprovedAt ?? '').localeCompare(a.paymentApprovedAt ?? '')),
    [installments],
  );

  // Resolve nomes dos aprovadores/pagadores a partir dos UUIDs gravados.
  const approverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of processed) {
      if (i.paymentApprovedBy) ids.add(i.paymentApprovedBy);
    }
    return Array.from(ids);
  }, [processed]);

  const { data: approverNames = new Map<string, string>() } = useQuery({
    queryKey: ['profiles', 'names', approverIds],
    enabled: approverIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', approverIds);
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of (data ?? []) as { id: string; name: string }[]) {
        m.set(r.id, r.name);
      }
      return m;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      setProcessingId(id);
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
    onSettled: () => setProcessingId(null),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Pending */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Parcelas aguardando aprovação</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Cadastros de pagamento em ordem de chegada
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
            <p className="text-sm font-medium">Nenhuma parcela pendente de aprovação.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">OS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Parc.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Vencimento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Forma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Orçamento aprovado por</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {pending.map((i) => (
                  <PendingRow
                    key={i.id}
                    installment={i}
                    approving={processingId === i.id}
                    onApprove={(id) => reviewMutation.mutate({ id, approve: true })}
                    onReject={(id) => reviewMutation.mutate({ id, approve: false })}
                    onPreview={(url, os) => setPreview({ url, os })}
                  />
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
            Nenhuma parcela processada ainda.
          </div>
        ) : (
          <div className="max-h-[280px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">OS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Parc.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Aprovado por</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {processed.map((i) => (
                  <tr key={i.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-zinc-700">
                      {i.maintenanceOrderOs ?? i.maintenanceOrderId}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{i.installmentNumber}/{i.installmentsTotal}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-800">{formatCurrency(i.value)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[i.status])}>
                        {i.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">
                      {i.paymentApprovedBy ? (approverNames.get(i.paymentApprovedBy) ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {i.paymentApprovedAt ? formatDateTime(i.paymentApprovedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <BudgetDocumentPreviewModal
          open
          url={preview.url}
          osNumber={preview.os}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

interface PendingRowProps {
  installment: PaymentInstallment;
  approving: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPreview: (url: string, osNumber: string) => void;
}

function PendingRow({ installment: i, approving, onApprove, onReject, onPreview }: PendingRowProps): React.ReactElement {
  const os = i.maintenanceOrderOs ?? i.maintenanceOrderId;
  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-4 py-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono font-semibold text-zinc-700">{os}</span>
          {i.budgetPdfUrl ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPreview(i.budgetPdfUrl!, os)}
                className="text-orange-600 hover:text-orange-700"
              >
                📄 Orçamento
              </button>
              <a
                href={i.budgetPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-600"
              >
                Abrir
              </a>
            </div>
          ) : (
            <span className="text-zinc-400">— sem documento</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-500">{i.installmentNumber}/{i.installmentsTotal}</td>
      <td className="px-4 py-3 text-zinc-600">
        {i.workshopName ?? '—'}
        {i.workshopCnpj && <span className="ml-1 text-xs text-zinc-400">· {i.workshopCnpj}</span>}
      </td>
      <td className="px-4 py-3 font-medium text-zinc-800">{formatCurrency(i.value)}</td>
      <td className="px-4 py-3 text-zinc-600">{formatDate(i.dueDate)}</td>
      <td className="px-4 py-3 text-zinc-600">{i.paymentMethod === 'pix' ? 'Pix' : 'Boleto'}</td>
      <td className="px-4 py-3 text-zinc-600">{i.budgetApprovedByName ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            disabled={approving}
            onClick={() => onApprove(i.id)}
            className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Aprovar
          </button>
          <button
            disabled={approving}
            onClick={() => onReject(i.id)}
            className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Reprovar
          </button>
        </div>
      </td>
    </tr>
  );
}