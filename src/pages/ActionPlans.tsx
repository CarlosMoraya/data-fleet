import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Search } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import ActionPlanModal from '../components/ActionPlanModal';
import LastKmLabel from '../components/LastKmLabel';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { actionPlanFromRow, actionStatusLabel, actionStatusColor, type ActionPlanRow } from '../lib/actionPlanMappers';
import { requiresClientSelection, showsAggregatedData } from '../lib/clientScope';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { getVehicleLastKmMap, type VehicleLastKmInfo } from '../services/vehicleOdometerService';

import type { ActionPlan, ActionPlanStatus } from '../types';


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
  const { currentClient, user, clients } = useAuth();
  const queryClient = useQueryClient();
  const blockWrite = requiresClientSelection(user?.role, currentClient?.id);

  const [activeTab, setActiveTab] = useState<ActionPlanStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['actionPlans', currentClient?.id ?? 'all-clients'],
    queryFn: async () => {
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
        `)
        .order('created_at', { ascending: false });

      if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Handle profiles where PostgREST join might fail (Edge cases/Legacy data)
      type APQueryRow = Record<string, unknown> & {
        claimed_by: string | null;
        claimed_by_profile: { name: string } | null;
        completed_by: string | null;
        completed_by_profile: { name: string } | null;
      };
      const typedData = (data as APQueryRow[] | null) ?? [];
      const missingIds = new Set<string>();
      typedData.forEach((r) => {
        if (r.claimed_by && !r.claimed_by_profile) missingIds.add(r.claimed_by);
        if (r.completed_by && !r.completed_by_profile) missingIds.add(r.completed_by);
      });

      const profileMap: Record<string, string> = {};
      if (missingIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', Array.from(missingIds));
        (profiles ?? []).forEach((p: { id: string; name: string }) => { profileMap[p.id] = p.name; });
      }

      return typedData.map((r) => {
        const row: APQueryRow = { ...r };
        if (row.claimed_by && !row.claimed_by_profile && profileMap[row.claimed_by]) {
          row.claimed_by_profile = { name: profileMap[row.claimed_by] };
        }
        if (row.completed_by && !row.completed_by_profile && profileMap[row.completed_by]) {
          row.completed_by_profile = { name: profileMap[row.completed_by] };
        }
        return actionPlanFromRow(row as unknown as ActionPlanRow);
      });
    },
    enabled: showsAggregatedData(user?.role, currentClient?.id)
  });

  const vehicleIds = useMemo(
    () => Array.from(new Set(plans.map((p) => p.vehicleId).filter((id): id is string => !!id))),
    [plans],
  );

  const { data: lastKmMap = new Map<string, VehicleLastKmInfo>() } = useQuery({
    queryKey: ['vehicleLastKmMap', 'actionPlans', vehicleIds],
    queryFn: () => getVehicleLastKmMap(vehicleIds),
    enabled: vehicleIds.length > 0,
  });

  const counts = useMemo(() => {
    return ALL_STATUSES.reduce((acc, s) => {
      acc[s] = s === 'all' ? plans.length : plans.filter(p => p.status === s).length;
      return acc;
    }, {} as Record<string, number>);
  }, [plans]);

  const filtered = useMemo(() => {
    return plans.filter(p => {
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
  }, [plans, activeTab, search]);

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const formatDueDate = (date?: string) =>
    date ? new Date(date).toLocaleDateString('pt-BR') : '—';

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <div className="flex h-full flex-col gap-6">
      {blockWrite && <SelectClientNotice />}

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
          <ClipboardList className="h-6 w-6 text-orange-500" />
          Plano de Ação
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Gerencie as ações geradas por não conformidades nos checklists</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
            <p className="mt-0.5 text-xs text-zinc-500">{actionStatusLabel(s)}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
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
        <div className="relative w-full sm:ml-auto sm:w-72">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa, nome, responsável..."
            className="w-full rounded-lg border border-zinc-300 py-2 pr-3 pl-8 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <span className="text-sm">Carregando ações...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">{blockWrite ? 'Nenhuma ação encontrada em nenhum cliente.' : 'Nenhuma ação encontrada.'}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50">
                  {[
                    ...(blockWrite ? ['Cliente'] : []),
                    'Nome / Ação', 'Veículo', 'Status', 'Responsável', 'Prazo', 'Criado em', '',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => !blockWrite && setSelectedPlan(p)}
                    className={cn('transition-colors hover:bg-zinc-50', !blockWrite && 'cursor-pointer')}
                  >
                    {blockWrite && (
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {p.clientId ? (clientNameMap.get(p.clientId) ?? '—') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="max-w-[220px] px-4 py-3">
                      {p.name && <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>}
                      <p className="truncate text-xs text-zinc-500">{p.suggestedAction}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {p.vehicleLicensePlate ? (
                        <>
                          <div>{p.vehicleLicensePlate}</div>
                          <LastKmLabel
                            info={p.vehicleId ? lastKmMap.get(p.vehicleId) : undefined}
                            className="text-xs font-normal text-zinc-400"
                          />
                        </>
                      ) : (
                        <span className="text-zinc-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', actionStatusColor(p.status))}>
                        {actionStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      <div>{p.responsibleName ?? <span className="text-zinc-400 italic">—</span>}</div>
                      {p.claimedByName && (
                        <div className="text-xs text-zinc-400">Assumido: {p.claimedByName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {formatDueDate(p.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs text-orange-500 hover:underline', blockWrite && 'pointer-events-none opacity-40')}>
                        Gerenciar
                      </span>
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
          onSaved={() => {
            setSelectedPlan(null);
            void queryClient.invalidateQueries({ queryKey: ['actionPlans', currentClient?.id] });
          }}
          onReassigned={() => {
            void queryClient.invalidateQueries({ queryKey: ['actionPlans', currentClient?.id] });
          }}
        />
      )}
    </div>
  );
}
