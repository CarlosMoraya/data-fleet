import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { actionPlanFromRow, actionStatusLabel, actionStatusColor, type ActionPlanRow } from '../lib/actionPlanMappers';
import type { ActionPlan, ActionPlanStatus } from '../types';
import ActionPlanModal from '../components/ActionPlanModal';
import { cn } from '../lib/utils';

const ALL_STATUSES: (ActionPlanStatus | 'all')[] = ['all', 'pending', 'in_progress', 'awaiting_conclusion', 'completed', 'cancelled'];
const STATUS_TAB_LABEL: Record<string, string> = {
  all: 'Todos',
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  awaiting_conclusion: 'Ag. Aprovação',
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
        responsible_profile:profiles!responsible_id(name),
        assigned_by_profile:profiles!assigned_by(name),
        claimed_by_profile:profiles!claimed_by(name),
        completed_by_profile:profiles!completed_by(name),
        checklist_responses!checklist_response_id(checklist_items(title)),
        checklists!checklist_id(checklist_templates(name))
      `);

    if (currentClient?.id) {
      query = query.eq('client_id', currentClient.id);
    }

    const { data, error: fetchError } = await query.order('created_at', { ascending: false });
    if (fetchError) console.error('ActionPlans fetch error:', fetchError);

    // Collect profile IDs where PostgREST join returned null (columns without FK constraints)
    const missingIds = new Set<string>();
    (data ?? []).forEach((r: Record<string, unknown>) => {
      if (r.claimed_by && !r.claimed_by_profile) missingIds.add(r.claimed_by as string);
      if (r.completed_by && !r.completed_by_profile) missingIds.add(r.completed_by as string);
    });

    let profileMap: Record<string, string> = {};
    if (missingIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', [...missingIds]);
      (profiles ?? []).forEach((p: { id: string; name: string }) => { profileMap[p.id] = p.name; });
    }

    const mapped = (data ?? []).map(r => {
      const row = r as ActionPlanRow & { profiles: { name: string } | null };
      if (row.claimed_by && !row.claimed_by_profile && profileMap[row.claimed_by]) {
        row.claimed_by_profile = { name: profileMap[row.claimed_by] };
      }
      if (row.completed_by && !row.completed_by_profile && profileMap[row.completed_by]) {
        row.completed_by_profile = { name: profileMap[row.completed_by] };
      }
      return actionPlanFromRow({ ...row });
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
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.responsibleName ?? '').toLowerCase().includes(q)
    );
    return matchTab && matchSearch;
  });

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const formatDueDate = (date?: string) =>
    date ? new Date(date).toLocaleDateString('pt-BR') : '—';

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['pending', 'in_progress', 'awaiting_conclusion', 'completed', 'cancelled'] as ActionPlanStatus[]).map(s => (
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
        <div className="relative sm:ml-auto w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa, nome, responsável..."
            className="w-full pl-8 pr-3 rounded-lg border border-zinc-300 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
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
                  {['Nome / Ação', 'Veículo', 'Status', 'Responsável', 'Prazo', 'Criado em', ''].map(h => (
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
                    <td className="px-4 py-3 max-w-[220px]">
                      {p.name && <p className="text-sm font-medium text-zinc-900 truncate">{p.name}</p>}
                      <p className="text-xs text-zinc-500 truncate">{p.suggestedAction}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {p.vehicleLicensePlate ?? <span className="italic text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', actionStatusColor(p.status))}>
                        {actionStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      <div>{p.responsibleName ?? <span className="italic text-zinc-400">—</span>}</div>
                      {p.claimedByName && (
                        <div className="text-xs text-zinc-400">Assumido: {p.claimedByName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {formatDueDate(p.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(p.createdAt)}</td>
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
