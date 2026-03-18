import React from 'react';
import { Wrench, Search, Eye, CheckCircle2, Loader2, Plus, Edit } from 'lucide-react';
import { cn } from '../lib/utils';
import MaintenanceDetailModal from '../components/MaintenanceDetailModal';
import MaintenanceForm from '../components/MaintenanceForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { maintenanceFromRow, MaintenanceOrderRow } from '../lib/maintenanceMappers';
import { useAuth } from '../context/AuthContext';

export type MaintenanceStatus = 'Aguardando orçamento' | 'Orçamento aprovado' | 'Serviço em execução' | 'Concluído';
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
}

type StatusFilter = MaintenanceStatus | 'all';

const ALL_STATUSES: StatusFilter[] = ['all', 'Aguardando orçamento', 'Orçamento aprovado', 'Serviço em execução', 'Concluído'];

function statusColor(status: MaintenanceStatus) {
  switch (status) {
    case 'Aguardando orçamento': return 'bg-yellow-100 text-yellow-800';
    case 'Orçamento aprovado':   return 'bg-blue-100 text-blue-800';
    case 'Serviço em execução':  return 'bg-orange-100 text-orange-800';
    case 'Concluído':            return 'bg-green-100 text-green-800';
  }
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
  const { currentClient, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<StatusFilter>('all');
  const [search, setSearch] = React.useState('');
  const [selectedOrder, setSelectedOrder] = React.useState<MaintenanceOrder | null>(null);
  
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [orderToEdit, setOrderToEdit] = React.useState<MaintenanceOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['maintenanceOrders', currentClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select(`
          *,
          vehicles (license_plate),
          workshops (name),
          profiles (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as MaintenanceOrderRow[]).map(maintenanceFromRow);
    },
    enabled: !!currentClient?.id,
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

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<MaintenanceOrder>) => {
      if (!currentClient || !profile) throw new Error('Sessão inválida');

      let osNumber = data.os;
      if (!osNumber) {
        // Format OS-YYMM-XXXX
        const d = new Date();
        const yy = d.getFullYear().toString().slice(-2);
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        osNumber = `OS-${yy}${mm}-${rand}`;
      }

      const payload: any = {
        client_id: currentClient.id,
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
        os_number: osNumber,
      };

      if (data.id) {
        const { error } = await supabase.from('maintenance_orders').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        payload.created_by_id = profile.id;
        const { error } = await supabase.from('maintenance_orders').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceOrders', currentClient?.id] });
      setIsFormOpen(false);
      setOrderToEdit(null);
    },
  });

  const counts = React.useMemo(() => {
    return {
      all: orders.length,
      'Aguardando orçamento': orders.filter(o => o.status === 'Aguardando orçamento').length,
      'Orçamento aprovado':   orders.filter(o => o.status === 'Orçamento aprovado').length,
      'Serviço em execução':  orders.filter(o => o.status === 'Serviço em execução').length,
      'Concluído':            orders.filter(o => o.status === 'Concluído').length,
      corretiva:              orders.filter(o => o.type === 'Corretiva').length,
      preventiva:             orders.filter(o => o.type === 'Preventiva').length,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-orange-500" />
            Manutenção
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Acompanhe as ordens de serviço e o status dos veículos em manutenção</p>
        </div>
        
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
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          onClick={() => setActiveTab('Serviço em execução')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors hover:border-orange-300',
            activeTab === 'Serviço em execução' ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 bg-white',
          )}
        >
          <p className="text-2xl font-bold text-orange-600">{counts['Serviço em execução']}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Em Execução</p>
        </button>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left">
          <p className="text-2xl font-bold text-red-600">{counts.corretiva}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total Corretiva</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left">
          <p className="text-2xl font-bold text-blue-600">{counts.preventiva}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total Preventiva</p>
        </div>
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
              {counts[s] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({counts[s]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
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
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden min-h-[400px] relative">
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100">
              <thead>
                <tr className="bg-zinc-50">
                  {['OS', 'Placa', 'Oficina', 'Dias em Oficina', 'Previsão de Saída', 'Tipo', 'Status', ''].map(h => (
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
                        {o.os}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900 whitespace-nowrap">
                        {o.licensePlate}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 max-w-[160px] truncate">
                        {o.workshop}
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(o)}
                            title="Visualizar"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {o.status !== 'Concluído' && (
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

                          {o.status !== 'Concluído' && (
                            <button
                              onClick={(e) => handleComplete(o.id, e)}
                              title="Marcar como Concluído"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            >
                              <CheckCircle2 className="h-4 w-4" />
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
          onClose={() => {
            setIsFormOpen(false);
            setOrderToEdit(null);
          }}
          onSave={async (data) => saveMutation.mutateAsync(data)}
        />
      )}
    </div>
  );
}
