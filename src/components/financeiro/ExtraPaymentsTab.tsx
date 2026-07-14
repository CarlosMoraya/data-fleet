import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Download, Eye, Plus, Wallet } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { selectInstallmentsForVisibleRequests } from '../../lib/extraPaymentExportSelection';
import { computeExtraPaymentCounts, filterExtraPayments, matchesExtraPaymentSearch } from '../../lib/serviceExpenseFilters';
import { canCreateExtraPayments, canMarkExtraPaymentsPaid } from '../../lib/rolePermissions';
import { cn } from '../../lib/utils';
import { SpreadsheetPaymentProvider } from '../../services/financialExport/spreadsheetPaymentProvider';
import { XlsxPaymentProvider } from '../../services/financialExport/xlsxPaymentProvider';
import { listExtraPaymentInstallments } from '../../services/paymentInstallmentService';
import { cancelExtraPaymentRequest, listExtraPaymentRequests } from '../../services/serviceExpenseService';

import ExtraPaymentFormModal from './ExtraPaymentFormModal';
import ExtraPaymentViewModal from './ExtraPaymentViewModal';

import type { ExtraPaymentCategory, ExtraPaymentRequest, ExtraPaymentStatus } from '../../types/serviceExpense';

const STATUS_LABELS: Record<ExtraPaymentStatus, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const STATUS_BADGE: Record<ExtraPaymentStatus, string> = {
  pendente_aprovacao: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-blue-100 text-blue-700',
  reprovado: 'bg-red-100 text-red-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-zinc-100 text-zinc-500',
};

const CATEGORY_LABELS: Record<ExtraPaymentCategory, string> = {
  guincho: 'Guincho',
  borracheiro: 'Borracheiro',
  chaveiro: 'Chaveiro',
  uber: 'Uber',
  taxi: 'Táxi',
  frete_apoio: 'Frete de apoio',
  outro: 'Outro',
};

const STATUS_OPTIONS: { value: '' | ExtraPaymentStatus; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'pendente_aprovacao', label: 'Pendente de aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
];

const CATEGORY_OPTIONS: { value: '' | ExtraPaymentCategory; label: string }[] = [
  { value: '', label: 'Todas as categorias' },
  ...(Object.keys(CATEGORY_LABELS) as ExtraPaymentCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  })),
];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
}

function isCurrentMonth(iso: string): boolean {
  const now = new Date();
  const d = new Date(`${iso}T00:00:00`);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function ExtraPaymentsTab(): React.ReactElement {
  const { user, currentClient } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role;
  const canCreate = canCreateExtraPayments(role);
  const canExport = canMarkExtraPaymentsPaid(role);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ExtraPaymentStatus>('');
  const [categoryFilter, setCategoryFilter] = useState<'' | ExtraPaymentCategory>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<ExtraPaymentRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['extraPaymentRequests', currentClient?.id],
    queryFn: () => listExtraPaymentRequests({ clientId: currentClient?.id }),
  });

  const { data: installments = [] } = useQuery({
    queryKey: ['extraPaymentInstallments', currentClient?.id],
    enabled: canExport,
    queryFn: () => listExtraPaymentInstallments({ clientId: currentClient?.id }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelExtraPaymentRequest(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extraPaymentRequests'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao cancelar o pagamento extra.';
      window.alert(msg);
    },
  });

  const counts = useMemo(() => computeExtraPaymentCounts(requests), [requests]);
  const totalMonth = useMemo(
    () => requests.filter((r) => isCurrentMonth(r.serviceDate)).reduce((sum, r) => sum + r.amount, 0),
    [requests],
  );

  const filtered = useMemo(() => {
    const bySearch = requests.filter((r) => matchesExtraPaymentSearch(r, search));
    return filterExtraPayments(bySearch, {
      statuses: statusFilter ? [statusFilter] : undefined,
      categories: categoryFilter ? [categoryFilter] : undefined,
    });
  }, [requests, search, statusFilter, categoryFilter]);

  function resolveExportRows(): typeof installments {
    const visibleRequestIds = new Set(filtered.map((r) => r.id));
    return selectInstallmentsForVisibleRequests(installments, visibleRequestIds);
  }

  const handleExportCsv = async () => {
    try {
      const rowsToExport = resolveExportRows();
      if (rowsToExport.length === 0) {
        window.alert('Nada a exportar.');
        return;
      }
      const provider = new SpreadsheetPaymentProvider();
      const result = await provider.exportData(currentClient?.id ?? '', rowsToExport);
      if (!result.success || !result.content) {
        window.alert('Nada a exportar.');
        return;
      }
      const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagamentos_extras_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar CSV.';
      window.alert(msg);
    }
  };

  const handleExportXlsx = async () => {
    try {
      const rowsToExport = resolveExportRows();
      if (rowsToExport.length === 0) {
        window.alert('Nada a exportar.');
        return;
      }
      const provider = new XlsxPaymentProvider();
      const result = await provider.exportData(currentClient?.id ?? '', rowsToExport);
      if (!result.success || !result.blob) {
        window.alert('Nada a exportar.');
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagamentos_extras_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar XLSX.';
      window.alert(msg);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar por fornecedor, placa, motorista, número, descrição…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | ExtraPaymentStatus)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as '' | ExtraPaymentCategory)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
        >
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {canExport && (
            <>
              <button
                type="button"
                onClick={() => { void handleExportCsv(); }}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <Download className="h-4 w-4" />
                Baixar CSV
              </button>
              <button
                type="button"
                onClick={() => { void handleExportXlsx(); }}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <Download className="h-4 w-4" />
                Baixar XLSX
              </button>
            </>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Novo Pagamento Extra
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Pendentes</p>
          <p className="text-lg font-semibold text-zinc-900">{counts.pendente_aprovacao}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Aprovados</p>
          <p className="text-lg font-semibold text-zinc-900">{counts.aprovado}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Reprovados</p>
          <p className="text-lg font-semibold text-zinc-900">{counts.reprovado}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Pagos</p>
          <p className="text-lg font-semibold text-zinc-900">{counts.pago}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">Total do mês</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrency(totalMonth)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
            <Wallet className="h-8 w-8" />
            <p className="text-sm font-medium">Nenhum pagamento extra encontrado.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Número</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Data</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Categoria</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Veículo / Motorista</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Fornecedor</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-zinc-700">{r.requestNumber}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{formatDate(r.serviceDate)}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{CATEGORY_LABELS[r.category]}</td>
                    <td className="px-3 py-2.5 text-zinc-600">
                      {r.vehicleLicensePlate ?? '—'}
                      {r.driverName && <span className="ml-1 text-xs text-zinc-400">· {r.driverName}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600">{r.supplierName}</td>
                    <td className="px-3 py-2.5 font-medium text-zinc-800">{formatCurrency(r.amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[r.status])}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          title="Visualizar"
                          className="text-zinc-500 hover:text-blue-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {r.status === 'pendente_aprovacao' && canCreate && r.createdById === user?.id && (
                          <button
                            type="button"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(r.id)}
                            title="Cancelar"
                            className="text-zinc-500 hover:text-red-600 disabled:opacity-50"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canCreate && (
        <ExtraPaymentFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
      )}

      {viewing && (
        <ExtraPaymentViewModal open request={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
