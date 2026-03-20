import React, { useMemo } from 'react';
import { DollarSign, Truck, Gauge } from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';
import VehicleTypeBarChart from './VehicleTypeBarChart';
import MaintenanceTypeDonutChart from './MaintenanceTypeDonutChart';
import type {
  VehicleRow,
  MaintenanceOrderDashboard,
  DashboardFilters,
} from './OperationalPanel';

const VEHICLE_TYPES = ['Passeio', 'Utilitário', 'Van', 'Moto', 'Vuc', 'Toco', 'Truck', 'Cavalo'];
const MAINTENANCE_TYPES = ['Corretiva', 'Preventiva', 'Preditiva'] as const;

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (v: number) => fmt.format(v);

interface CostPanelProps {
  vehicles: VehicleRow[];
  maintenanceOrders: MaintenanceOrderDashboard[];
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
}

export default function CostPanel({
  vehicles,
  maintenanceOrders,
  filters,
  onFiltersChange,
}: CostPanelProps) {
  const { filteredVehicles, filteredOrders } = useMemo((): {
    filteredVehicles: VehicleRow[];
    filteredOrders: MaintenanceOrderDashboard[];
  } => {
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

  // Only count orders with approved cost
  const approvedOrders = filteredOrders.filter(
    (o) => o.approved_cost !== null && o.approved_cost > 0
  );

  const totalCost = approvedOrders.reduce(
    (sum, o) => sum + (o.approved_cost ?? 0),
    0
  );

  const distinctVehiclesWithCost = new Set(approvedOrders.map((o) => o.vehicle_id))
    .size;

  const costPerVehicle =
    distinctVehiclesWithCost > 0 ? totalCost / distinctVehiclesWithCost : 0;

  // Custo por KM: for each vehicle, MAX(current_km) - initial_km
  const costPerKm = useMemo(() => {
    const vehicleMap = new Map<string, VehicleRow>(filteredVehicles.map((v) => [v.id, v]));
    let totalKm = 0;

    for (const vId of new Set<string>(approvedOrders.map((o) => o.vehicle_id))) {
      const vehicle = vehicleMap.get(vId);
      if (!vehicle) continue;

      const vehicleOrders = approvedOrders.filter((o) => o.vehicle_id === vId);
      const kms = vehicleOrders
        .map((o) => o.current_km)
        .filter((k): k is number => k !== null);

      if (kms.length === 0) continue;

      const maxKm = Math.max(...kms);
      const baseKm =
        vehicle.initial_km !== null ? vehicle.initial_km : Math.min(...kms);

      const diff = maxKm - baseKm;
      if (diff > 0) totalKm += diff;
    }

    return totalKm > 0 ? totalCost / totalKm : 0;
  }, [filteredVehicles, approvedOrders, totalCost]);

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
            distinctVehiclesWithCost > 0
              ? `${distinctVehiclesWithCost} veículo${distinctVehiclesWithCost > 1 ? 's' : ''} com custo`
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
      </div>
    </div>
  );
}
