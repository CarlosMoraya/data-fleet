import React, { useState } from 'react';
import { Wrench, Search, Eye, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import MaintenanceDetailModal from '../components/MaintenanceDetailModal';

export type MaintenanceStatus = 'Aguardando orçamento' | 'Orçamento aprovado' | 'Serviço em execução' | 'Concluído';
export type MaintenanceType = 'Preventiva' | 'Preditiva' | 'Corretiva';

export interface MaintenanceOrder {
  id: string;
  os: string;
  licensePlate: string;
  workshop: string;
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

const MOCK_ORDERS: MaintenanceOrder[] = [
  {
    id: '1', os: 'OS-2026-001', licensePlate: 'ABC-1234', workshop: 'Oficina Central Ltda',
    entryDate: '2026-03-01', expectedExitDate: '2026-03-10', type: 'Corretiva',
    status: 'Serviço em execução', description: 'Troca de motor completo após falha no bloco',
    mechanicName: 'José Carlos', estimatedCost: 12500, approvedCost: 11800,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-01', notes: 'Aguardar peça importada',
  },
  {
    id: '2', os: 'OS-2026-002', licensePlate: 'DEF-5678', workshop: 'AutoTruck Serviços',
    entryDate: '2026-03-05', expectedExitDate: '2026-03-12', type: 'Preventiva',
    status: 'Orçamento aprovado', description: 'Revisão dos 60.000 km — óleo, filtros, correias',
    mechanicName: 'Marcos Oliveira', estimatedCost: 1800, approvedCost: 1800,
    createdBy: 'Mariana Lima', createdAt: '2026-03-05',
  },
  {
    id: '3', os: 'OS-2026-003', licensePlate: 'GHI-9012', workshop: 'Mega Frotas Service',
    entryDate: '2026-03-08', expectedExitDate: '2026-03-15', type: 'Corretiva',
    status: 'Aguardando orçamento', description: 'Falha no sistema de freios ABS — sensor e atuador',
    mechanicName: 'Ricardo Alves', estimatedCost: 3200,
    createdBy: 'Pedro Santos', createdAt: '2026-03-08', notes: 'Veículo parado, prioridade alta',
  },
  {
    id: '4', os: 'OS-2026-004', licensePlate: 'JKL-3456', workshop: 'Oficina Central Ltda',
    entryDate: '2026-03-02', expectedExitDate: '2026-03-07', type: 'Preventiva',
    status: 'Concluído', description: 'Troca de pneus traseiros e balanceamento',
    mechanicName: 'José Carlos', estimatedCost: 2400, approvedCost: 2350,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-02',
  },
  {
    id: '5', os: 'OS-2026-005', licensePlate: 'MNO-7890', workshop: 'RR Diesel Mecânica',
    entryDate: '2026-03-10', expectedExitDate: '2026-03-18', type: 'Preditiva',
    status: 'Aguardando orçamento', description: 'Análise de vibração anormal na transmissão',
    mechanicName: 'Fernanda Costa', estimatedCost: 5500,
    createdBy: 'Mariana Lima', createdAt: '2026-03-10', notes: 'Diagnóstico eletrônico necessário',
  },
  {
    id: '6', os: 'OS-2026-006', licensePlate: 'PQR-1234', workshop: 'AutoTruck Serviços',
    entryDate: '2026-03-03', expectedExitDate: '2026-03-11', type: 'Corretiva',
    status: 'Serviço em execução', description: 'Reparo na caixa de câmbio — trocas de sincronizadores',
    mechanicName: 'Marcos Oliveira', estimatedCost: 7800, approvedCost: 8100,
    createdBy: 'Pedro Santos', createdAt: '2026-03-03',
  },
  {
    id: '7', os: 'OS-2026-007', licensePlate: 'STU-5678', workshop: 'Mega Frotas Service',
    entryDate: '2026-03-07', expectedExitDate: '2026-03-14', type: 'Preventiva',
    status: 'Serviço em execução', description: 'Revisão geral — suspensão, alinhamento e geometria',
    mechanicName: 'Luiz Henrique', estimatedCost: 3100, approvedCost: 3100,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-07',
  },
  {
    id: '8', os: 'OS-2026-008', licensePlate: 'VWX-9012', workshop: 'RR Diesel Mecânica',
    entryDate: '2026-03-12', expectedExitDate: '2026-03-20', type: 'Corretiva',
    status: 'Aguardando orçamento', description: 'Quebra de mola dianteira direita em campo',
    mechanicName: 'Fernanda Costa', estimatedCost: 1900,
    createdBy: 'Mariana Lima', createdAt: '2026-03-12', notes: 'Veículo rebocado até a oficina',
  },
  {
    id: '9', os: 'OS-2026-009', licensePlate: 'YZA-3456', workshop: 'Oficina Central Ltda',
    entryDate: '2026-03-01', expectedExitDate: '2026-03-05', type: 'Preventiva',
    status: 'Concluído', description: 'Troca de filtro de ar e fluido de freio',
    mechanicName: 'José Carlos', estimatedCost: 450, approvedCost: 450,
    createdBy: 'Pedro Santos', createdAt: '2026-03-01',
  },
  {
    id: '10', os: 'OS-2026-010', licensePlate: 'BCD-7890', workshop: 'AutoTruck Serviços',
    entryDate: '2026-03-09', expectedExitDate: '2026-03-17', type: 'Preditiva',
    status: 'Orçamento aprovado', description: 'Inspeção termográfica no sistema elétrico',
    mechanicName: 'Ricardo Alves', estimatedCost: 2200, approvedCost: 2200,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-09', notes: 'Hotspot identificado no alternador',
  },
  {
    id: '11', os: 'OS-2026-011', licensePlate: 'EFG-1234', workshop: 'Mega Frotas Service',
    entryDate: '2026-03-04', expectedExitDate: '2026-03-09', type: 'Corretiva',
    status: 'Concluído', description: 'Substituição do radiador — superaquecimento recorrente',
    mechanicName: 'Luiz Henrique', estimatedCost: 4200, approvedCost: 4050,
    createdBy: 'Mariana Lima', createdAt: '2026-03-04',
  },
  {
    id: '12', os: 'OS-2026-012', licensePlate: 'HIJ-5678', workshop: 'RR Diesel Mecânica',
    entryDate: '2026-03-11', expectedExitDate: '2026-03-19', type: 'Preventiva',
    status: 'Aguardando orçamento', description: 'Revisão dos 90.000 km — velas, bobinas e correia dentada',
    mechanicName: 'Fernanda Costa', estimatedCost: 2800,
    createdBy: 'Pedro Santos', createdAt: '2026-03-11',
  },
  {
    id: '13', os: 'OS-2026-013', licensePlate: 'KLM-9012', workshop: 'Oficina Central Ltda',
    entryDate: '2026-03-06', expectedExitDate: '2026-03-13', type: 'Corretiva',
    status: 'Orçamento aprovado', description: 'Troca de embreagem completa',
    mechanicName: 'José Carlos', estimatedCost: 6500, approvedCost: 6500,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-06', notes: 'Aguardando kit de embreagem',
  },
  {
    id: '14', os: 'OS-2026-014', licensePlate: 'NOP-3456', workshop: 'AutoTruck Serviços',
    entryDate: '2026-03-13', expectedExitDate: '2026-03-21', type: 'Preditiva',
    status: 'Aguardando orçamento', description: 'Análise de óleo — desgaste prematuro identificado',
    mechanicName: 'Marcos Oliveira', estimatedCost: 900,
    createdBy: 'Mariana Lima', createdAt: '2026-03-13',
  },
  {
    id: '15', os: 'OS-2026-015', licensePlate: 'QRS-7890', workshop: 'Mega Frotas Service',
    entryDate: '2026-03-02', expectedExitDate: '2026-03-06', type: 'Corretiva',
    status: 'Concluído', description: 'Substituição do alternador queimado',
    mechanicName: 'Luiz Henrique', estimatedCost: 1600, approvedCost: 1600,
    createdBy: 'Pedro Santos', createdAt: '2026-03-02',
  },
  {
    id: '16', os: 'OS-2026-016', licensePlate: 'TUV-1234', workshop: 'RR Diesel Mecânica',
    entryDate: '2026-03-10', expectedExitDate: '2026-03-16', type: 'Preventiva',
    status: 'Serviço em execução', description: 'Lubrificação geral e inspeção do chassi',
    mechanicName: 'Ricardo Alves', estimatedCost: 650, approvedCost: 650,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-10',
  },
  {
    id: '17', os: 'OS-2026-017', licensePlate: 'WXY-5678', workshop: 'Oficina Central Ltda',
    entryDate: '2026-03-14', expectedExitDate: '2026-03-22', type: 'Corretiva',
    status: 'Aguardando orçamento', description: 'Falha no injetor — perda de potência significativa',
    mechanicName: 'José Carlos', estimatedCost: 4800,
    createdBy: 'Mariana Lima', createdAt: '2026-03-14', notes: 'Veículo em teste de bancada',
  },
  {
    id: '18', os: 'OS-2026-018', licensePlate: 'ZAB-9012', workshop: 'AutoTruck Serviços',
    entryDate: '2026-03-08', expectedExitDate: '2026-03-15', type: 'Preditiva',
    status: 'Concluído', description: 'Análise vibratória — substituição de rolamento de roda',
    mechanicName: 'Marcos Oliveira', estimatedCost: 1100, approvedCost: 1050,
    createdBy: 'Pedro Santos', createdAt: '2026-03-08',
  },
  {
    id: '19', os: 'OS-2026-019', licensePlate: 'CDE-3456', workshop: 'Mega Frotas Service',
    entryDate: '2026-03-15', expectedExitDate: '2026-03-24', type: 'Corretiva',
    status: 'Aguardando orçamento', description: 'Vazamento de óleo no motor — retentores e juntas',
    mechanicName: 'Luiz Henrique', estimatedCost: 2600,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-15',
  },
  {
    id: '20', os: 'OS-2026-020', licensePlate: 'FGH-7890', workshop: 'RR Diesel Mecânica',
    entryDate: '2026-03-05', expectedExitDate: '2026-03-12', type: 'Preventiva',
    status: 'Concluído', description: 'Calibragem de bicos injetores e limpeza do sistema',
    mechanicName: 'Fernanda Costa', estimatedCost: 980, approvedCost: 980,
    createdBy: 'Mariana Lima', createdAt: '2026-03-05',
  },
  {
    id: '21', os: 'OS-2026-021', licensePlate: 'IJK-1234', workshop: 'Oficina Central Ltda',
    entryDate: '2026-03-12', expectedExitDate: '2026-03-19', type: 'Corretiva',
    status: 'Orçamento aprovado', description: 'Substituição de compressor do ar condicionado',
    mechanicName: 'José Carlos', estimatedCost: 3400, approvedCost: 3400,
    createdBy: 'Pedro Santos', createdAt: '2026-03-12', notes: 'Motorista relatou cheiro de queimado',
  },
  {
    id: '22', os: 'OS-2026-022', licensePlate: 'LMN-5678', workshop: 'AutoTruck Serviços',
    entryDate: '2026-03-16', expectedExitDate: '2026-03-25', type: 'Preditiva',
    status: 'Aguardando orçamento', description: 'Monitoramento de temperatura do turbo — sinais de falha iminente',
    mechanicName: 'Ricardo Alves', estimatedCost: 8500,
    createdBy: 'Alexandre Souza', createdAt: '2026-03-16',
  },
];

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
  const [orders, setOrders] = useState<MaintenanceOrder[]>(MOCK_ORDERS);
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);

  const counts = {
    all: orders.length,
    'Aguardando orçamento': orders.filter(o => o.status === 'Aguardando orçamento').length,
    'Orçamento aprovado':   orders.filter(o => o.status === 'Orçamento aprovado').length,
    'Serviço em execução':  orders.filter(o => o.status === 'Serviço em execução').length,
    'Concluído':            orders.filter(o => o.status === 'Concluído').length,
    corretiva:              orders.filter(o => o.type === 'Corretiva').length,
    preventiva:             orders.filter(o => o.type === 'Preventiva').length,
  };

  const filtered = orders.filter(o => {
    const matchTab = activeTab === 'all' || o.status === activeTab;
    const matchSearch = !search || o.licensePlate.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const handleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Concluído' } : o));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-orange-500" />
          Manutenção
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Acompanhe as ordens de serviço e o status dos veículos em manutenção</p>
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
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {filtered.length === 0 ? (
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
    </div>
  );
}
