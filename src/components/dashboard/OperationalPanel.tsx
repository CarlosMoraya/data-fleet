import { Truck, UserX, Wrench, Clock, CalendarClock, CalendarDays, ListChecks, ClipboardList, Loader2 } from 'lucide-react';
import React from 'react';

import ActionQueue from './ActionQueue';
import DashboardKpiCard from './DashboardKpiCard';

import type { OperationalActionCategory, OperationalActionItem } from '../../lib/dashboardKpi';

export interface VehicleRow {
  id: string;
  active?: boolean;
  type: string;
  crlv_year: string | null;
  crlv_expiration_date: string | null;
  driver_id: string | null;
  client_id?: string | null;
  license_plate?: string | null;
  gr_expiration_date?: string | null;
  initial_km?: number | null;
  shipper_name?: string | null;
  operational_unit_name?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  acquisition?: string | null;
  crlv_upload?: string | null;
  gr_upload?: string | null;
  insurance_policy_upload?: string | null;
  has_insurance?: boolean | null;
  has_maintenance_contract?: boolean | null;
  maintenance_contract_upload?: string | null;
  tracker?: string | null;
}

export interface DashboardFilters {
  vehicleType: string | null;
  maintenanceType: string | null;
}

interface OperationalPanelProps {
  unavailableVehiclesCount: number;
  vehiclesWithoutDriverCount: number;
  openOrdersCount: number;
  overdueOrdersCount: number;
  exitByEndOfWeekCount: number;
  pendingApprovalCount: number;
  overdueChecklistsCount: number;
  openActionPlansCount: number;
  actionItems: OperationalActionItem[];
  onActionClick?: (category: OperationalActionCategory) => void;
  isLoading?: boolean;
}

export default function OperationalPanel({
  unavailableVehiclesCount,
  vehiclesWithoutDriverCount,
  openOrdersCount,
  overdueOrdersCount,
  exitByEndOfWeekCount,
  pendingApprovalCount,
  overdueChecklistsCount,
  openActionPlansCount,
  actionItems,
  onActionClick,
  isLoading = false,
}: OperationalPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Resolver agora</h3>
          <p className="text-sm text-zinc-500">O que impede a frota de rodar hoje</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <DashboardKpiCard
            icon={Truck}
            iconBgClass="bg-red-50"
            iconColorClass="text-red-600"
            label="Veículos Indisponíveis"
            value={unavailableVehiclesCount}
            isAlert
            onClick={onActionClick ? () => onActionClick('vehicles_unavailable') : undefined}
          />
          <DashboardKpiCard
            icon={UserX}
            iconBgClass="bg-amber-50"
            iconColorClass="text-amber-600"
            label="Veículos sem Motorista"
            value={vehiclesWithoutDriverCount}
            onClick={onActionClick ? () => onActionClick('vehicles_no_driver') : undefined}
          />
          <DashboardKpiCard
            icon={Wrench}
            iconBgClass="bg-blue-50"
            iconColorClass="text-blue-600"
            label="OS Abertas"
            value={openOrdersCount}
            onClick={onActionClick ? () => onActionClick('os_open') : undefined}
          />
          <DashboardKpiCard
            icon={Clock}
            iconBgClass="bg-sky-50"
            iconColorClass="text-sky-600"
            label="OS com Prazo Vencido"
            value={overdueOrdersCount}
            isAlert
            onClick={onActionClick ? () => onActionClick('os_overdue') : undefined}
          />
          <DashboardKpiCard
            icon={CalendarClock}
            iconBgClass="bg-orange-50"
            iconColorClass="text-orange-600"
            label="Saída Prevista até Fim da Semana"
            value={exitByEndOfWeekCount}
            onClick={onActionClick ? () => onActionClick('os_exit_this_week') : undefined}
          />
          <DashboardKpiCard
            icon={CalendarDays}
            iconBgClass="bg-violet-50"
            iconColorClass="text-violet-600"
            label="OS Aguardando Aprovação"
            value={pendingApprovalCount}
            onClick={onActionClick ? () => onActionClick('os_pending_approval') : undefined}
          />
          <DashboardKpiCard
            icon={ListChecks}
            iconBgClass="bg-yellow-50"
            iconColorClass="text-yellow-600"
            label="Checklists Vencidos"
            value={overdueChecklistsCount}
            isAlert
            onClick={onActionClick ? () => onActionClick('checklist_overdue') : undefined}
          />
          <DashboardKpiCard
            icon={ClipboardList}
            iconBgClass="bg-emerald-50"
            iconColorClass="text-emerald-600"
            label="Planos de Ação Abertos"
            value={openActionPlansCount}
            onClick={onActionClick ? () => onActionClick('action_plans_open') : undefined}
          />
        </div>
      </div>

      <ActionQueue
        items={actionItems}
        onItemClick={onActionClick ? (category) => onActionClick(category as OperationalActionCategory) : undefined}
        title="Fila de Ação Operacional"
      />
    </div>
  );
}
