import React from 'react';
import {
  Truck,
  Wrench,
  CheckCircle2,
  ClipboardList,
  AlertTriangle,
  Clock,
  DollarSign,
  ListChecks,
  Loader2,
} from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface OverviewPanelProps {
  totalVehicles: number;
  vehiclesInMaintenance: number;
  availabilityRate: number;
  openOrdersCount: number;
  overdueOrdersCount: number;
  pendingApprovalCount: number;
  totalApprovedCost: number;
  complianceRate: number;
  isLoading?: boolean;
}

export default function OverviewPanel({
  totalVehicles,
  vehiclesInMaintenance,
  availabilityRate,
  openOrdersCount,
  overdueOrdersCount,
  pendingApprovalCount,
  totalApprovedCost,
  complianceRate,
  isLoading = false,
}: OverviewPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-zinc-900">Situação atual da frota</h3>
        <p className="text-sm text-zinc-500">Retrato de agora — não depende do período</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <DashboardKpiCard
          icon={Truck}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="Total de Veículos"
          value={totalVehicles}
        />
        <DashboardKpiCard
          icon={Wrench}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          label="Veículos em Manutenção"
          value={vehiclesInMaintenance}
        />
        <DashboardKpiCard
          icon={CheckCircle2}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          label="Disponibilidade da Frota"
          value={`${availabilityRate}%`}
        />
        <DashboardKpiCard
          icon={ClipboardList}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="OS Abertas"
          value={openOrdersCount}
        />
        <DashboardKpiCard
          icon={AlertTriangle}
          iconBgClass="bg-red-50"
          iconColorClass="text-red-600"
          label="OS em Atraso"
          value={overdueOrdersCount}
          isAlert
        />
        <DashboardKpiCard
          icon={Clock}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          label="OS Aguardando Aprovação"
          value={pendingApprovalCount}
        />
        <DashboardKpiCard
          icon={DollarSign}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          label="Custo do Mês Atual"
          value={fmt.format(totalApprovedCost)}
          subtitle="mês corrente"
        />
        <DashboardKpiCard
          icon={ListChecks}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="Conformidade de Checklist"
          value={`${complianceRate}%`}
          subtitle="veículos com checklist em dia"
        />
      </div>
    </div>
  );
}
