import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import BudgetItemsTable from '../components/BudgetItemsTable';
import {
  budgetItemFromRow,
  calcBudgetSubtotal,
  type BudgetItem,
  type MaintenanceBudgetItemRow,
} from '../lib/maintenanceMappers';
import type { User } from '../types';

// ─── Permission helpers ───────────────────────────────────────────────────────

const ALWAYS_APPROVE_ROLES = ['Coordinator', 'Director', 'Admin Master'];

function canApprove(user: User, budgetTotal: number): boolean {
  if (ALWAYS_APPROVE_ROLES.includes(user.role)) return true;
  return user.budgetApprovalLimit > 0 && budgetTotal <= user.budgetApprovalLimit;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingOrder {
  id: string;
  os: string;
  licensePlate: string;
  workshop: string;
  entryDate: string;
  budgetPdfUrl?: string;
  workshopOs?: string;
  currentKm?: number;
  createdBy: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Row component ────────────────────────────────────────────────────────────

interface OrderRowProps {
  order: PendingOrder;
  user: User;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving: boolean;
  key?: React.Key;
}

function OrderRow({ order, user, onApprove, onReject, approving }: OrderRowProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: items = [], isLoading: loadingItems } = useQuery<BudgetItem[]>({
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

  const subtotal = calcBudgetSubtotal(items);
  const withinLimit = canApprove(user, subtotal);
  const isAlwaysApprover = ALWAYS_APPROVE_ROLES.includes(user.role);

  const limitTooltip = !isAlwaysApprover && !withinLimit
    ? `Valor acima do seu limite de aprovação (${formatCurrency(user.budgetApprovalLimit)})`
    : undefined;

  return (
    <>
      <tr
        className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-3 w-6 text-zinc-400">
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
          {items.length > 0 ? (
            <span className={cn(
              withinLimit || isAlwaysApprover ? 'text-green-700' : 'text-red-600'
            )}>
              {formatCurrency(subtotal)}
            </span>
          ) : (
            <span className="text-zinc-400 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {order.budgetPdfUrl && (
            <a
              href={order.budgetPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              PDF
            </a>
          )}
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button
              disabled={approving || !withinLimit && !isAlwaysApprover}
              onClick={() => onApprove(order.id)}
              title={limitTooltip}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                withinLimit || isAlwaysApprover
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Aprovar
            </button>
            <button
              disabled={approving}
              onClick={() => onReject(order.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Reprovar
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-100 bg-zinc-50">
          <td colSpan={8} className="px-6 py-4">
            {loadingItems ? (
              <p className="text-sm text-zinc-400">Carregando itens...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum item cadastrado no orçamento.</p>
            ) : (
              <BudgetItemsTable items={items} readOnly />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetApprovals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Guard: Fleet Assistant+ (rank 3+)
  const ROLE_RANK: Record<string, number> = {
    Driver: 1, 'Yard Auditor': 2, 'Fleet Assistant': 3, 'Fleet Analyst': 4,
    Supervisor: 4, Manager: 5, Coordinator: 6, Director: 6, 'Admin Master': 7,
  };
  const rank = user ? (ROLE_RANK[user.role] ?? 0) : 0;

  React.useEffect(() => {
    if (!user) return;
    if (rank < 3) navigate('/', { replace: true });
  }, [user, rank, navigate]);

  const { currentClient } = useAuth();

  const { data: orders = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ['budgetApprovals', currentClient?.id],
    enabled: rank >= 3,
    queryFn: async () => {
      let query = supabase
        .from('maintenance_orders')
        .select(`
          id, os_number, entry_date, workshop_os_number, current_km,
          budget_pdf_url, created_at,
          vehicles(license_plate),
          workshops(name),
          profiles!created_by_id(name)
        `)
        .eq('status', 'Aguardando aprovação')
        .order('created_at', { ascending: true });

      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as any[]).map(row => ({
        id: row.id,
        os: row.os_number,
        licensePlate: row.vehicles?.license_plate ?? 'N/A',
        workshop: row.workshops?.name ?? '—',
        entryDate: row.entry_date,
        budgetPdfUrl: row.budget_pdf_url ?? undefined,
        workshopOs: row.workshop_os_number ?? undefined,
        currentKm: row.current_km ?? undefined,
        createdBy: row.profiles?.name ?? '—',
        createdAt: row.created_at,
      }));
    },
  });

  const [processingId, setProcessingId] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      setProcessingId(id);
      const { error } = await supabase
        .from('maintenance_orders')
        .update({
          budget_status: approve ? 'aprovado' : 'reprovado',
          status: approve ? 'Orçamento aprovado' : 'Aguardando orçamento',
          budget_reviewed_by: user!.id,
          budget_reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders'] });
    },
    onSettled: () => setProcessingId(null),
  });

  if (!user || rank < 3) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BadgeCheck className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Aprovação de Orçamentos</h1>
          <p className="text-sm text-zinc-500">Orçamentos aguardando revisão — ordem de chegada</p>
        </div>
      </div>

      {/* Limit info for non-always-approvers */}
      {!ALWAYS_APPROVE_ROLES.includes(user.role) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          Seu limite de aprovação é <strong>{formatCurrency(user.budgetApprovalLimit)}</strong>.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-zinc-500">Carregando orçamentos...</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-zinc-400">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium">Nenhum orçamento pendente de aprovação.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-4 py-3 w-6" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">OS Interna</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Placa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Oficina</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Entrada</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Subtotal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">PDF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-100">
              {orders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  user={user}
                  approving={processingId === order.id}
                  onApprove={id => reviewMutation.mutate({ id, approve: true })}
                  onReject={id => reviewMutation.mutate({ id, approve: false })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
