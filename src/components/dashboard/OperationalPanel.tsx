import React, { useMemo, lazy, Suspense } from 'react';
import { Truck, Wrench, CalendarDays, FileWarning, UserX, Loader2, Clock, Hourglass, CalendarClock } from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';
import ActionQueue from './ActionQueue';
import RouteFallback from '../RouteFallback';
import {
  buildActiveMaintenanceTypeData,
  countActiveInMaintenance,
  calculateAverageMaintenanceDays,
  calculateAverageOpenOrderAgeDays,
  buildMaintenanceStatusData,
  isCrlvExpired,
} from '../../lib/dashboardKpi';
import type { ActionItem } from '../../lib/dashboardKpi';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';

const VehicleTypeBarChart = lazy(() => import('./VehicleTypeBarChart'));
const MaintenanceTypeDonutChart = lazy(() => import('./MaintenanceTypeDonutChart'));

export interface VehicleRow {
  id: string;
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
}

export interface DashboardFilters {
  vehicleType: string | null;
  maintenanceType: string | null;
}

const VEHICLE_TYPES = ['Passeio', 'Utilitário', 'Van', 'Moto', 'Vuc', 'Toco', 'Truck', 'Cavalo'];
const MAINTENANCE_TYPES = ['Corretiva', 'Preventiva', 'Preditiva'] as const;

interface OperationalPanelProps {
  vehicles: VehicleRow[];
  maintenanceOrders: MaintenanceOrderDashboard[];
  activeMaintenanceOrders: MaintenanceOrderDashboard[];
  overdueChecklistVehicleIds: Set<string>;
  expiredCrlvCount: number;
  expiredCnhCount: number;
  overdueOrdersCount: number;
  expiringSoonDocsCount: number;
  actionItems: ActionItem[];
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  onActionClick?: (category: ActionItem['category']) => void;
  isLoading?: boolean;
}

export default function OperationalPanel({
  vehicles,
  maintenanceOrders,
  activeMaintenanceOrders,
  overdueChecklistVehicleIds,
  expiredCrlvCount,
  expiredCnhCount,
  overdueOrdersCount,
  expiringSoonDocsCount,
  actionItems,
  filters,
  onFiltersChange,
  onActionClick,
  isLoading = false,
}: OperationalPanelProps) {
  // Apply filters client-side
  const { filteredVehicles, filteredOrders } = useMemo(() => {
    let fv = vehicles;
    let fo = maintenanceOrders;

    if (filters.vehicleType) {
      fv = vehicles.filter((v) => v.type === filters.vehicleType);
      const vIds = new Set(fv.map((v) => v.id));
      fo = maintenanceOrders.filter((o) => vIds.has(o.vehicle_id));
    }

    if (filters.maintenanceType) {
      fo = fo.filter((o) => o.type === filters.maintenanceType);
      if (!filters.vehicleType) {
        const vIds = new Set(fo.map((o) => o.vehicle_id));
        fv = vehicles.filter((v) => vIds.has(v.id));
      }
    }

    return { filteredVehicles: fv, filteredOrders: fo };
  }, [vehicles, maintenanceOrders, filters]);

  const totalVehicles = filteredVehicles.length;
  // O KPI "Em Manutenção" reflete estado operacional atual e não é afetado pelo filtro de tipo de manutenção.
  const inMaintenance = countActiveInMaintenance(activeMaintenanceOrders, vehicles, filters.vehicleType);

  const overdueChecklists = filters.vehicleType
    ? filteredVehicles.filter((v) => overdueChecklistVehicleIds.has(v.id)).length
    : overdueChecklistVehicleIds.size;

  const currentYear = new Date().getFullYear().toString();
  const today = new Date().toISOString().split('T')[0];
  const expiredCrlv = filters.vehicleType
    ? filteredVehicles.filter((v) => isCrlvExpired(v, currentYear, today)).length
    : expiredCrlvCount;

  const avgMaintenanceDays = calculateAverageMaintenanceDays(maintenanceOrders);
  const avgOpenOrderAgeDays = calculateAverageOpenOrderAgeDays(activeMaintenanceOrders, today);
  const maintenanceStatusData = buildMaintenanceStatusData(activeMaintenanceOrders);

  // Bar chart: vehicles por tipo
  const vehicleTypeData = VEHICLE_TYPES.map((t) => ({
    name: t,
    value: vehicles.filter((v) => v.type === t).length,
  }));

  // Bar chart: frota por embarcador
  const vehicleByShipperData = useMemo(() => {
    const names = [...new Set(vehicles.map((v) => v.shipper_name ?? 'Sem Embarcador'))];
    return names.map((name) => ({
      name,
      value: filteredVehicles.filter((v) => (v.shipper_name ?? 'Sem Embarcador') === name).length,
    })).filter((d) => d.value > 0);
  }, [vehicles, filteredVehicles]);

  // Bar chart: frota por unidade operacional
  const vehicleByOpUnitData = useMemo(() => {
    const names = [...new Set(vehicles.map((v) => v.operational_unit_name ?? 'Sem Unidade'))];
    return names.map((name) => ({
      name,
      value: filteredVehicles.filter((v) => (v.operational_unit_name ?? 'Sem Unidade') === name).length,
    })).filter((d) => d.value > 0);
  }, [vehicles, filteredVehicles]);

  // Donut: ordens ativas por tipo de manutenção (filtrado por vehicleType se ativo)
  const maintenanceTypeData = buildActiveMaintenanceTypeData(
    activeMaintenanceOrders,
    vehicles,
    filters.vehicleType
  );

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <DashboardKpiCard
            icon={Clock}
            iconBgClass="bg-sky-50"
            iconColorClass="text-sky-600"
            label="OS em Atraso"
            value={overdueOrdersCount}
            isAlert
            onClick={onActionClick ? () => onActionClick('os_overdue') : undefined}
          />
          <DashboardKpiCard
            icon={CalendarDays}
            iconBgClass="bg-orange-50"
            iconColorClass="text-orange-600"
            label="Checklists Vencidos"
            value={overdueChecklists}
            isAlert
            onClick={onActionClick ? () => onActionClick('checklist') : undefined}
          />
          <DashboardKpiCard
            icon={FileWarning}
            iconBgClass="bg-yellow-50"
            iconColorClass="text-yellow-600"
            label="CRLVs Vencidos"
            value={expiredCrlv}
            isAlert
            onClick={onActionClick ? () => onActionClick('crlv') : undefined}
          />
          <DashboardKpiCard
            icon={UserX}
            iconBgClass="bg-red-50"
            iconColorClass="text-red-600"
            label="CNHs Vencidas"
            value={expiredCnhCount}
            isAlert
            onClick={onActionClick ? () => onActionClick('cnh') : undefined}
          />
          <DashboardKpiCard
            icon={CalendarClock}
            iconBgClass="bg-amber-50"
            iconColorClass="text-amber-600"
            label="Documentos a Vencer (30d)"
            value={expiringSoonDocsCount}
            isAlert
            onClick={onActionClick ? () => onActionClick('crlv_expiring') : undefined}
          />
        </div>
      </div>

      <ActionQueue items={actionItems} onItemClick={onActionClick} />

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Panorama operacional</h3>
          <p className="text-sm text-zinc-500">Indicadores de contexto da frota</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <DashboardKpiCard
            icon={Truck}
            iconBgClass="bg-blue-50"
            iconColorClass="text-blue-600"
            label="Total de Veículos"
            value={totalVehicles}
            variant="muted"
          />
          <DashboardKpiCard
            icon={Wrench}
            iconBgClass="bg-amber-50"
            iconColorClass="text-amber-600"
            label="Em Manutenção"
            value={inMaintenance}
            variant="muted"
          />
          <DashboardKpiCard
            icon={Clock}
            iconBgClass="bg-sky-50"
            iconColorClass="text-sky-600"
            label="Tempo médio de OS"
            value={avgMaintenanceDays != null ? `${avgMaintenanceDays} dias` : '—'}
            subtitle="OS concluídas no mês"
            variant="muted"
          />
          <DashboardKpiCard
            icon={Hourglass}
            iconBgClass="bg-violet-50"
            iconColorClass="text-violet-600"
            label="Idade média de OS abertas"
            value={avgOpenOrderAgeDays != null ? `${avgOpenOrderAgeDays} dias` : '—'}
            subtitle="OS ainda abertas"
            variant="muted"
          />
        </div>
      </div>

      {/* Charts */}
      <Suspense fallback={<RouteFallback />}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {maintenanceStatusData.length > 0 && (
            <VehicleTypeBarChart
              data={maintenanceStatusData}
              activeFilter={null}
              onFilterChange={() => { }}
              title="Fila de Manutenção por Status"
            />
          )}
          {vehicleByOpUnitData.length > 0 && (
            <VehicleTypeBarChart
              data={vehicleByOpUnitData}
              activeFilter={null}
              onFilterChange={() => { }}
              title="Frota por Unidade Operacional"
            />
          )}
          {vehicleByShipperData.length > 0 && (
            <VehicleTypeBarChart
              data={vehicleByShipperData}
              activeFilter={null}
              onFilterChange={() => { }}
              title="Frota por Embarcador"
            />
          )}
          <VehicleTypeBarChart
            data={vehicleTypeData}
            activeFilter={filters.vehicleType}
            onFilterChange={(t) => onFiltersChange({ ...filters, vehicleType: t })}
            title="Frota por Tipo de Veículo"
          />
          <MaintenanceTypeDonutChart
            data={maintenanceTypeData}
            activeFilter={filters.maintenanceType}
            onFilterChange={(t) =>
              onFiltersChange({ ...filters, maintenanceType: t })
            }
            title="Manutenções por Tipo"
          />
        </div>
      </Suspense>
    </div>
  );
}
