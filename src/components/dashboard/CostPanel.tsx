import React, { useMemo } from 'react';
import { DollarSign, Truck, Gauge, Loader2 } from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';
import VehicleTypeBarChart from './VehicleTypeBarChart';
import MaintenanceTypeDonutChart from './MaintenanceTypeDonutChart';
import type { VehicleRow, DashboardFilters } from './OperationalPanel';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';

const VEHICLE_TYPES = ['Passeio', 'Utilitário', 'Van', 'Moto', 'Vuc', 'Toco', 'Truck', 'Cavalo'];
const MAINTENANCE_TYPES = ['Corretiva', 'Preventiva', 'Preditiva'] as const;

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (v: number) => fmt.format(v);

interface ChecklistRow {
  vehicle_id: string;
  completed_at: string;
  odometer_km: number | null;
}

interface CostPanelProps {
  vehicles: VehicleRow[];
  maintenanceOrders: MaintenanceOrderDashboard[];
  checklistRows: ChecklistRow[];
  dateRange: { from: string; to: string };
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  isLoading?: boolean;
}

export default function CostPanel({
  vehicles,
  maintenanceOrders,
  checklistRows,
  dateRange,
  filters,
  onFiltersChange,
  isLoading = false,
}: CostPanelProps) {
  const { filteredVehicles, filteredOrders } = useMemo((): {
    filteredVehicles: VehicleRow[];
    filteredOrders: MaintenanceOrderDashboard[];
  } => {
    let fv = vehicles;
    let fo = maintenanceOrders.filter((o) => o.status !== 'Cancelado');

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

  // Only count orders with approved cost
  const approvedOrders = filteredOrders.filter(
    (o) => o.approved_cost !== null && o.approved_cost > 0
  );

  const totalCost = approvedOrders.reduce(
    (sum, o) => sum + (o.approved_cost ?? 0),
    0
  );

  const costPerVehicle =
    filteredVehicles.length > 0 ? totalCost / filteredVehicles.length : 0;

  // Custo por KM: para cada veículo, MAX(odometer_km) - MIN(odometer_km) nos checklists do período
  const costPerKm = useMemo(() => {
    const inPeriod = checklistRows.filter(
      (r) =>
        r.odometer_km !== null &&
        r.completed_at >= dateRange.from &&
        r.completed_at <= dateRange.to
    );

    const vehicleIds = new Set(filteredVehicles.map((v) => v.id));
    let totalKm = 0;

    for (const vId of vehicleIds) {
      const kms = inPeriod
        .filter((r) => r.vehicle_id === vId)
        .map((r) => r.odometer_km as number);

      if (kms.length < 2) continue;
      const diff = Math.max(...kms) - Math.min(...kms);
      if (diff > 0) totalKm += diff;
    }

    return totalKm > 0 ? totalCost / totalKm : 0;
  }, [checklistRows, dateRange, filteredVehicles, totalCost]);

  // Bar chart: custo por tipo de veículo
  const costByTypeData = useMemo(() => {
    // Build vehicle_id → type map from all vehicles (not filtered by type)
    const vehicleTypeMap = new Map(vehicles.map((v) => [v.id, v.type]));

    return VEHICLE_TYPES.map((t) => {
      const cost = filteredOrders
        .filter(
          (o) =>
            vehicleTypeMap.get(o.vehicle_id) === t &&
            o.approved_cost !== null &&
            o.approved_cost > 0
        )
        .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0);
      return { name: t, value: cost };
    });
  }, [vehicles, filteredOrders]);

  // Bar chart: custo por embarcador
  const costByShipperData = useMemo(() => {
    const vehicleShipperMap = new Map(
      vehicles.map((v) => [v.id, v.shipper_name ?? 'Sem Embarcador'])
    );
    const names = [...new Set(vehicles.map((v) => v.shipper_name ?? 'Sem Embarcador'))];
    return names.map((name) => ({
      name,
      value: filteredOrders
        .filter(
          (o) =>
            vehicleShipperMap.get(o.vehicle_id) === name &&
            o.approved_cost !== null &&
            o.approved_cost > 0
        )
        .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0),
    })).filter((d) => d.value > 0);
  }, [vehicles, filteredOrders]);

  // Bar chart: custo por unidade operacional
  const costByOpUnitData = useMemo(() => {
    const vehicleOpUnitMap = new Map(
      vehicles.map((v) => [v.id, v.operational_unit_name ?? 'Sem Unidade'])
    );
    const names = [...new Set(vehicles.map((v) => v.operational_unit_name ?? 'Sem Unidade'))];
    return names.map((name) => ({
      name,
      value: filteredOrders
        .filter(
          (o) =>
            vehicleOpUnitMap.get(o.vehicle_id) === name &&
            o.approved_cost !== null &&
            o.approved_cost > 0
        )
        .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0),
    })).filter((d) => d.value > 0);
  }, [vehicles, filteredOrders]);

  // Donut: custo por tipo de manutenção
  const ordersForDonut = filters.vehicleType
    ? maintenanceOrders.filter((o) => {
      const vIds = new Set(
        vehicles.filter((v) => v.type === filters.vehicleType).map((v) => v.id)
      );
      return vIds.has(o.vehicle_id);
    })
    : maintenanceOrders;

  const costByMaintenanceTypeData = MAINTENANCE_TYPES.map((t) => ({
    name: t,
    value: ordersForDonut
      .filter(
        (o) =>
          o.type === t && o.approved_cost !== null && o.approved_cost > 0
      )
      .reduce((sum, o) => sum + (o.approved_cost ?? 0), 0),
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardKpiCard
          icon={DollarSign}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          label="Custo Total"
          value={formatCurrency(totalCost)}
          subtitle="orçamentos aprovados"
        />
        <DashboardKpiCard
          icon={Truck}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="Custo por Veículo"
          value={formatCurrency(costPerVehicle)}
          subtitle={
            filteredVehicles.length > 0
              ? `${filteredVehicles.length} veículo${filteredVehicles.length > 1 ? 's' : ''}`
              : 'sem dados'
          }
        />
        <DashboardKpiCard
          icon={Gauge}
          iconBgClass="bg-purple-50"
          iconColorClass="text-purple-600"
          label="Custo por KM"
          value={costPerKm > 0 ? formatCurrency(costPerKm) : '—'}
          subtitle="por KM rodado"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VehicleTypeBarChart
          data={costByTypeData}
          activeFilter={filters.vehicleType}
          onFilterChange={(t) => onFiltersChange({ ...filters, vehicleType: t })}
          title="Custo por Tipo de Veículo"
          valueFormatter={formatCurrency}
          yAxisLabel="R$"
        />
        <MaintenanceTypeDonutChart
          data={costByMaintenanceTypeData}
          activeFilter={filters.maintenanceType}
          onFilterChange={(t) =>
            onFiltersChange({ ...filters, maintenanceType: t })
          }
          title="Custo por Tipo de Manutenção"
          valueFormatter={formatCurrency}
        />
        {costByShipperData.length > 0 && (
          <VehicleTypeBarChart
            data={costByShipperData}
            activeFilter={null}
            onFilterChange={() => { }}
            title="Custo por Embarcador"
            valueFormatter={formatCurrency}
            yAxisLabel="R$"
          />
        )}
        {costByOpUnitData.length > 0 && (
          <VehicleTypeBarChart
            data={costByOpUnitData}
            activeFilter={null}
            onFilterChange={() => { }}
            title="Custo por Unidade Operacional"
            valueFormatter={formatCurrency}
            yAxisLabel="R$"
          />
        )}
      </div>
    </div>
  );
}
