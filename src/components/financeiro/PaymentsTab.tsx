import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, KeyRound, Plus } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { buildPaymentPendingQueue } from '../../lib/paymentPendingDocs';
import { canCreatePayments, canMarkPaid } from '../../lib/rolePermissions';
import { getFinancialDocumentSignedUrl } from '../../lib/storageHelpers';
import { cn } from '../../lib/utils';
import { SpreadsheetPaymentProvider } from '../../services/financialExport/spreadsheetPaymentProvider';
import {
  listPaymentInstallments,
  listApprovedOrdersForPayment,
  markInstallmentsPaid,
  type ApprovedOrderForPayment,
} from '../../services/paymentInstallmentService';
import ActionQueue from '../dashboard/ActionQueue';

import PaymentInstallmentFormModal from './PaymentInstallmentFormModal';

import type { PaymentInstallmentStatus, PaymentMethod } from '../../types/payment';

const STATUS_LABELS: Record<PaymentInstallmentStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Pago',
};

const STATUS_BADGE: Record<PaymentInstallmentStatus, string> = {
  pendente_aprovacao: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-blue-100 text-blue-700',
  reprovado: 'bg-red-100 text-red-700',
  pago: 'bg-green-100 text-green-700',
};

const STATUS_OPTIONS: { value: '' | PaymentInstallmentStatus; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'pendente_aprovacao', label: 'Pendente de aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'pago', label: 'Pago' },
];

const METHOD_OPTIONS: { value: '' | PaymentMethod; label: string }[] = [
  { value: '', label: 'Todas as formas' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
}

async function openSignedUrl(path: string): Promise<void> {
  try {
    const url = await getFinancialDocumentSignedUrl(path);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao abrir documento.';
    window.alert(msg);
  }
}

export default function PaymentsTab(): React.ReactElement {
  const { user, currentClient, clients } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role;

  const canCreate = canCreatePayments(role);
  const canPaid = canMarkPaid(role);
  const canExport = canPaid; // só Financeiro/Admin Master (canMarkPaid)
  const showClientFilter = role === 'Admin Master' && clients.length > 0;

  const [filterOs, setFilterOs] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | PaymentInstallmentStatus>('');
  const [filterMethod, setFilterMethod] = useState<'' | PaymentMethod>('');
  const [filterClientId, setFilterClientId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const activeClientId = showClientFilter ? (filterClientId || undefined) : (currentClient?.id ?? undefined);

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['paymentInstallments', { clientId: activeClientId }],
    queryFn: () => listPaymentInstallments({ clientId: activeClientId }),
  });

  const { data: approvedOrders = [] } = useQuery<ApprovedOrderForPayment[]>({
    queryKey: ['approvedOrdersForPayment', currentClient?.id],
    enabled: canCreate,
    queryFn: () => listApprovedOrdersForPayment(currentClient?.id),
  });

  const budgetPdfMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of approvedOrders) {
      if (o.budgetPdfUrl) m.set(o.id, o.budgetPdfUrl);
    }
    return m;
  }, [approvedOrders]);

  const pendingQueue = useMemo(() => buildPaymentPendingQueue(installments), [installments]);

  const filtered = useMemo(() => {
    return installments.filter((i) => {
      if (filterOs && !(i.maintenanceOrderOs ?? '').toLowerCase().includes(filterOs.toLowerCase())) {
        return false;
      }
      if (filterStatus && i.status !== filterStatus) return false;
      if (filterMethod && i.paymentMethod !== filterMethod) return false;
      return true;
    });
  }, [installments, filterOs, filterStatus, filterMethod]);

  const selectedInstallments = useMemo(
    () => filtered.filter((i) => selected.has(i.id)),
    [filtered, selected],
  );
  const allSelectedApproved = selectedInstallments.length > 0
    && selectedInstallments.every((i) => i.status === 'aprovado');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every((i) => selected.has(i.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const markPaidMutation = useMutation({
    mutationFn: (ids: string[]) => markInstallmentsPaid(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['paymentInstallments'] });
      setSelected(new Set());
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao marcar como pago.';
      window.alert(msg);
    },
  });

  const handleExport = async () => {
    try {
      const provider = new SpreadsheetPaymentProvider();
      const result = await provider.exportData(activeClientId ?? '', filtered);
      if (!result.success || !result.content) {
        window.alert('Nada a exportar.');
        return;
      }
      const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagamentos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar planilha.';
      window.alert(msg);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Pending docs card */}
      {pendingQueue.length > 0 && (
        <ActionQueue items={pendingQueue} title="Pendências de pagamento" />
      )}

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Filtrar por OS…"
          value={filterOs}
          onChange={(e) => setFilterOs(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as '' | PaymentInstallmentStatus)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value as '' | PaymentMethod)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        >
          {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {showClientFilter && (
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={() => { void handleExport(); }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" />
              Baixar planilha
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Pagamento
            </button>
          )}
        </div>
      </div>

      {/* Batch mark-paid bar */}
      {canPaid && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm">
          <span className="text-zinc-500">
            {selected.size} parcela(s) selecionada(s)
          </span>
          <button
            type="button"
            disabled={!allSelectedApproved || markPaidMutation.isPending}
            onClick={() => { void markPaidMutation.mutateAsync(Array.from(selected)); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              allSelectedApproved
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'cursor-not-allowed bg-zinc-200 text-zinc-400',
            )}
            title={allSelectedApproved ? '' : 'Selecione apenas parcelas aprovadas'}
          >
            {markPaidMutation.isPending ? 'Marcando…' : 'Marcar selecionadas como Pago'}
          </button>
          {!allSelectedApproved && selected.size > 0 && (
            <span className="text-xs text-amber-700">
              Só é possível marcar como pago parcelas já aprovadas.
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
            <FileText className="h-8 w-8" />
            <p className="text-sm font-medium">Nenhuma parcela encontrada.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  {canPaid && (
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every((i) => selected.has(i.id))}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">OS</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Parc.</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Vencimento</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Forma</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filtered.map((i) => {
                  const os = i.maintenanceOrderOs ?? i.maintenanceOrderId;
                  return (
                    <tr key={i.id} className="hover:bg-zinc-50">
                      {canPaid && (
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(i.id)}
                            onChange={() => toggle(i.id)}
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-zinc-700">{os}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{i.installmentNumber}/{i.installmentsTotal}</td>
                      <td className="px-3 py-2.5 font-medium text-zinc-800">{formatCurrency(i.value)}</td>
                      <td className="px-3 py-2.5 text-zinc-600">{formatDate(i.dueDate)}</td>
                      <td className="px-3 py-2.5 text-zinc-600">
                        {i.paymentMethod === 'pix' ? (
                          <span className="inline-flex items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5 text-violet-500" /> Pix
                          </span>
                        ) : 'Boleto'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[i.status])}>
                          {STATUS_LABELS[i.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          {/* Orçamento (budget PDF) */}
                          {budgetPdfMap.get(i.maintenanceOrderId) && (
                            <a
                              href={budgetPdfMap.get(i.maintenanceOrderId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Orçamento"
                              className="text-zinc-500 hover:text-orange-600"
                            >
                              📄
                            </a>
                          )}
                          {/* Boleto via signed URL */}
                          {i.paymentMethod === 'boleto' && i.boletoUrl && (
                            <button
                              type="button"
                              onClick={() => { void openSignedUrl(i.boletoUrl!); }}
                              title="Boleto"
                              className="text-zinc-500 hover:text-blue-600"
                            >
                              📃
                            </button>
                          )}
                          {/* Pix key */}
                          {i.paymentMethod === 'pix' && i.pixKey && (
                            <span title={`Pix: ${i.pixKey}`} className="text-zinc-500">🔑</span>
                          )}
                          {/* Nota fiscal via signed URL */}
                          {i.notaFiscalUrl && (
                            <button
                              type="button"
                              onClick={() => { void openSignedUrl(i.notaFiscalUrl!); }}
                              title="Nota fiscal"
                              className="text-zinc-500 hover:text-green-600"
                            >
                              🧾
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canCreate && (
        <PaymentInstallmentFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}