import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import {
  applyBudgetHistoryFilters,
  BUDGET_DECISION_OPTIONS,
  buildBudgetHistoryWorkshopOptions,
  type BudgetDecision,
} from '../../lib/budgetHistoryFilters';
import { formatDate } from '../../lib/dateUtils';
import { downloadBlobFile } from '../../lib/downloadBlobFile';
import {
  budgetItemFromRow,
  type BudgetItem,
  type MaintenanceBudgetItemRow,
} from '../../lib/maintenanceMappers';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { XlsxBudgetHistoryProvider } from '../../services/budgetHistoryExport/xlsxBudgetHistoryProvider';
import { listReviewedBudgets } from '../../services/budgetHistoryService';
import BudgetItemsTable from '../BudgetItemsTable';

import type { MaintenanceOrder } from '../../types/maintenance';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function decisionLabel(status: MaintenanceOrder['budgetStatus']): string {
  return BUDGET_DECISION_OPTIONS.find(o => o.value === status)?.label ?? '—';
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface HistoryRowProps {
  order: MaintenanceOrder;
}

function HistoryRow({ order }: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: items = [], isLoading: loadingItems, isError: itemsError } = useQuery<BudgetItem[]>({
    queryKey: ['budgetItems', order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_budget_items')
        .select('*')
        .eq('maintenance_order_id', order.id)
        .order('sort_order');
      if (error) throw error;
      return (data as MaintenanceBudgetItemRow[]).map(budgetItemFromRow);
    },
  });

  const isApproved = order.budgetStatus === 'aprovado';
  const isRejected = order.budgetStatus === 'reprovado';

  return (
    <>
      <tr
        className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="w-6 px-4 py-3 text-zinc-400">
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-sm font-semibold text-zinc-800">{order.os}</span>
          {order.workshopOs && (
            <span className="ml-2 text-xs text-zinc-400">OS Of.: {order.workshopOs}</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-700">
          <span className="font-mono font-semibold">{order.licensePlate}</span>
        </td>
        <td className="px-4 py-3 text-sm text-zinc-600">{order.workshop}</td>
        <td className="px-4 py-3 text-sm text-zinc-500">{formatDate(order.entryDate)}</td>
        <td className="px-4 py-3 text-sm font-semibold">
          {order.approvedCost != null
            ? formatCurrency(order.approvedCost)
            : <span className="text-zinc-400">—</span>}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              isApproved && 'bg-green-100 text-green-700',
              isRejected && 'bg-red-100 text-red-700',
            )}
          >
            {decisionLabel(order.budgetStatus)}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-zinc-700">{order.budgetReviewedBy ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-zinc-500">{formatDate(order.budgetReviewedAt)}</td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          {order.budgetPdfUrl && (
            <a
              href={order.budgetPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              PDF
            </a>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-100 bg-zinc-50">
          <td colSpan={10} className="px-6 py-4">
            <div className="space-y-3">
              {isRejected && order.budgetRejectionReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <span className="font-medium">Motivo da reprovação:</span>{' '}
                  {order.budgetRejectionReason}
                </div>
              )}
              {itemsError ? (
                <p className="text-sm text-red-600">Não foi possível carregar os itens deste orçamento.</p>
              ) : loadingItems ? (
                <p className="text-sm text-zinc-400">Carregando itens...</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum item cadastrado no orçamento.</p>
              ) : (
                <BudgetItemsTable items={items} readOnly orderDiscount={order.budgetDiscount ?? 0} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BudgetHistoryTab(): React.ReactElement {
  const { currentClient } = useAuth();

  const { data: orders = [], isLoading, isError } = useQuery<MaintenanceOrder[]>({
    queryKey: ['budgetHistory', currentClient?.id],
    queryFn: () => listReviewedBudgets(currentClient?.id),
  });

  const [decision, setDecision] = useState<BudgetDecision | ''>('');
  const [workshop, setWorkshop] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const workshopOptions = useMemo(() => buildBudgetHistoryWorkshopOptions(orders), [orders]);

  const filtered = useMemo(
    () => applyBudgetHistoryFilters(orders, { decision, workshop, search }),
    [orders, decision, workshop, search],
  );

  const hasActiveFilters = decision !== '' || workshop !== '' || search.trim() !== '';

  async function handleExport() {
    setExporting(true);
    try {
      const provider = new XlsxBudgetHistoryProvider();
      const result = await provider.exportData(currentClient?.id ?? '', filtered);
      if (result.blob) {
        downloadBlobFile(
          result.blob,
          `historico-orcamentos_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
      }
    } catch {
      window.alert('Falha ao gerar a planilha do histórico de orçamentos.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Filters + export */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={decision}
          onChange={e => setDecision(e.target.value as BudgetDecision | '')}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-400 focus:outline-none"
        >
          <option value="">Todas as decisões</option>
          {BUDGET_DECISION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={workshop}
          onChange={e => setWorkshop(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-400 focus:outline-none"
        >
          <option value="">Todas as oficinas</option>
          {workshopOptions.map(w => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por OS, placa ou OS da oficina"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-400 focus:outline-none"
        />

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => { void handleExport(); }}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            Baixar XLSX
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-orange-500" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Não foi possível carregar o histórico de orçamentos.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-400">
            <p className="text-sm font-medium">
              {hasActiveFilters
                ? 'Nenhum orçamento encontrado para os filtros aplicados.'
                : 'Nenhum orçamento aprovado ou reprovado até o momento.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="w-6 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">OS Interna</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Placa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Oficina</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Entrada</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Valor Aprovado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Decisão</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Revisado por</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Revisado em</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filtered.map(order => (
                  <HistoryRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}