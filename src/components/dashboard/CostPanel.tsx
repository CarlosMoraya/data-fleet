import React, { useMemo, lazy, Suspense } from 'react';
import { DollarSign, Truck, Gauge, Loader2, TrendingUp, ReceiptText, Wrench } from 'lucide-react';
import DashboardKpiCard from './DashboardKpiCard';
import RouteFallback from '../RouteFallback';
import VehicleFinancialRanking from './VehicleFinancialRanking';
import type { VehicleRow } from './OperationalPanel';
import type { MaintenanceOrderDashboard } from '../../types/maintenance';
import CostFilters from './CostFilters';
import {
  applyCostFilters,
  buildCostFilterOptions,
  buildCostTrendSeries,
  buildCostByVehicleAttribute,
  buildCostBySystemData,
  buildVehicleFinancialRanking,
  calculateAverageApprovedTicket,
  calculateCostPerKm,
  calculateMovingAverageProjection,
  chooseTrendGranularity,
  getTrailingMonthKeys,
  sumApprovedCostByMonthKeys,
  sumApprovedMaintenanceCost,
  type CostDashboardFilters,
  type BudgetItemForCost,
} from '../../lib/dashboardKpi';

const VehicleTypeBarChart = lazy(() => import('./VehicleTypeBarChart'));
const MaintenanceTypeDonutChart = lazy(() => import('./MaintenanceTypeDonutChart'));
const CostTrendChart = lazy(() => import('./CostTrendChart'));

const VEHICLE_TYPES = ['Passeio', 'Utilitário', 'Van', 'Moto', 'Vuc', 'Toco', 'Truck', 'Cavalo'];
const MAINTENANCE_TYPES = ['Corretiva', 'Preventiva', 'Preditiva'] as const;

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCurrency = (v: number) => fmt.format(v);

interface VehicleKmRow {
  vehicle_id: string;
  km_driven: number;
}

interface CostPanelProps {
  vehicles: VehicleRow[];
  maintenanceOrders: MaintenanceOrderDashboard[];
  currentMonthOrders: MaintenanceOrderDashboard[];
  projectionSourceOrders: MaintenanceOrderDashboard[];
  vehicleKmRows: VehicleKmRow[];
  dateRange: { from: string; to: string };
  filters: CostDashboardFilters;
  onFiltersChange: (f: CostDashboardFilters) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
  budgetItems: BudgetItemForCost[];
  onViewVehicleHistory: (plate: string) => void;
}

export default function CostPanel({
  vehicles,
  maintenanceOrders,
  currentMonthOrders,
  projectionSourceOrders,
  vehicleKmRows,
  dateRange,
  filters,
  onFiltersChange,
  onResetFilters,
  isLoading = false,
  budgetItems,
  onViewVehicleHistory,
}: CostPanelProps) {
  const filterOptions = useMemo(() => buildCostFilterOptions(vehicles), [vehicles]);

  const { filteredVehicles, filteredOrders } = useMemo(
    () => applyCostFilters({ vehicles, orders: maintenanceOrders, filters }),
    [vehicles, maintenanceOrders, filters]
  );

  const { filteredOrders: filteredCurrentMonthOrders } = useMemo(
    () => applyCostFilters({ vehicles, orders: currentMonthOrders, filters }),
    [vehicles, currentMonthOrders, filters]
  );

  const { filteredOrders: filteredProjectionOrders } = useMemo(
    () => applyCostFilters({ vehicles, orders: projectionSourceOrders, filters }),
    [vehicles, projectionSourceOrders, filters]
  );

  const totalCost = useMemo(() => sumApprovedMaintenanceCost(filteredOrders), [filteredOrders]);

  const currentMonthCost = useMemo(
    () => sumApprovedMaintenanceCost(filteredCurrentMonthOrders),
    [filteredCurrentMonthOrders]
  );

  const approvedOrdersCount = useMemo(
    () => filteredOrders.filter((order) => order.status !== 'Cancelado' && (order.approved_cost ?? 0) > 0).length,
    [filteredOrders]
  );

  const averageApprovedTicket = useMemo(
    () => calculateAverageApprovedTicket(filteredOrders),
    [filteredOrders]
  );

  const costPerKm = useMemo(
    () => calculateCostPerKm({
      totalCost,
      vehicleKmRows,
      allowedVehicleIds: new Set(filteredVehicles.map((vehicle) => vehicle.id)),
    }),
    [totalCost, vehicleKmRows, filteredVehicles]
  );

  const projectedNextMonthCost = useMemo(() => {
    const monthKeys = getTrailingMonthKeys(new Date().toISOString().split('T')[0], 3);
    const monthlyTotals = sumApprovedCostByMonthKeys(filteredProjectionOrders, monthKeys);
    return calculateMovingAverageProjection(monthlyTotals);
  }, [filteredProjectionOrders]);

  const granularity = chooseTrendGranularity(dateRange.from, dateRange.to);

  const costTrendData = useMemo(
    () => buildCostTrendSeries(filteredOrders, dateRange.from, dateRange.to, granularity),
    [filteredOrders, dateRange.from, dateRange.to, granularity]
  );

  const costByTypeData = useMemo(() => {
    const vehicleTypeMap = new Map(filteredVehicles.map((v) => [v.id, v.type]));

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
    }).filter((entry) => entry.value > 0);
  }, [filteredVehicles, filteredOrders]);

  const costByShipperData = useMemo(
    () => buildCostByVehicleAttribute(filteredVehicles, filteredOrders, 'shipper_name', 'Sem Embarcador'),
    [filteredVehicles, filteredOrders],
  );

  const costByOpUnitData = useMemo(
    () => buildCostByVehicleAttribute(filteredVehicles, filteredOrders, 'operational_unit_name', 'Sem Unidade'),
    [filteredVehicles, filteredOrders],
  );

  const costByCategoryData = useMemo(
    () => buildCostByVehicleAttribute(filteredVehicles, filteredOrders, 'category', 'Sem Categoria'),
    [filteredVehicles, filteredOrders],
  );

  const costByModelData = useMemo(
    () => buildCostByVehicleAttribute(filteredVehicles, filteredOrders, 'model', 'Sem Modelo'),
    [filteredVehicles, filteredOrders],
  );

  const costBySystemData = useMemo(
    () => buildCostBySystemData(filteredOrders, budgetItems),
    [filteredOrders, budgetItems],
  );

  const vehicleRanking = useMemo(
    () => buildVehicleFinancialRanking({ filteredVehicles, filteredOrders, vehicleKmRows }),
    [filteredVehicles, filteredOrders, vehicleKmRows],
  );

  const costByMaintenanceTypeData = MAINTENANCE_TYPES.map((t) => ({
    name: t,
    value: filteredOrders
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
      <CostFilters
        value={filters}
        options={filterOptions}
        onChange={onFiltersChange}
        onReset={onResetFilters}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardKpiCard
          icon={DollarSign}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          label="Custo no Período"
          value={formatCurrency(totalCost)}
          subtitle="orçamentos aprovados no período"
        />
        <DashboardKpiCard
          icon={Gauge}
          iconBgClass="bg-purple-50"
          iconColorClass="text-purple-600"
          label="Custo por KM"
          value={costPerKm.value != null ? formatCurrency(costPerKm.value) : 'sem dados suficientes'}
          subtitle={
            costPerKm.value != null
              ? `${costPerKm.totalKm.toLocaleString('pt-BR')} km válidos`
              : 'KM válido indisponível'
          }
        />
        <DashboardKpiCard
          icon={Truck}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="Custo do Mês Atual"
          value={formatCurrency(currentMonthCost)}
          subtitle="mês corrente"
        />
        <DashboardKpiCard
          icon={TrendingUp}
          iconBgClass="bg-orange-50"
          iconColorClass="text-orange-500"
          label="Projeção Próximo Mês"
          value={projectedNextMonthCost != null ? formatCurrency(projectedNextMonthCost) : 'sem dados suficientes'}
          subtitle="média móvel 3 meses"
        />
        <DashboardKpiCard
          icon={ReceiptText}
          iconBgClass="bg-sky-50"
          iconColorClass="text-sky-600"
          label="Ticket Médio por OS"
          value={averageApprovedTicket != null ? formatCurrency(averageApprovedTicket) : 'sem dados suficientes'}
          subtitle={`${approvedOrdersCount} OS consideradas`}
        />
        <DashboardKpiCard
          icon={Wrench}
          iconBgClass="bg-zinc-100"
          iconColorClass="text-zinc-600"
          label="Custos com Reboque"
          value="sem dados confiáveis"
          subtitle="aguarda gestão de reboques"
        />
      </div>

      <Suspense fallback={<RouteFallback />}>
        <CostTrendChart
          data={costTrendData}
          title="Evolução do Custo de Manutenção"
          valueFormatter={formatCurrency}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MaintenanceTypeDonutChart
            data={costByMaintenanceTypeData}
            activeFilter={filters.maintenanceType}
            onFilterChange={(t) =>
              onFiltersChange({ ...filters, maintenanceType: t })
            }
            title="Custo por Tipo de Manutenção"
            valueFormatter={formatCurrency}
          />
          {costBySystemData.length > 0 && (
            <VehicleTypeBarChart
              data={costBySystemData}
              activeFilter={null}
              onFilterChange={() => {}}
              title="Custo por Sistema"
              valueFormatter={formatCurrency}
              yAxisLabel="R$"
            />
          )}
          {costByCategoryData.length > 0 && (
            <VehicleTypeBarChart
              data={costByCategoryData}
              activeFilter={null}
              onFilterChange={() => {}}
              title="Custo por Categoria"
              valueFormatter={formatCurrency}
              yAxisLabel="R$"
            />
          )}
          {costByModelData.length > 0 && (
            <VehicleTypeBarChart
              data={costByModelData}
              activeFilter={null}
              onFilterChange={() => {}}
              title="Custo por Modelo"
              valueFormatter={formatCurrency}
              yAxisLabel="R$"
            />
          )}
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
          {costByTypeData.length > 0 && (
            <VehicleTypeBarChart
              data={costByTypeData}
              activeFilter={null}
              onFilterChange={() => {}}
              title="Custo por Tipo de Veículo"
              valueFormatter={formatCurrency}
              yAxisLabel="R$"
            />
          )}
        </div>

        <VehicleFinancialRanking
          rows={vehicleRanking}
          onViewHistory={onViewVehicleHistory}
          valueFormatter={formatCurrency}
        />
      </Suspense>
    </div>
  );
}
