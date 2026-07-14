import {
  Truck,
  Wrench,
  CheckCircle2,
  Activity,
  DollarSign,
  ListChecks,
  Radio,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import React, { lazy, Suspense, useMemo, useState } from 'react';

import {
  buildFleetCountByKey,
  buildTopFleetModels,
  calculateFleetAvailability,
  calculateChecklistComplianceRate,
  calculateInsuranceCoverageRate,
  calculateTrackerCoverageRate,
} from '../../lib/dashboardKpi';
import {
  OVERVIEW_DIMENSIONS,
  EMPTY_OVERVIEW_FILTERS,
  applyOverviewFleetFilter,
  filtersExcept,
  toggleDimensionValue,
  clearDimension,
  removeDimensionValue,
  isFiltersEmpty,
  countActiveMaintenanceVehiclesByIds,
  sumApprovedCostByVehicleIds,
  countOverdueChecklistByIds,
  computeUnavailableVehicleIds,
  applyAvailabilityFilter,
  toggleAvailabilityValue,
  buildAvailabilityChartData,
  type OverviewFleetFilters,
  type OverviewFilterKey,
  type AvailabilityValue,
} from '../../lib/overviewFleetFilters';
import RouteFallback from '../RouteFallback';

import DashboardKpiCard from './DashboardKpiCard';
import FleetAvailabilityDonutChart from './FleetAvailabilityDonutChart';

import type { VehicleRow } from './OperationalPanel';

const VehicleTypeBarChart = lazy(() => import('./VehicleTypeBarChart'));

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const FILTER_LABELS: Record<OverviewFilterKey, string> = {
  category: 'Categoria',
  type: 'Tipo',
  model: 'Modelo',
  acquisition: 'Aquisição',
  operationalUnit: 'Unidade Operacional',
  shipper: 'Embarcador',
};

interface OverviewPanelProps {
  vehicles: VehicleRow[];
  activeMaintenanceOrders: { vehicle_id: string; status: string }[];
  currentMonthOrders: { vehicle_id: string; approved_cost: number | null }[];
  overdueChecklistVehicleIds: Set<string>;
  isLoading?: boolean;
}

export default function OverviewPanel({
  vehicles,
  activeMaintenanceOrders,
  currentMonthOrders,
  overdueChecklistVehicleIds,
  isLoading = false,
}: OverviewPanelProps) {
  const [filters, setFilters] = useState<OverviewFleetFilters>(EMPTY_OVERVIEW_FILTERS);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityValue[]>([]);

  const filteredVehicles = useMemo(
    () => applyOverviewFleetFilter(vehicles, filters),
    [vehicles, filters],
  );

  const unavailableIds = useMemo(
    () => computeUnavailableVehicleIds(activeMaintenanceOrders, new Set(vehicles.map((v) => v.id))),
    [activeMaintenanceOrders, vehicles],
  );

  const finalVehicles = useMemo(
    () => applyAvailabilityFilter(filteredVehicles, unavailableIds, availabilityFilter),
    [filteredVehicles, unavailableIds, availabilityFilter],
  );

  const donutData = useMemo(
    () => buildAvailabilityChartData(filteredVehicles, unavailableIds),
    [filteredVehicles, unavailableIds],
  );

  const filteredIds = useMemo(
    () => new Set(finalVehicles.map((v) => v.id)),
    [finalVehicles],
  );

  const totalVehicles = finalVehicles.length;

  const unavailableVehicles = useMemo(
    () => countActiveMaintenanceVehiclesByIds(activeMaintenanceOrders, filteredIds),
    [activeMaintenanceOrders, filteredIds],
  );

  const availableVehicles = Math.max(0, totalVehicles - unavailableVehicles);
  const availabilityRate = calculateFleetAvailability(totalVehicles, unavailableVehicles);

  const totalApprovedCost = useMemo(
    () => sumApprovedCostByVehicleIds(currentMonthOrders, filteredIds),
    [currentMonthOrders, filteredIds],
  );

  const overdueCount = useMemo(
    () => countOverdueChecklistByIds(overdueChecklistVehicleIds, filteredIds),
    [overdueChecklistVehicleIds, filteredIds],
  );

  const complianceRate = calculateChecklistComplianceRate(totalVehicles, overdueCount);
  const trackerCoverageRate = calculateTrackerCoverageRate(finalVehicles);
  const insuranceCoverageRate = calculateInsuranceCoverageRate(finalVehicles);

  const chartDataByDimension = useMemo(() => {
    const result = {} as Record<OverviewFilterKey, { name: string; value: number }[]>;
    for (const dimension of OVERVIEW_DIMENSIONS) {
      const baseVehicles = applyAvailabilityFilter(
        applyOverviewFleetFilter(vehicles, filtersExcept(filters, dimension.key)),
        unavailableIds,
        availabilityFilter,
      );
      if (dimension.key === 'model') {
        result[dimension.key] = buildTopFleetModels(baseVehicles, 10, dimension.fallbackLabel);
      } else {
        result[dimension.key] = buildFleetCountByKey(baseVehicles, dimension.accessor, dimension.fallbackLabel);
      }
    }
    return result;
  }, [vehicles, filters, unavailableIds, availabilityFilter]);

  const filtersActive = !isFiltersEmpty(filters) || availabilityFilter.length > 0;

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

      {filtersActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <span className="text-xs font-medium text-zinc-500">Filtros ativos:</span>
          {OVERVIEW_DIMENSIONS.map((dimension) =>
            filters[dimension.key].map((value) => (
              <span
                key={`${dimension.key}:${value}`}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-blue-600"
              >
                {FILTER_LABELS[dimension.key]}: {value}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => removeDimensionValue(prev, dimension.key, value))}
                  className="ml-0.5 text-zinc-400 hover:text-zinc-600"
                  aria-label={`Remover filtro ${value}`}
                >
                  ×
                </button>
              </span>
            )),
          )}
          {availabilityFilter.map((value) => (
            <span
              key={`availability:${value}`}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-blue-600"
            >
              Disponibilidade: {value}
              <button
                type="button"
                onClick={() => setAvailabilityFilter((prev) => prev.filter((v) => v !== value))}
                className="ml-0.5 text-zinc-400 hover:text-zinc-600"
                aria-label={`Remover filtro ${value}`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_OVERVIEW_FILTERS);
              setAvailabilityFilter([]);
            }}
            className="ml-1 text-xs text-zinc-400 underline hover:text-zinc-600"
          >
            Limpar tudo
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <DashboardKpiCard
          icon={Truck}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="Total de Veículos"
          value={totalVehicles}
        />
        <DashboardKpiCard
          icon={CheckCircle2}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          label="Veículos Disponíveis"
          value={availableVehicles}
        />
        <DashboardKpiCard
          icon={Wrench}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          label="Veículos Indisponíveis"
          value={unavailableVehicles}
        />
        <DashboardKpiCard
          icon={Activity}
          iconBgClass="bg-green-50"
          iconColorClass="text-green-600"
          label="Disponibilidade da Frota"
          value={`${availabilityRate}%`}
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
        <DashboardKpiCard
          icon={Radio}
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
          label="Cobertura de Rastreador"
          value={`${trackerCoverageRate}%`}
          subtitle="veículos com rastreador"
        />
        <DashboardKpiCard
          icon={ShieldCheck}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600"
          label="Cobertura de Seguro"
          value={`${insuranceCoverageRate}%`}
          subtitle="veículos com seguro"
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Mapa da Frota</h3>
          <p className="text-sm text-zinc-500">Composição da frota</p>
        </div>
        <Suspense fallback={<RouteFallback />}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FleetAvailabilityDonutChart
                data={donutData}
                selectedValues={availabilityFilter}
                onSelect={(name, additive) =>
                  setAvailabilityFilter((prev) => toggleAvailabilityValue(prev, name, additive))
                }
                onClearAll={() => setAvailabilityFilter([])}
              />
              {OVERVIEW_DIMENSIONS.filter((dimension) => dimension.key === 'shipper').map((dimension) => (
                <VehicleTypeBarChart
                  key={dimension.key}
                  title={dimension.title}
                  data={chartDataByDimension[dimension.key]}
                  selectedValues={filters[dimension.key]}
                  onSelect={(name, additive) =>
                    setFilters((prev) => toggleDimensionValue(prev, dimension.key, name, additive))
                  }
                  onClearAll={() => setFilters((prev) => clearDimension(prev, dimension.key))}
                  multiSelectHint
                />
              ))}
            </div>
            {OVERVIEW_DIMENSIONS.filter((dimension) => dimension.key === 'operationalUnit').map((dimension) => (
              <VehicleTypeBarChart
                key={dimension.key}
                title={dimension.title}
                data={chartDataByDimension[dimension.key]}
                selectedValues={filters[dimension.key]}
                onSelect={(name, additive) =>
                  setFilters((prev) => toggleDimensionValue(prev, dimension.key, name, additive))
                }
                onClearAll={() => setFilters((prev) => clearDimension(prev, dimension.key))}
                multiSelectHint
              />
            ))}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {OVERVIEW_DIMENSIONS.filter((dimension) =>
                ['category', 'type', 'model', 'acquisition'].includes(dimension.key),
              ).map((dimension) => (
                <VehicleTypeBarChart
                  key={dimension.key}
                  title={dimension.title}
                  data={chartDataByDimension[dimension.key]}
                  selectedValues={filters[dimension.key]}
                  onSelect={(name, additive) =>
                    setFilters((prev) => toggleDimensionValue(prev, dimension.key, name, additive))
                  }
                  onClearAll={() => setFilters((prev) => clearDimension(prev, dimension.key))}
                  multiSelectHint
                />
              ))}
            </div>
          </div>
        </Suspense>
      </div>
    </div>
  );
}
