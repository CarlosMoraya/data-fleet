import { DollarSign, Droplets, Fuel, Gauge, Receipt } from 'lucide-react';
import React from 'react';

import DashboardKpiCard from '../dashboard/DashboardKpiCard';

import type { FuelSupplyKpis } from '../../lib/fuelSupplyKpi';

const EMPTY = '—';

function formatCurrency(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatLiters(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKmPerLiter(value: number | null): string {
  if (value === null) return EMPTY;
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`;
}

export default function FuelSupplyKpiCards({ kpis }: { kpis: FuelSupplyKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <DashboardKpiCard
        icon={DollarSign}
        iconBgClass="bg-emerald-100"
        iconColorClass="text-emerald-600"
        label="Valor total"
        value={formatCurrency(kpis.totalValue)}
      />
      <DashboardKpiCard
        icon={Droplets}
        iconBgClass="bg-blue-100"
        iconColorClass="text-blue-600"
        label="Litros totais"
        value={formatLiters(kpis.totalLiters)}
      />
      <DashboardKpiCard
        icon={Receipt}
        iconBgClass="bg-amber-100"
        iconColorClass="text-amber-600"
        label="Preço médio/litro"
        value={formatCurrency(kpis.averagePricePerLiter)}
      />
      <DashboardKpiCard
        icon={Gauge}
        iconBgClass="bg-violet-100"
        iconColorClass="text-violet-600"
        label="Consumo médio"
        value={formatKmPerLiter(kpis.averageKmPerLiter)}
      />
      <DashboardKpiCard
        icon={Fuel}
        iconBgClass="bg-orange-100"
        iconColorClass="text-orange-600"
        label="Abastecimentos"
        value={kpis.supplyCount}
      />
    </div>
  );
}
