import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { actionPlanFromRow, actionStatusLabel, actionStatusColor, type ActionPlanRow } from '../lib/actionPlanMappers';
import type { ActionPlan, ActionPlanStatus } from '../types';
import ActionPlanModal from '../components/ActionPlanModal';
import { cn } from '../lib/utils';

const ALL_STATUSES: (ActionPlanStatus | 'all')[] = ['all', 'pending', 'in_progress', 'completed', 'cancelled'];
const STATUS_TAB_LABEL: Record<string, string> = {
  all: 'Todos',
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export default function ActionPlans() {
  const { currentClient } = useAuth();

  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActionPlanStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('action_plans')
      .select(`
        *,
        vehicles(license_plate),
        profiles!reported_by(name),
        checklist_items!checklist_response_id(title),
        checklist_templates(name)
      `);

    if (currentClient?.id) {
      query = query.eq('client_id', currentClient.id);
    }

    const { data } = await query.order('created_at', { ascending: false });

    // Manual mapping since multiple foreign keys to profiles
    const mapped = (data ?? []).map(r => {
      const row = r as ActionPlanRow & { profiles: { name: string } | null; vehicles: { license_plate: string } | null };
      return actionPlanFromRow({
        ...row,
        reported_by: row.reported_by,
      });
    });
    setPlans(mapped);
    setLoading(false);
  }, [currentClient?.id]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = s === 'all' ? plans.length : plans.filter(p => p.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = plans.filter(p => {
    const matchTab = activeTab === 'all' || p.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch = !q || (
      (p.vehicleLicensePlate ?? '').toLowerCase().includes(q) ||
      (p.suggestedAction ?? '').toLowerCase().includes(q) ||
      (p.itemTitle ?? '').toLowerCase().includes(q) ||
      (p.workOrderNumber ?? '').toLowerCase().includes(q)
    );
    return matchTab && matchSearch;
  });

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-orange-500" />
          Plano de Ação
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie as ações geradas por não conformidades nos checklists</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'in_progress', 'completed', 'cancelled'] as ActionPlanStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setActiveTab(s)}
            className={cn(
              'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
              activeTab === s ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
            )}
          >
            <p className="text-2xl font-bold text-zinc-900">{counts[s]}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{actionStatusLabel(s)}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeTab === s ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
              )}
            >
              {STATUS_TAB_LABEL[s]}
              {counts[s] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({counts[s]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por placa, item, O.S..."
          className="sm:ml-auto rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-full sm:w-72"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm">Carregando ações...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma ação encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead>
                <tr className="bg-zinc-50">
                  {['Veículo', 'Item', 'Ação Sugerida', 'Status', 'Reportado por', 'Data', 'O.S.', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPlan(p)}
                    className="hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {p.vehicleLicensePlate ?? <span className="italic text-zinc-400">Livre</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 max-w-[160px] truncate">
                      {p.itemTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 max-w-[200px] truncate">
                      {p.suggestedAction}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', actionStatusColor(p.status))}>
                        {actionStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{p.reportedByName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700 font-mono">{p.workOrderNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-orange-500 hover:underline">Gerenciar</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPlan && (
        <ActionPlanModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSaved={() => { setSelectedPlan(null); fetchPlans(); }}
        />
      )}
    </div>
  );
}
