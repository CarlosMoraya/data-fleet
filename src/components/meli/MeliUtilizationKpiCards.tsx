import { Gauge, Route, Truck, TruckIcon } from 'lucide-react';
import React from 'react';

import DashboardKpiCard from '../dashboard/DashboardKpiCard';

import type { MeliUtilizationKpis } from '../../types/meliUtilization';

interface MeliUtilizationKpiCardsProps {
  kpis: MeliUtilizationKpis;
  loading: boolean;
}

const CARD_LABELS = [
  'Total de veículos (MELI + Dedicado)',
  'Veículos Utilizados',
  'Não Utilizados',
  '% Utilização',
];

export default function MeliUtilizationKpiCards({
  kpis,
  loading,
}: MeliUtilizationKpiCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {CARD_LABELS.map((label) => (
          <div
            key={label}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-zinc-500">{label}</p>
            <div
              className="mt-3 h-8 w-20 animate-pulse rounded bg-zinc-200"
              aria-label={`Carregando ${label}`}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DashboardKpiCard
        icon={Truck}
        iconBgClass="bg-blue-100"
        iconColorClass="text-blue-600"
        label={CARD_LABELS[0]}
        value={kpis.totalVehicles}
      />
      <DashboardKpiCard
        icon={Route}
        iconBgClass="bg-emerald-100"
        iconColorClass="text-emerald-600"
        label={CARD_LABELS[1]}
        value={kpis.usedVehicles}
      />
      <DashboardKpiCard
        icon={TruckIcon}
        iconBgClass="bg-zinc-100"
        iconColorClass="text-zinc-600"
        label={CARD_LABELS[2]}
        value={kpis.unusedVehicles}
      />
      <DashboardKpiCard
        icon={Gauge}
        iconBgClass="bg-orange-100"
        iconColorClass="text-orange-600"
        label={CARD_LABELS[3]}
        value={`${kpis.utilizationRate.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`}
      />
    </div>
  );
}
