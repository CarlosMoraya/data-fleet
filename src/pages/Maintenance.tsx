import React from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench, Search, Eye, CheckCircle2, Loader2, Plus, Edit, ExternalLink, Ban, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import MaintenanceDetailModal from '../components/MaintenanceDetailModal';
import MaintenanceForm from '../components/MaintenanceForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { maintenanceFromRow, MaintenanceOrderRow, BudgetStatus, BudgetItem } from '../lib/maintenanceMappers';
import { uploadMaintenanceBudget } from '../lib/storageHelpers';
import { useAuth } from '../context/AuthContext';

export type MaintenanceStatus = 'Aguardando orçamento' | 'Aguardando aprovação' | 'Orçamento aprovado' | 'Serviço em execução' | 'Concluído' | 'Cancelado';
export type MaintenanceType = 'Preventiva' | 'Preditiva' | 'Corretiva';

export interface MaintenanceOrder {
  id: string;
  os: string;
  licensePlate: string;
  workshop: string;
  vehicleId: string;
  workshopId: string;
  entryDate: string;
  expectedExitDate: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  description: string;
  mechanicName: string;
  estimatedCost: number;
  approvedCost?: number;
  createdBy: string;
  createdAt: string;
  notes?: string;
  workshopOs?: string;
  currentKm?: number;
  budgetPdfUrl?: string;
  budgetStatus?: BudgetStatus;
  budgetReviewedBy?: string;
  budgetReviewedAt?: string;
  cancelledAt?: string;
  cancelledById?: string;
  clientName?: string; // Populado quando Workshop vê múltiplas transportadoras
  clientId?: string;   // client_id da OS; necessário para Workshop no modo "Todos os Clientes"
}

type StatusFilter = MaintenanceStatus | 'all';

const ALL_STATUSES: StatusFilter[] = [
  'all',
  'Aguardando orçamento',
  'Aguardando aprovação',
  'Orçamento aprovado',
  'Serviço em execução',
  'Concluído',
  'Cancelado',
];

function statusColor(status: MaintenanceStatus) {
  switch (status) {
    case 'Aguardando orçamento': return 'bg-yellow-100 text-yellow-800';
    case 'Aguardando aprovação': return 'bg-orange-100 text-orange-800';
    case 'Orçamento aprovado':   return 'bg-blue-100 text-blue-800';
    case 'Serviço em execução':  return 'bg-purple-100 text-purple-800';
    case 'Concluído':            return 'bg-green-100 text-green-800';
    case 'Cancelado':            return 'bg-zinc-100 text-zinc-500';
  }
}

function budgetStatusBadge(budgetStatus?: BudgetStatus, pdfUrl?: string) {
  if (!budgetStatus || budgetStatus === 'sem_orcamento') return null;
  const colors: Record<string, string> = {
    pendente:  'bg-yellow-100 text-yellow-800',
    aprovado:  'bg-green-100 text-green-800',
    reprovado: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    pendente:  'Aguardando',
    aprovado:  'Aprovado',
    reprovado: 'Reprovado',
  };
  return (
    <div className="flex items-center gap-1">
      <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', colors[budgetStatus] ?? 'bg-zinc-100 text-zinc-600')}>
        {labels[budgetStatus] ?? budgetStatus}
      </span>
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="p-0.5 rounded text-zinc-400 hover:text-blue-600"
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
    case 'Corretiva':  return 'bg-red-100 text-red-800';
    case 'Preventiva': return 'bg-blue-100 text-blue-800';
    case 'Preditiva':  return 'bg-purple-100 text-purple-800';
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

export default function Maintenance() {
  const { currentClient, user: profile } = useAuth();
  const isWorkshopUser = profile?.role === 'Workshop';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<StatusFilter>('all');
  const [search, setSearch] = React.useState('');
  const [selectedOrder, setSelectedOrder] = React.useState<MaintenanceOrder | null>(null);

  const location = useLocation();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [orderToEdit, setOrderToEdit] = React.useState<MaintenanceOrder | null>(null);
  const [prefillData, setPrefillData] = React.useState<Partial<MaintenanceOrder> | undefined>(
    () => (location.state as any)?.prefillMaintenance ?? undefined
  );
  const [orderToCancel, setOrderToCancel] = React.useState<MaintenanceOrder | null>(null);

  // Abrir form automaticamente se vier do fluxo agendamento → manutenção
  React.useEffect(() => {
    if (prefillData) {
      setOrderToEdit(null);
      setIsFormOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { activeWorkshopId, workshopPartnerships } = useAuth();
  const isMultiWorkshop = isWorkshopUser && workshopPartnerships.length > 1;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['maintenanceOrders', currentClient?.id, activeWorkshopId],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_orders')
        .select(`
          *,
          vehicles (license_plate),
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
    enabled: isWorkshopUser
      ? (isMultiWorkshop || !!(activeWorkshopId ?? profile?.workshopId))
      : !!currentClient?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceStatus }) => {
      const { error } = await supabase
        .from('maintenance_orders')
        .update({ status, actual_exit_date: status === 'Concluído' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (order: MaintenanceOrder) => {
      const { error } = await supabase
        .from('maintenance_orders')
        .update({
          status: 'Cancelado',
          cancelled_at: new Date().toISOString(),
          cancelled_by_id: profile?.id ?? null,
        })
        .eq('id', order.id);
      if (error) throw error;
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
    }: {
      data: Partial<MaintenanceOrder>;
      budgetItems: BudgetItem[];
      budgetFile: File | null;
    }) => {
      const isWorkshopSave = profile?.role === 'Workshop';
      // Para Workshop no modo "Todos os Clientes", currentClient pode ser null.
      // Usamos o client_id da própria OS (data.clientId) para upload e budget items.
      const effectiveClientId = isWorkshopSave ? (data.clientId ?? currentClient?.id) : currentClient?.id;
      if (!effectiveClientId || !profile) throw new Error('Sessão inválida');

      const commonFields: any = {
        client_id: effectiveClientId,
        vehicle_id: data.vehicleId,
        workshop_id: data.workshopId,
        entry_date: data.entryDate,
        expected_exit_date: data.expectedExitDate || null,
        type: data.type,
        status: data.status,
        description: data.description || null,
        mechanic_name: data.mechanicName || null,
        estimated_cost: data.estimatedCost || 0,
        approved_cost: data.approvedCost || null,
        notes: data.notes || null,
        workshop_os_number: data.workshopOs || null,
        current_km: data.currentKm || null,
      };

      let orderId: string;

      if (data.id) {
        // UPDATE — os_number é imutável, nunca atualizar
        // Workshop faz partial update: apenas os campos de sua responsabilidade
        const updateFields = profile?.role === 'Workshop'
          ? {
              expected_exit_date: data.expectedExitDate || null,
              workshop_os_number: data.workshopOs || null,
              mechanic_name: data.mechanicName || null,
              current_km: data.currentKm || null,
            }
          : commonFields;
        const { error } = await supabase.from('maintenance_orders').update(updateFields).eq('id', data.id);
        if (error) throw error;
        orderId = data.id;
      } else {
        // INSERT — gerar OS Interna automaticamente
        const d = new Date();
        const yy = d.getFullYear().toString().slice(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const osNumber = `OS-${yy}${mm}-${rand}`;
        const { data: inserted, error } = await supabase
          .from('maintenance_orders')
          .insert([{ ...commonFields, os_number: osNumber, created_by_id: profile.id }])
          .select('id')
          .single();
        if (error) throw error;
        orderId = inserted.id;
      }

      // Passo 2: se há PDF, fazer upload e atualizar campos de orçamento
      if (budgetFile) {
        const pdfUrl = await uploadMaintenanceBudget(effectiveClientId, orderId, budgetFile);
        const { error: updateErr } = await supabase
          .from('maintenance_orders')
          .update({
            budget_pdf_url: pdfUrl,
            budget_status: 'pendente',
            status: 'Aguardando aprovação',
          })
          .eq('id', orderId);
        if (updateErr) throw updateErr;
      }

      // Passo 3: substituir itens de orçamento
      const hasSignificantItems = budgetItems.some(i => i.itemName.trim().length > 0);
      if (hasSignificantItems || budgetFile) {
        await supabase.from('maintenance_budget_items').delete().eq('maintenance_order_id', orderId);
        const significantItems = budgetItems.filter(i => i.itemName.trim().length > 0);
        if (significantItems.length > 0) {
          const rows = significantItems.map((item, idx) => ({
            maintenance_order_id: orderId,
            client_id: effectiveClientId,
            item_name: item.itemName,
            system: item.system || null,
            quantity: item.quantity,
            value: item.value,
            sort_order: idx,
          }));
          const { error: insertErr } = await supabase.from('maintenance_budget_items').insert(rows);
          if (insertErr) throw insertErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['budgetApprovals'] });
      setIsFormOpen(false);
      setOrderToEdit(null);
    },
  });

  const counts = React.useMemo(() => {
    return {
      all:                      orders.length,
      'Aguardando orçamento':   orders.filter(o => o.status === 'Aguardando orçamento').length,
      'Aguardando aprovação':   orders.filter(o => o.status === 'Aguardando aprovação').length,
      'Orçamento aprovado':     orders.filter(o => o.status === 'Orçamento aprovado').length,
      'Serviço em execução':    orders.filter(o => o.status === 'Serviço em execução').length,
      'Concluído':              orders.filter(o => o.status === 'Concluído').length,
      'Cancelado':              orders.filter(o => o.status === 'Cancelado').length,
      corretiva:                orders.filter(o => o.type === 'Corretiva').length,
      preventiva:               orders.filter(o => o.type === 'Preventiva').length,
    };
  }, [orders]);

  const filtered = React.useMemo(() => {
    return orders.filter(o => {
      const matchTab = activeTab === 'all' || o.status === activeTab;
      const matchSearch = !search || o.licensePlate.toLowerCase().includes(search.toLowerCase()) || o.os.toLowerCase().includes(search.toLowerCase());
      return matchTab && matchSearch;
    });
  }, [orders, activeTab, search]);

  const handleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ id, status: 'Concluído' });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-orange-500" />
            Manutenção
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Acompanhe as ordens de serviço e o status dos veículos em manutenção</p>
        </div>

        {!isWorkshopUser && (
          <button
            onClick={() => {
              setOrderToEdit(null);
              setIsFormOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 sm:py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nova Manutenção
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'all' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-zinc-900">{counts.all}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total em Manutenção</p>
        </button>
        <button
          onClick={() => setActiveTab('Aguardando orçamento')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Aguardando orçamento' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-yellow-600">{counts['Aguardando orçamento']}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Aguardando Orçamento</p>
        </button>
        <button
          onClick={() => setActiveTab('Aguardando aprovação')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Aguardando aprovação' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-orange-600">{counts['Aguardando aprovação']}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Ag. Aprovação</p>
        </button>
        <button
          onClick={() => setActiveTab('Serviço em execução')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Serviço em execução' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-purple-600">{counts['Serviço em execução']}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Em Execução</p>
        </button>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left">
          <p className="text-2xl font-bold text-red-600">{counts.corretiva}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total Corretiva</p>
        </div>
        <button
          onClick={() => setActiveTab('Cancelado')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-zinc-400',
            activeTab === 'Cancelado' ? 'border-zinc-500 bg-zinc-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-zinc-400">{counts['Cancelado']}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Cancelados</p>
        </button>
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
              {s === 'all' ? 'Todos' : s}
              {counts[s as keyof typeof counts] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({counts[s as keyof typeof counts]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto w-full sm:w-64 flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por placa..."
            className="w-full pl-8 pr-3 rounded-lg border border-zinc-300 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden relative flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
              <p className="text-sm text-zinc-500">Carregando manutenções...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma ordem de serviço encontrada.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50">
                  {[
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
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(o => {
                  const days = daysInWorkshop(o.entryDate);
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-zinc-900 whitespace-nowrap">
                        {isWorkshopUser ? (o.workshopOs || o.os) : o.os}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900 whitespace-nowrap">
                        {o.licensePlate}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 max-w-[140px] truncate">
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
                      <td className="px-4 py-3 text-sm text-zinc-600 whitespace-nowrap">
                        {formatDate(o.expectedExitDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', typeColor(o.type))}>
                          {o.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', statusColor(o.status))}>
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
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {o.status !== 'Concluído' && o.status !== 'Cancelado' && (
                            <button
                              onClick={() => {
                                setOrderToEdit(o);
                                setIsFormOpen(true);
                              }}
                              title="Editar"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {o.status !== 'Concluído' && o.status !== 'Cancelado' && !isWorkshopUser && (
                            <button
                              onClick={(e) => handleComplete(o.id, e)}
                              title="Marcar como Concluído"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {o.status !== 'Concluído' && o.status !== 'Cancelado' && !isWorkshopUser && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setOrderToCancel(o); }}
                              title="Cancelar OS"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {o.status === 'Cancelado' && !isWorkshopUser && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const { id, os, status, createdAt, cancelledAt, cancelledById, ...rest } = o;
                                setPrefillData({ ...rest, status: 'Aguardando orçamento' });
                                setOrderToEdit(null);
                                setIsFormOpen(true);
                              }}
                              title="Reabrir (nova OS)"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
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

      {isFormOpen && (
        <MaintenanceForm
          order={orderToEdit}
          prefill={prefillData}
          mode={isWorkshopUser ? 'workshop' : 'default'}
          onClose={() => {
            setIsFormOpen(false);
            setOrderToEdit(null);
            setPrefillData(undefined);
          }}
          onSave={async (data, budgetItems, budgetFile) =>
            saveMutation.mutateAsync({ data, budgetItems, budgetFile })
          }
        />
      )}

      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Cancelar Ordem de Serviço</h3>
                <p className="text-sm text-zinc-500">Esta ação não pode ser desfeita diretamente.</p>
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm space-y-1">
              <div><span className="font-medium text-zinc-700">OS:</span> <span className="font-mono">{orderToCancel.os}</span></div>
              <div><span className="font-medium text-zinc-700">Placa:</span> {orderToCancel.licensePlate}</div>
              <div><span className="font-medium text-zinc-700">Status atual:</span> {orderToCancel.status}</div>
            </div>
            <p className="text-sm text-zinc-600">
              A OS será marcada como <strong>Cancelado</strong> e não contará mais para cálculos de custo.
              Caso seja necessário, você poderá reabrir uma nova OS a partir deste registro.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setOrderToCancel(null)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={() => cancelMutation.mutate(orderToCancel)}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
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
