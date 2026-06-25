import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Search, Eye, CheckCircle2, Loader2, Plus, Edit, ExternalLink, Ban, RotateCcw } from 'lucide-react';
import React from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';

import MaintenanceDetailModal from '../components/MaintenanceDetailModal';
import MaintenanceForm from '../components/MaintenanceForm';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import SelectClientNotice from '../components/SelectClientNotice';
import { useAuth } from '../context/AuthContext';
import { requiresClientSelection } from '../lib/clientScope';
import { canWorkshopFillOrder } from '../lib/maintenanceWorkshop';
import { maintenanceFromRow, MaintenanceOrderRow, BudgetItem } from '../lib/maintenanceMappers';
import { canEditWorkshopOrder, isOperationsManager } from '../lib/rolePermissions';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { savePendingPartPhotos, type PartPhotoDraft } from '../services/maintenancePartPhotoService';
import {
  saveMaintenanceOrder,
  updateMaintenanceStatus,
  cancelMaintenanceOrder,
} from '../services/maintenanceService';

import type { Role } from '../types';
import type { MaintenanceOrder, MaintenanceStatus, MaintenanceType, BudgetStatus } from '../types/maintenance';

import { useSessionUiState, usePersistentFilterState, usePersistentTabState } from '../hooks/usePersistentUiState';
import { buildUiStateKey, removeUiState } from '../lib/uiStateStorage';
import { buildMaintenanceFilterOptions, applyMaintenanceListFilters } from '../lib/maintenanceFilters';

// Re-export para compatibilidade com componentes que importam daqui
export type { MaintenanceOrder, MaintenanceStatus, MaintenanceType, BudgetStatus };

type StatusFilter = MaintenanceStatus | 'all';

const ALL_STATUSES: StatusFilter[] = [
  'all',
  'Aguardando orçamento',
  'Aguardando aprovação',
  'Orçamento aprovado',
  'Serviço em execução',
  'Concluído',
  'Veículo retirado',
  'Cancelado',
];

function statusColor(status: MaintenanceStatus) {
  switch (status) {
    case 'Aguardando orçamento': return 'bg-yellow-100 text-yellow-800';
    case 'Aguardando aprovação': return 'bg-orange-100 text-orange-800';
    case 'Orçamento aprovado': return 'bg-blue-100 text-blue-800';
    case 'Serviço em execução': return 'bg-purple-100 text-purple-800';
    case 'Concluído': return 'bg-green-100 text-green-800';
    case 'Veículo retirado': return 'bg-teal-100 text-teal-800';
    case 'Cancelado': return 'bg-zinc-100 text-zinc-500';
  }
}

function budgetStatusBadge(budgetStatus?: BudgetStatus, pdfUrl?: string) {
  if (!budgetStatus || budgetStatus === 'sem_orcamento') return null;
  const colors: Record<string, string> = {
    pendente: 'bg-yellow-100 text-yellow-800',
    aprovado: 'bg-green-100 text-green-800',
    reprovado: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    pendente: 'Aguardando',
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
  };
  return (
    <div className="flex items-center gap-1">
      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', colors[budgetStatus] ?? 'bg-zinc-100 text-zinc-600')}>
        {labels[budgetStatus] ?? budgetStatus}
      </span>
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="rounded p-0.5 text-zinc-400 hover:text-blue-600"
          title="Ver PDF do orçamento"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function typeColor(type: MaintenanceType) {
  switch (type) {
    case 'Corretiva': return 'bg-red-100 text-red-800';
    case 'Preventiva': return 'bg-blue-100 text-blue-800';
    case 'Preditiva': return 'bg-purple-100 text-purple-800';
  }
}

function daysInWorkshop(entryDate: string) {
  const entry = new Date(entryDate);
  const today = new Date();
  return Math.floor((today.getTime() - entry.getTime()) / 86400000);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function shouldEnableMaintenanceOrdersQuery(params: {
  isWorkshopUser: boolean;
  isMultiWorkshop: boolean;
  activeWorkshopId?: string | null;
  workshopId?: string | null;
  currentClientId?: string | null;
  role?: string | null;
}) {
  return params.isWorkshopUser
    ? (params.isMultiWorkshop || !!(params.activeWorkshopId ?? params.workshopId))
    : params.role === 'Admin Master' || !!params.currentClientId;
}

export default function Maintenance() {
  const { currentClient, user: profile, clients } = useAuth();
  const isWorkshopUser = profile?.role === 'Workshop';
  const isAdminMaster = profile?.role === 'Admin Master';
  const blockWrite = requiresClientSelection(profile?.role, currentClient?.id);
  const operationsManager = isOperationsManager(profile?.role);
  const canWriteMaintenance = !operationsManager && !isWorkshopUser && !blockWrite;
  const canFillWorkshop = canEditWorkshopOrder(profile?.role);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = usePersistentTabState('maintenance', 'status', 'all');
  const [search, setSearch] = usePersistentFilterState<string>('maintenance', 'search', '');
  const [shipperFilter, setShipperFilter] = usePersistentFilterState<string[]>('maintenance', 'shippers', []);
  const [unitFilter, setUnitFilter] = usePersistentFilterState<string[]>('maintenance', 'units', []);
  const [searchParams, setSearchParams] = useSearchParams();
  React.useEffect(() => {
    const placa = searchParams.get('placa');
    if (placa) {
      setSearch(placa);
      const next = new URLSearchParams(searchParams);
      next.delete('placa');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedOrder, setSelectedOrder] = React.useState<MaintenanceOrder | null>(null);
  const allowedRoles: Role[] = [
    'Workshop',
    'Fleet Assistant',
    'Fleet Analyst',
    'Supervisor',
    'Operations Manager',
    'Manager',
    'Coordinator',
    'Director',
    'Admin Master',
  ];

  const location = useLocation();
  if (profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to={profile.role === 'Driver' || profile.role === 'Yard Auditor' ? '/checklists' : '/'} replace />;
  }

  const [isFormOpen, setIsFormOpen] = useSessionUiState<boolean>('maintenance', 'modal', 'form-open', false, { legacyKeys: ['maintenanceFormOpen'] });
  const [orderToEdit, setOrderToEdit] = useSessionUiState<MaintenanceOrder | null>('maintenance', 'selection', 'editing', null, { legacyKeys: ['maintenanceFormEditing'] });
  const [prefillData, setPrefillData] = React.useState<Partial<MaintenanceOrder> | undefined>(
    () => (operationsManager ? undefined : (location.state)?.prefillMaintenance ?? undefined)
  );
  const [orderToCancel, setOrderToCancel] = React.useState<MaintenanceOrder | null>(null);

  const clearMaintenanceDraft = () => {
    if (profile?.id) {
      const key = buildUiStateKey({ scope: 'draft', userId: profile.id, clientId: currentClient?.id ?? 'no-client', module: 'maintenance', stateKind: 'draft', name: 'form' });
      removeUiState(window.sessionStorage, key);
    }
    removeUiState(window.sessionStorage, 'maintenanceFormData');
  };

  // Abrir form automaticamente se vier do fluxo agendamento → manutenção
  React.useEffect(() => {
    if (prefillData && !operationsManager) {
      setOrderToEdit(null);
      setIsFormOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [prefillData, operationsManager]);

  const { activeWorkshopId, workshopPartnerships } = useAuth();
  const isMultiWorkshop = isWorkshopUser && workshopPartnerships.length > 1;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['maintenanceOrders', currentClient?.id ?? 'all-clients', activeWorkshopId, profile?.role],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_orders')
        .select(`
          *,
          vehicles (license_plate, shippers (name), operational_units (name)),
          workshops (name),
          profiles!created_by_id (name),
          budget_reviewer:profiles!budget_reviewed_by (name),
          clients (name)
        `)
        .order('created_at', { ascending: false });

      if (isWorkshopUser) {
        if (isMultiWorkshop) {
          // Workshop multi-transportadora: filtrar por client_id quando há cliente selecionado.
          // Sem filtro → RLS retorna todas as partnerships ativas automaticamente.
          if (currentClient?.id) {
            query = query.eq('client_id', currentClient.id);
          }
        } else if (activeWorkshopId) {
          query = query.eq('workshop_id', activeWorkshopId);
        } else if (profile?.workshopId) {
          query = query.eq('workshop_id', profile.workshopId);
        }
      } else if (currentClient?.id) {
        query = query.eq('client_id', currentClient.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as MaintenanceOrderRow[]).map(maintenanceFromRow);
    },
    enabled: shouldEnableMaintenanceOrdersQuery({
      isWorkshopUser,
      isMultiWorkshop,
      activeWorkshopId,
      workshopId: profile?.workshopId,
      currentClientId: currentClient?.id,
      role: isAdminMaster ? profile.role : profile?.role,
    }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceStatus }) => {
      await updateMaintenanceStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (order: MaintenanceOrder) => {
      await cancelMaintenanceOrder(order.id, profile?.id ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['budgetApprovals'] });
      setOrderToCancel(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      data,
      budgetItems,
      budgetFile,
      pendingPartPhotos,
    }: {
      data: Partial<MaintenanceOrder>;
      budgetItems: BudgetItem[];
      budgetFile: File | null;
      pendingPartPhotos: PartPhotoDraft[];
    }) => {
      if (!profile) throw new Error('Sessão inválida');
      const orderId = await saveMaintenanceOrder({
        data,
        budgetItems,
        budgetFile,
        profileId: profile.id,
        currentClientId: currentClient?.id,
      });
      if (pendingPartPhotos.length > 0) {
        const clientId = data.clientId ?? currentClient?.id;
        if (!clientId) throw new Error('client_id é obrigatório');
        await savePendingPartPhotos({
          orderId,
          clientId,
          uploadedBy: profile.id,
          drafts: pendingPartPhotos,
        });
      }
      return orderId;
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['budgetApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['partPhotos', orderId] });
      setIsFormOpen(false);
      setOrderToEdit(null);
      clearMaintenanceDraft();
    },
  });

  const filterOptions = React.useMemo(() => buildMaintenanceFilterOptions(orders), [orders]);

  const counts = React.useMemo(() => {
    return {
      all: orders.filter(o => o.status !== 'Veículo retirado' && o.status !== 'Cancelado').length,
      'Aguardando orçamento': orders.filter(o => o.status === 'Aguardando orçamento').length,
      'Aguardando aprovação': orders.filter(o => o.status === 'Aguardando aprovação').length,
      'Orçamento aprovado': orders.filter(o => o.status === 'Orçamento aprovado').length,
      'Serviço em execução': orders.filter(o => o.status === 'Serviço em execução').length,
      'Concluído': orders.filter(o => o.status === 'Concluído').length,
      'Veículo retirado': orders.filter(o => o.status === 'Veículo retirado').length,
      'Cancelado': orders.filter(o => o.status === 'Cancelado').length,
      corretiva: orders.filter(o => o.type === 'Corretiva').length,
      preventiva: orders.filter(o => o.type === 'Preventiva').length,
    };
  }, [orders]);

  const filtered = React.useMemo(() => {
    const byTabAndSearch = orders.filter(o => {
      const matchTab = activeTab === 'all' || o.status === activeTab;
      const matchSearch = !search || o.licensePlate.toLowerCase().includes(search.toLowerCase()) || o.os.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    });
    return applyMaintenanceListFilters(byTabAndSearch, { shippers: shipperFilter, operationalUnits: unitFilter });
  }, [orders, activeTab, search, shipperFilter, unitFilter]);

  const clientNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clients]);

  const handleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ id, status: 'Veículo retirado' });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      {blockWrite && <SelectClientNotice />}
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            <Wrench className="h-6 w-6 text-orange-500" />
            Manutenção
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Acompanhe as ordens de serviço e o status dos veículos em manutenção</p>
        </div>

        {canWriteMaintenance && (
          <button
            onClick={() => {
              setOrderToEdit(null);
              setIsFormOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 sm:py-2"
          >
            <Plus className="h-4 w-4" />
            Nova Manutenção
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'all' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-zinc-900">{counts.all}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Total em Manutenção</p>
        </button>
        <button
          onClick={() => setActiveTab('Aguardando orçamento')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Aguardando orçamento' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-yellow-600">{counts['Aguardando orçamento']}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Aguardando Orçamento</p>
        </button>
        <button
          onClick={() => setActiveTab('Aguardando aprovação')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Aguardando aprovação' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-orange-600">{counts['Aguardando aprovação']}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Ag. Aprovação</p>
        </button>
        <button
          onClick={() => setActiveTab('Serviço em execução')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Serviço em execução' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-purple-600">{counts['Serviço em execução']}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Em Execução</p>
        </button>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left">
          <p className="text-2xl font-bold text-red-600">{counts.corretiva}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Total Corretiva</p>
        </div>
        <button
          onClick={() => setActiveTab('Cancelado')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-zinc-400',
            activeTab === 'Cancelado' ? 'border-zinc-500 bg-zinc-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-zinc-400">{counts['Cancelado']}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Cancelados</p>
        </button>
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
              {s === 'all' ? 'Todos' : s}
              {counts[s as keyof typeof counts] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({counts[s as keyof typeof counts]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Multi-select filters */}
        <MultiSelectDropdown label="Unidade Operacional" options={filterOptions.operationalUnits} selected={unitFilter} onChange={setUnitFilter} />
        <MultiSelectDropdown label="Embarcador" options={filterOptions.shippers} selected={shipperFilter} onChange={setShipperFilter} />

        {/* Search */}
        <div className="relative flex w-full items-center sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa..."
            className="w-full rounded-lg border border-zinc-300 py-2 pr-3 pl-8 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm text-zinc-500">Carregando manutenções...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <Wrench className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">Nenhuma ordem de serviço encontrada.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50">
                  {[
                    ...(blockWrite ? ['Cliente'] : []),
                    isWorkshopUser ? 'OS da Oficina' : 'OS',
                    'Placa',
                    isWorkshopUser ? 'Cliente' : 'Oficina',
                    'Dias',
                    'Previsão de Saída',
                    'Tipo',
                    'Status',
                    'Orçamento',
                    '',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider whitespace-nowrap text-zinc-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(o => {
                  const days = daysInWorkshop(o.entryDate);
                  return (
                    <tr key={o.id} className="transition-colors hover:bg-zinc-50">
                      {blockWrite && (
                        <td className="px-4 py-3 text-sm whitespace-nowrap text-zinc-600">
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                            {o.clientId ? (clientNameMap.get(o.clientId) ?? o.clientName ?? '—') : (o.clientName ?? '—')}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-sm font-medium whitespace-nowrap text-zinc-900">
                        {isWorkshopUser ? (o.workshopOs || o.os) : o.os}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-zinc-900">
                        {o.licensePlate}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-sm text-zinc-600">
                        {isWorkshopUser ? (o.clientName ?? o.workshop) : o.workshop}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn(
                          'text-sm font-semibold',
                          days > 10 ? 'text-red-600' : days > 5 ? 'text-orange-600' : 'text-zinc-700'
                        )}>
                          {days}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-zinc-600">
                        {formatDate(o.expectedExitDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', typeColor(o.type))}>
                          {o.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', statusColor(o.status))}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {budgetStatusBadge(o.budgetStatus, o.budgetPdfUrl)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(o)}
                            title="Visualizar"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canWriteMaintenance && o.status !== 'Concluído' && o.status !== 'Cancelado' && (
                            <button
                              onClick={() => {
                                setOrderToEdit(o);
                                setIsFormOpen(true);
                              }}
                              title="Editar"
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {canFillWorkshop && canWorkshopFillOrder(o.status) && (
                            <button
                              onClick={() => {
                                setOrderToEdit(o);
                                setIsFormOpen(true);
                              }}
                              title="Preencher OS"
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {canWriteMaintenance && o.status === 'Concluído' && (
                            <button
                              onClick={(e) => handleComplete(o.id, e)}
                              title="Retirar Veículo"
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-green-50 hover:text-green-600"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {canWriteMaintenance && o.status !== 'Veículo retirado' && o.status !== 'Cancelado' && (
                            <select
                              value=""
                              onChange={(e) => {
                                const next = e.target.value;
                                if (next) {
                                  updateStatusMutation.mutate({ id: o.id, status: next as MaintenanceStatus });
                                  e.target.value = '';
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              title="Ações"
                              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition-colors hover:border-orange-300"
                            >
                              <option value="">Ações</option>
                              {o.status === 'Serviço em execução' && (
                                <option value="Concluído">Concluído</option>
                              )}
                              {o.status === 'Concluído' && (
                                <option value="Veículo retirado">Veículo retirado</option>
                              )}
                              <option value="Cancelar">Cancelar</option>
                            </select>
                          )}
                          {canWriteMaintenance && o.status !== 'Concluído' && o.status !== 'Cancelado' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setOrderToCancel(o); }}
                              title="Cancelar OS"
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {canWriteMaintenance && o.status === 'Cancelado' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                 
                                const { id, os, status, createdAt, cancelledAt, cancelledById, ...rest } = o;
                                setPrefillData({ ...rest, status: 'Aguardando orçamento' });
                                setOrderToEdit(null);
                                setIsFormOpen(true);
                              }}
                              title="Reabrir (nova OS)"
                              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            >
                              <RotateCcw className="h-4 w-4" />
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

      {selectedOrder && (
        <MaintenanceDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {isFormOpen && (canWriteMaintenance || canFillWorkshop) && (
        <MaintenanceForm
          order={orderToEdit}
          prefill={prefillData}
          mode={isWorkshopUser ? 'workshop' : 'default'}
          onClose={() => {
            setIsFormOpen(false);
            setOrderToEdit(null);
            setPrefillData(undefined);
            clearMaintenanceDraft();
          }}
          onSave={async (data, budgetItems, budgetFile, pendingPartPhotos) => {
            await saveMutation.mutateAsync({ data, budgetItems, budgetFile, pendingPartPhotos });
          }}
        />
      )}

      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Cancelar Ordem de Serviço</h3>
                <p className="text-sm text-zinc-500">Esta ação não pode ser desfeita diretamente.</p>
              </div>
            </div>
            <div className="space-y-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <div><span className="font-medium text-zinc-700">OS:</span> <span className="font-mono">{orderToCancel.os}</span></div>
              <div><span className="font-medium text-zinc-700">Placa:</span> {orderToCancel.licensePlate}</div>
              <div><span className="font-medium text-zinc-700">Status atual:</span> {orderToCancel.status}</div>
            </div>
            <p className="text-sm text-zinc-600">
              A OS será marcada como <strong>Cancelado</strong> e não contará mais para cálculos de custo.
              Caso seja necessário, você poderá reabrir uma nova OS a partir deste registro.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setOrderToCancel(null)}
                disabled={cancelMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={() => cancelMutation.mutate(orderToCancel)}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
