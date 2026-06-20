import React, { lazy, Suspense, useMemo } from 'react';
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
import DashboardKpiCard from './DashboardKpiCard';
import RouteFallback from '../RouteFallback';
import type { VehicleRow } from './OperationalPanel';
import {
  buildFleetCountByKey,
  buildTopFleetModels,
} from '../../lib/dashboardKpi';

const VehicleTypeBarChart = lazy(() => import('./VehicleTypeBarChart'));

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const ACQUISITION_LABELS: Record<string, string> = {
  Owned: 'Próprio',
  Rented: 'Alugado',
  Agregado: 'Agregado',
};

function mapAcquisitionLabel(value: string | null | undefined): string | null {
  if (value == null) return null;
  return ACQUISITION_LABELS[value] ?? null;
}

interface OverviewPanelProps {
  vehicles: VehicleRow[];
  totalVehicles: number;
  availableVehicles: number;
  unavailableVehicles: number;
  availabilityRate: number;
  totalApprovedCost: number;
  complianceRate: number;
  trackerCoverageRate: number;
  insuranceCoverageRate: number;
  isLoading?: boolean;
}

export default function OverviewPanel({
  vehicles,
  totalVehicles,
  availableVehicles,
  unavailableVehicles,
  availabilityRate,
  totalApprovedCost,
  complianceRate,
  trackerCoverageRate,
  insuranceCoverageRate,
  isLoading = false,
}: OverviewPanelProps) {
  const fleetByCategoryData = useMemo(
    () => buildFleetCountByKey(vehicles, (vehicle) => vehicle.category, 'Sem Categoria'),
    [vehicles]
  );

  const fleetByTypeData = useMemo(
    () => buildFleetCountByKey(vehicles, (vehicle) => vehicle.type, 'Sem Tipo'),
    [vehicles]
  );

  const topFleetModelsData = useMemo(
    () => buildTopFleetModels(vehicles, 10, 'Sem Modelo'),
    [vehicles]
  );

  const fleetByAcquisitionData = useMemo(
    () => buildFleetCountByKey(vehicles, (vehicle) => mapAcquisitionLabel(vehicle.acquisition), 'Não Informado'),
    [vehicles]
  );

  const fleetByOperationalUnitData = useMemo(
    () => buildFleetCountByKey(vehicles, (vehicle) => vehicle.operational_unit_name, 'Sem Unidade'),
    [vehicles]
  );

  const fleetByShipperData = useMemo(
    () => buildFleetCountByKey(vehicles, (vehicle) => vehicle.shipper_name, 'Sem Embarcador'),
    [vehicles]
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <VehicleTypeBarChart
              title="Frota por Categoria"
              data={fleetByCategoryData}
              activeFilter={null}
              onFilterChange={() => {}}
            />
            <VehicleTypeBarChart
              title="Frota por Tipo"
              data={fleetByTypeData}
              activeFilter={null}
              onFilterChange={() => {}}
            />
            <VehicleTypeBarChart
              title="Top Modelos da Frota"
              data={topFleetModelsData}
              activeFilter={null}
              onFilterChange={() => {}}
            />
            <VehicleTypeBarChart
              title="Próprios x Alugados x Agregados"
              data={fleetByAcquisitionData}
              activeFilter={null}
              onFilterChange={() => {}}
            />
            <VehicleTypeBarChart
              title="Frota por Unidade Operacional"
              data={fleetByOperationalUnitData}
              activeFilter={null}
              onFilterChange={() => {}}
            />
            <VehicleTypeBarChart
              title="Frota por Embarcador"
              data={fleetByShipperData}
              activeFilter={null}
              onFilterChange={() => {}}
            />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
