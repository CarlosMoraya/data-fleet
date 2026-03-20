import React, { useMemo } from 'react';
import { Truck, Wrench, CalendarDays, FileWarning, UserX, Loader2 } from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';
import VehicleTypeBarChart from './VehicleTypeBarChart';
import MaintenanceTypeDonutChart from './MaintenanceTypeDonutChart';

export interface VehicleRow {
  id: string;
  type: string;
  crlv_year: string | null;
  driver_id: string | null;
  initial_km?: number | null;
  shipper_name?: string | null;
  operational_unit_name?: string | null;
}

export interface MaintenanceOrderDashboard {
  id: string;
  vehicle_id: string;
  type: 'Corretiva' | 'Preventiva' | 'Preditiva';
  status: string;
  approved_cost: number | null;
  current_km: number | null;
  vehicle_type: string | null;
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
  overdueChecklistVehicleIds: Set<string>;
  expiredCrlvCount: number;
  expiredCnhCount: number;
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  isLoading?: boolean;
}

export default function OperationalPanel({
  vehicles,
  maintenanceOrders,
  overdueChecklistVehicleIds,
  expiredCrlvCount,
  expiredCnhCount,
  filters,
  onFiltersChange,
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
  const inMaintenance = filteredOrders.filter((o) => o.status !== 'Concluído').length;

  const overdueChecklists = filters.vehicleType
    ? filteredVehicles.filter((v) => overdueChecklistVehicleIds.has(v.id)).length
    : overdueChecklistVehicleIds.size;

  const currentYear = new Date().getFullYear().toString();
  const expiredCrlv = filters.vehicleType
    ? filteredVehicles.filter(
        (v) => v.crlv_year !== null && v.crlv_year < currentYear
      ).length
    : expiredCrlvCount;

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

  // Donut: ordens por tipo de manutenção (filtrado por vehicleType se ativo)
  const ordersForDonut = filters.vehicleType
    ? maintenanceOrders.filter((o) => {
        const vIds = new Set(
          vehicles.filter((v) => v.type === filters.vehicleType).map((v) => v.id)
        );
        return vIds.has(o.vehicle_id);
      })
    : maintenanceOrders;

  const maintenanceTypeData = MAINTENANCE_TYPES.map((t) => ({
    name: t,
    value: ordersForDonut.filter((o) => o.type === t).length,
  })).filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          label="Em Manutenção"
          value={inMaintenance}
        />
        <DashboardKpiCard
          icon={CalendarDays}
          iconBgClass="bg-orange-50"
          iconColorClass="text-orange-600"
          label="Checklists Vencidos"
          value={overdueChecklists}
          isAlert
        />
        <DashboardKpiCard
          icon={FileWarning}
          iconBgClass="bg-yellow-50"
          iconColorClass="text-yellow-600"
          label="CRLVs Vencidos"
          value={expiredCrlv}
          isAlert
        />
        <DashboardKpiCard
          icon={UserX}
          iconBgClass="bg-red-50"
          iconColorClass="text-red-600"
          label="CNHs Vencidas"
          value={expiredCnhCount}
          isAlert
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        {vehicleByShipperData.length > 0 && (
          <VehicleTypeBarChart
            data={vehicleByShipperData}
            activeFilter={null}
            onFilterChange={() => {}}
            title="Frota por Embarcador"
          />
        )}
        {vehicleByOpUnitData.length > 0 && (
          <VehicleTypeBarChart
            data={vehicleByOpUnitData}
            activeFilter={null}
            onFilterChange={() => {}}
            title="Frota por Unidade Operacional"
          />
        )}
      </div>
    </div>
  );
}
